import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatMonthName(yearMonthStr) {
  if (!yearMonthStr || !yearMonthStr.includes('-')) return yearMonthStr || '';
  const [year, month] = yearMonthStr.split('-');
  const mIndex = parseInt(month, 10) - 1;
  const name = MONTH_NAMES[mIndex] || month;
  return `${name} ${year}`;
}

function parseLineItems(lineItemsField) {
  if (!lineItemsField) return [];
  if (Array.isArray(lineItemsField)) return lineItemsField;
  if (typeof lineItemsField === 'string') {
    try {
      const parsed = JSON.parse(lineItemsField);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getUserFromCookie(request) {
  const authCookie = request.headers.get('x-user-id') || request.cookies.get('nexus_user')?.value;
  if (!authCookie) return null;
  try {
    const decoded = typeof authCookie === 'string' ? decodeURIComponent(authCookie) : authCookie;
    return decoded.startsWith('{') ? JSON.parse(decoded) : null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month'); // YYYY-MM or 'all'
    const employeeIdParam = searchParams.get('employeeId');
    const searchParam = searchParams.get('search')?.toLowerCase().trim() || '';
    const searchField = searchParams.get('searchField') || 'all';

    const sessionUser = getUserFromCookie(request);

    if (sessionUser && sessionUser.role !== 'ADMIN' && sessionUser.role !== 'SUB_ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin or Supervisor access required' }, { status: 403 });
    }

    // Determine target month (default to current month, or August 2026 / current date)
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isAllMonths = monthParam === 'all';
    const selectedMonth = isAllMonths ? 'all' : (monthParam || currentYearMonth);
    const [selYearStr, selMonthStr] = (!isAllMonths && selectedMonth.includes('-')) 
      ? selectedMonth.split('-') 
      : currentYearMonth.split('-');
    const selYear = parseInt(selYearStr, 10);
    const selMonthNum = parseInt(selMonthStr, 10); // 1-12

    const startOfSelectedMonth = new Date(Date.UTC(selYear, selMonthNum - 1, 1, 0, 0, 0, 0));
    const endOfSelectedMonth = new Date(Date.UTC(selYear, selMonthNum, 0, 23, 59, 59, 999));

    // Fetch invoices and jobs with DB retry
    const result = await withDbRetry(async () => {
      // 1. Fetch all QuotationInvoices of documentType = 'INVOICE'
      let invoices = [];
      try {
        invoices = await prisma.quotationInvoice.findMany({
          where: { documentType: 'INVOICE' },
          include: {
            jobMetadata: {
              include: {
                ticket: true,
                assignedEmployee: { select: { id: true, employeeName: true, email: true } },
                createdBy: { select: { id: true, employeeName: true, email: true } },
                payments: { orderBy: { createdAt: 'asc' } },
                workCompletion: true,
              },
            },
            createdBy: { select: { id: true, employeeName: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
      } catch (err) {
        console.warn('Full invoice query failed:', err.message);
        invoices = await prisma.quotationInvoice.findMany({
          where: { documentType: 'INVOICE' },
          include: { jobMetadata: { include: { ticket: true } } },
          orderBy: { createdAt: 'desc' },
        }).catch(() => []);
      }

      // 2. Fetch all jobs with their quotations, completion, and payments
      let jobs = [];
      try {
        jobs = await prisma.jobMetadata.findMany({
          include: {
            ticket: true,
            assignedEmployee: { select: { id: true, employeeName: true, email: true } },
            createdBy: { select: { id: true, employeeName: true, email: true } },
            quotationInvoices: { orderBy: { createdAt: 'desc' } },
            payments: { orderBy: { createdAt: 'asc' } },
            workCompletion: true,
          },
          orderBy: { createdAt: 'desc' },
        });
      } catch (err) {
        console.warn('Jobs query failed:', err.message);
        jobs = [];
      }

      // 3. Fetch active employees list for filter dropdown
      let employees = [];
      try {
        employees = await prisma.user.findMany({
          where: { role: 'EMPLOYEE' },
          select: { id: true, employeeName: true, email: true, activeStatus: true },
          orderBy: { employeeName: 'asc' },
        });
      } catch {}

      // 4. If search query is provided, also fetch unlinked incoming tickets
      let unlinkedTickets = [];
      if (searchParam) {
        try {
          const cleanNumeric = searchParam.replace(/^(ticket\s*#?|#|sr\s*#?|serial\s*#?|inv\s*#?|i|q|j|t)/i, '').trim();
          const orFilters = [
            { subject: { contains: searchParam, mode: 'insensitive' } },
            { sender: { contains: searchParam, mode: 'insensitive' } },
            { serialNo: { contains: searchParam, mode: 'insensitive' } },
          ];
          if (cleanNumeric && !isNaN(Number(cleanNumeric))) {
            orFilters.push({ id: Number(cleanNumeric) });
          }
          unlinkedTickets = await prisma.ticket.findMany({
            where: {
              jobMetadata: null,
              NOT: { status: { in: ['IRRELEVANT', 'CANCELLED'] } },
              OR: orFilters,
            },
            include: {
              createdBy: { select: { id: true, employeeName: true, email: true } },
              gmailAccount: { select: { id: true, gmailEmail: true } },
            },
            take: 50,
            orderBy: { exactDate: 'desc' },
          });
        } catch (tErr) {
          console.warn('Unlinked tickets query failed:', tErr.message);
        }
      }

      return { invoices, jobs, employees, unlinkedTickets };
    });

    const { invoices, jobs, employees, unlinkedTickets = [] } = result;

    // Track invoice records by key
    const allBillableItems = [];
    const processedJobIds = new Set();

    // Process formal QuotationInvoice (INVOICE) records first
    for (const inv of invoices) {
      const job = inv.jobMetadata;
      if (job) processedJobIds.add(job.id);

      const items = parseLineItems(inv.lineItems);
      const itemsSum = items.reduce((s, it) => s + (Number(it.amount) || ((Number(it.qty) || 0) * (Number(it.rate) || 0)) || 0), 0);
      const totalAmount = itemsSum > 0 ? itemsSum : (Number(job?.workCompletion?.amount) || 0);

      // Payments received for this job
      const payments = job?.payments || [];
      const totalReceived = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const pendingAmount = Math.max(0, totalAmount - totalReceived);

      // Status resolution (aligned with employee portal)
      const isJobFullyPaid = (job?.paymentProgress || 0) >= 100;
      const isExplicitCleared = inv.status === 'CLEARED' || inv.status === 'PAID' || job?.paymentStatus === 'CLEARED' || job?.paymentStatus === 'PAID';
      const isAmountCleared = totalAmount > 0 && pendingAmount <= 0 && totalReceived > 0;
      const isCleared = isJobFullyPaid || isExplicitCleared || isAmountCleared;

      // Determine date of creation / origin
      const rawDate = inv.createdAt || job?.ticket?.exactDate || job?.createdAt || new Date();
      const originDate = new Date(rawDate);
      const originYearMonth = `${originDate.getFullYear()}-${String(originDate.getMonth() + 1).padStart(2, '0')}`;

      // Determine clearance date (if cleared)
      let clearedDate = null;
      let clearedYearMonth = null;
      if (isCleared) {
        if (payments.length > 0) {
          clearedDate = new Date(payments[payments.length - 1].createdAt);
        } else {
          clearedDate = new Date(inv.updatedAt || inv.createdAt || new Date());
        }
        clearedYearMonth = `${clearedDate.getFullYear()}-${String(clearedDate.getMonth() + 1).padStart(2, '0')}`;
      }

      allBillableItems.push({
        id: `inv-${inv.id}`,
        invoiceId: inv.id,
        jobId: job?.id || null,
        ticketId: job?.ticket?.id || job?.ticketId || null,
        serialNo: job?.ticket?.serialNo || (job?.ticket?.id ? String(job.ticket.id) : String(inv.id)),
        invoiceRef: `I${job?.ticket?.serialNo || inv.id}`,
        docType: 'INVOICE',
        clientName: job?.clientName || 'General Client',
        branchName: job?.branchName || 'Main Branch',
        personOfContact: job?.personOfContact || 'Site Contact',
        workNature: job?.workNature || 'Maintenance',
        subject: job?.ticket?.subject || (job?.workNature ? `${job.workNature} Invoice` : 'Site Work Invoice'),
        assignedEmployee: job?.assignedEmployee ? {
          id: job.assignedEmployee.id,
          name: job.assignedEmployee.employeeName,
          email: job.assignedEmployee.email,
        } : (job?.manualEnteredBy ? { id: null, name: job.manualEnteredBy } : null),
        createdBy: inv.createdBy ? {
          id: inv.createdBy.id,
          name: inv.createdBy.employeeName,
        } : null,
        totalAmount,
        totalReceived,
        pendingAmount,
        paymentProgress: job?.paymentProgress || (totalAmount > 0 ? Math.round((totalReceived / totalAmount) * 100) : 0),
        status: isCleared ? 'CLEARED' : (job?.paymentStatus === 'PARTIAL' || totalReceived > 0 ? 'PARTIALLY_PAID' : (job?.paymentStatus || 'PENDING')),
        isCleared,
        clearedDate: clearedDate ? clearedDate.toISOString() : null,
        clearedYearMonth,
        originDate: originDate.toISOString(),
        originYearMonth,
        originMonthName: formatMonthName(originYearMonth),
        poNumber: inv.poNumber || null,
        imageUrl: inv.imageUrl || null,
        payments: payments.map(p => ({
          id: p.id,
          amount: p.amount,
          notes: p.summaryNotes,
          date: p.createdAt,
        })),
      });
    }

    // Process ALL remaining jobs (ensures every job in employee portal is visible to sub admin!)
    for (const job of jobs) {
      if (processedJobIds.has(job.id)) continue;

      const quotations = (job.quotationInvoices || []).filter(q => q.documentType === 'QUOTATION');
      const wcAmount = Number(job.workCompletion?.amount) || 0;
      const payments = job.payments || [];
      const totalReceived = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

      let totalAmount = 0;
      let docType = 'WORK_ORDER';
      let invoiceRef = `J${job.ticket?.serialNo || job.id}`;
      let poNumber = null;
      let imageUrl = null;

      if (quotations.length > 0) {
        docType = 'QUOTATION';
        invoiceRef = `Q${job.ticket?.serialNo || quotations[0].id}`;
        poNumber = quotations[0].poNumber || null;
        imageUrl = quotations[0].imageUrl || null;
        const qItems = parseLineItems(quotations[0].lineItems);
        totalAmount = qItems.reduce((s, it) => s + (Number(it.amount) || ((Number(it.qty) || 0) * (Number(it.rate) || 0)) || 0), 0);
      }
      if (totalAmount === 0 && wcAmount > 0) {
        totalAmount = wcAmount;
        imageUrl = imageUrl || job.workCompletion?.imageUrl || null;
      }
      if (totalAmount === 0 && totalReceived > 0) {
        totalAmount = totalReceived;
      }

      const pendingAmount = Math.max(0, totalAmount - totalReceived);

      // Status resolution matching employee dashboard updatePaymentStatus
      const isJobFullyPaid = (job.paymentProgress || 0) >= 100;
      const isExplicitCleared = job.paymentStatus === 'CLEARED' || job.paymentStatus === 'PAID';
      const isAmountCleared = totalAmount > 0 && pendingAmount <= 0 && totalReceived > 0;
      const isCleared = isJobFullyPaid || isExplicitCleared || isAmountCleared;

      let status = 'PENDING';
      if (isCleared) {
        status = 'CLEARED';
      } else if (job.paymentStatus === 'PARTIAL' || job.paymentStatus === 'PARTIALLY_PAID' || totalReceived > 0 || (job.paymentProgress || 0) > 0) {
        status = 'PARTIALLY_PAID';
      } else {
        status = job.paymentStatus || 'PENDING';
      }

      const rawDate = job.ticket?.exactDate || job.createdAt || new Date();
      const originDate = new Date(rawDate);
      const originYearMonth = `${originDate.getFullYear()}-${String(originDate.getMonth() + 1).padStart(2, '0')}`;

      let clearedDate = null;
      let clearedYearMonth = null;
      if (isCleared) {
        if (payments.length > 0) {
          clearedDate = new Date(payments[payments.length - 1].createdAt);
        } else {
          clearedDate = new Date(job.updatedAt || job.createdAt || new Date());
        }
        clearedYearMonth = `${clearedDate.getFullYear()}-${String(clearedDate.getMonth() + 1).padStart(2, '0')}`;
      }

      allBillableItems.push({
        id: `job-${job.id}`,
        invoiceId: null,
        jobId: job.id,
        ticketId: job.ticket?.id || job.ticketId || null,
        serialNo: job.ticket?.serialNo || String(job.id),
        invoiceRef,
        docType,
        clientName: job.clientName || 'General Client',
        branchName: job.branchName || 'Main Branch',
        personOfContact: job.personOfContact || 'Site Contact',
        workNature: job.workNature || 'Maintenance',
        subject: job.ticket?.subject || `${job.workNature || 'Completed'} Work Order`,
        assignedEmployee: job.assignedEmployee ? {
          id: job.assignedEmployee.id,
          name: job.assignedEmployee.employeeName,
          email: job.assignedEmployee.email,
        } : (job.manualEnteredBy ? { id: null, name: job.manualEnteredBy } : null),
        createdBy: job.createdBy ? {
          id: job.createdBy.id,
          name: job.createdBy.employeeName,
        } : null,
        totalAmount,
        totalReceived,
        pendingAmount,
        paymentProgress: job.paymentProgress || (totalAmount > 0 ? Math.round((totalReceived / totalAmount) * 100) : 0),
        status,
        isCleared,
        clearedDate: clearedDate ? clearedDate.toISOString() : null,
        clearedYearMonth,
        originDate: originDate.toISOString(),
        originYearMonth,
        originMonthName: formatMonthName(originYearMonth),
        poNumber,
        imageUrl,
        payments: payments.map(p => ({
          id: p.id,
          amount: p.amount,
          notes: p.summaryNotes,
          date: p.createdAt,
        })),
      });
    }

    // Process any unlinked tickets matching search query so Sub Admin can see pending intake tickets
    for (const ticket of unlinkedTickets) {
      const rawDate = ticket.exactDate || ticket.createdAt || new Date();
      const originDate = new Date(rawDate);
      const originYearMonth = `${originDate.getFullYear()}-${String(originDate.getMonth() + 1).padStart(2, '0')}`;

      allBillableItems.push({
        id: `ticket-${ticket.id}`,
        invoiceId: null,
        jobId: null,
        ticketId: ticket.id,
        serialNo: ticket.serialNo || String(ticket.id),
        invoiceRef: `T${ticket.serialNo || ticket.id}`,
        docType: 'TICKET',
        clientName: ticket.sender || 'Direct Client Entry',
        branchName: 'Pending Job Intake',
        personOfContact: 'Pending POC',
        workNature: 'Pending Intake',
        subject: ticket.subject || 'Incoming Ticket',
        assignedEmployee: ticket.createdBy ? {
          id: ticket.createdBy.id,
          name: ticket.createdBy.employeeName,
          email: ticket.createdBy.email,
        } : (ticket.statusLastChangedBy ? { id: null, name: ticket.statusLastChangedBy } : null),
        createdBy: ticket.createdBy ? {
          id: ticket.createdBy.id,
          name: ticket.createdBy.employeeName,
        } : null,
        totalAmount: 0,
        totalReceived: 0,
        pendingAmount: 0,
        paymentProgress: 0,
        status: 'PENDING',
        isCleared: false,
        clearedDate: null,
        clearedYearMonth: null,
        originDate: originDate.toISOString(),
        originYearMonth,
        originMonthName: formatMonthName(originYearMonth),
        poNumber: null,
        imageUrl: null,
        payments: [],
      });
    }

    // Filter by Employee if specified (or if employee role without all-access)
    let filteredItems = allBillableItems;
    if (employeeIdParam && employeeIdParam !== 'all') {
      const targetEmpId = Number(employeeIdParam);
      filteredItems = filteredItems.filter(item => item.assignedEmployee?.id === targetEmpId);
    } else if (sessionUser?.role === 'EMPLOYEE' && employeeIdParam !== 'all') {
      const userEmpId = sessionUser.id ? Number(sessionUser.id) : null;
      if (userEmpId) {
        // If employee specifies filter, default to their jobs or show tagged
        filteredItems = filteredItems.filter(item => 
          !item.assignedEmployee || item.assignedEmployee?.id === userEmpId
        );
      }
    }

    // Filter by Search Query (Subject, Ticket #, Serial #, Client, PO, etc.)
    if (searchParam) {
      const cleanNumeric = searchParam.replace(/^(ticket\s*#?|#|sr\s*#?|serial\s*#?|inv\s*#?|i)/i, '').trim();

      filteredItems = filteredItems.filter(item => {
        const itemSubject = (item.subject || '').toLowerCase();
        const itemSerial = (item.serialNo || '').toLowerCase();
        const itemTicketIdStr = item.ticketId != null ? String(item.ticketId) : '';
        const itemClient = (item.clientName || '').toLowerCase();
        const itemBranch = (item.branchName || '').toLowerCase();
        const itemRef = (item.invoiceRef || '').toLowerCase();
        const itemWorkNature = (item.workNature || '').toLowerCase();
        const itemEmployee = (item.assignedEmployee?.name || '').toLowerCase();
        const itemPo = (item.poNumber || '').toLowerCase();

        // 1. Subject match
        const matchSubject = itemSubject.includes(searchParam);

        // 2. Ticket ID match (supports "123", "Ticket #123", "#123", etc.)
        const matchTicket = Boolean(
          itemTicketIdStr && (
            itemTicketIdStr === searchParam ||
            itemTicketIdStr.includes(searchParam) ||
            (cleanNumeric && itemTicketIdStr === cleanNumeric) ||
            `ticket #${itemTicketIdStr}`.toLowerCase().includes(searchParam) ||
            `ticket ${itemTicketIdStr}`.toLowerCase().includes(searchParam) ||
            `#${itemTicketIdStr}`.toLowerCase().includes(searchParam)
          )
        );

        // 3. Serial Number match (supports exact or partial serial)
        const matchSerial = Boolean(
          itemSerial.includes(searchParam) ||
          (cleanNumeric && itemSerial.includes(cleanNumeric)) ||
          itemRef.includes(searchParam) ||
          (cleanNumeric && itemRef.includes(cleanNumeric))
        );

        // 4. Client / Branch / Employee / PO / Work Nature match
        const matchClient = itemClient.includes(searchParam) || itemBranch.includes(searchParam);
        const matchOther = itemEmployee.includes(searchParam) || itemPo.includes(searchParam) || itemWorkNature.includes(searchParam);

        if (searchField === 'subject') return matchSubject;
        if (searchField === 'ticket') return matchTicket;
        if (searchField === 'serial') return matchSerial;
        if (searchField === 'client') return matchClient;

        // Default 'all'
        return matchSubject || matchTicket || matchSerial || matchClient || matchOther;
      });
    }

    // Collect all available months for the month selector tabs
    const availableMonthsSet = new Set();
    // Include 2025, 2026, 2027 standard calendar months
    for (const y of [2025, 2026, 2027]) {
      for (let m = 1; m <= 12; m++) {
        availableMonthsSet.add(`${y}-${String(m).padStart(2, '0')}`);
      }
    }
    // Also include any months from real items
    allBillableItems.forEach(it => {
      if (it.originYearMonth) availableMonthsSet.add(it.originYearMonth);
      if (it.clearedYearMonth) availableMonthsSet.add(it.clearedYearMonth);
    });
    const allAvailableMonths = Array.from(availableMonthsSet).sort();

    // ──────────────────────────────────────────────────────────────────────────
    // IF 'ALL MONTHS' REQUESTED
    // ──────────────────────────────────────────────────────────────────────────
    if (isAllMonths) {
      const allTotalBilled = filteredItems.reduce((s, it) => s + it.totalAmount, 0);
      const allTotalReceived = filteredItems.reduce((s, it) => s + it.totalReceived, 0);
      const allTotalPending = filteredItems.reduce((s, it) => s + it.pendingAmount, 0);
      const allPendingCount = filteredItems.filter(it => it.pendingAmount > 0).length;
      const allClearedCount = filteredItems.filter(it => it.isCleared).length;

      return NextResponse.json({
        success: true,
        selectedMonth: 'all',
        selectedMonthName: 'All Recorded Months',
        currentYearMonth,
        stats: {
          currentMonth: {
            totalBilled: allTotalBilled,
            totalReceived: allTotalReceived,
            totalPending: allTotalPending,
            totalInvoices: filteredItems.length,
            pendingInvoices: allPendingCount,
            clearedInvoices: allClearedCount,
            clearancePercent: allTotalBilled > 0
              ? Math.round((allTotalReceived / allTotalBilled) * 100)
              : 0,
          },
          carryover: {
            totalOverduePending: 0,
            totalOverdueInvoices: 0,
            hasStrictNotice: false,
            priorMonthsBreakdown: [],
          },
        },
        currentMonthInvoices: filteredItems,
        overdueCarryoverInvoices: [],
        allAvailableMonths,
        employees,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // MONTHLY LOGIC IMPLEMENTATION (THE CORE REQUIREMENT)
    // ──────────────────────────────────────────────────────────────────────────
    const isSearching = Boolean(searchParam);

    // 1. Current Month Invoices: Originated in selectedMonth (or ALL matches if searching)
    const currentMonthInvoices = isSearching
      ? filteredItems
      : filteredItems.filter(item => item.originYearMonth === selectedMonth);

    const currentMonthTotalBilled = currentMonthInvoices.reduce((s, it) => s + it.totalAmount, 0);
    const currentMonthTotalReceived = currentMonthInvoices.reduce((s, it) => s + it.totalReceived, 0);
    const currentMonthTotalPending = currentMonthInvoices.reduce((s, it) => s + it.pendingAmount, 0);
    const currentMonthPendingCount = currentMonthInvoices.filter(it => it.pendingAmount > 0 || !it.isCleared).length;
    const currentMonthClearedCount = currentMonthInvoices.filter(it => it.isCleared).length;

    // 2. Overdue Carryover Invoices: Originated strictly in months BEFORE selectedMonth
    // Requirement rule:
    // If an invoice originated in December and was NOT cleared in January:
    // - In January: it must appear as RED HIGHLIGHTED with STRICT NOTICE.
    // - If it clears in February: in February it is cleared and NOT shown as overdue carryover.
    // - Else: the red highlight and strict notice shifts to February as well (and same for all months).
    const overdueCarryoverInvoices = [];
    const priorMonthsStatsMap = {}; // Map of "YYYY-MM" -> { totalInvoices, totalBilled, totalPending, pendingCount }

    // Pre-calculate total billed/invoices for all prior months from all items
    for (const item of filteredItems) {
      if (item.originYearMonth < selectedMonth) {
        if (!priorMonthsStatsMap[item.originYearMonth]) {
          priorMonthsStatsMap[item.originYearMonth] = {
            month: item.originYearMonth,
            monthName: item.originMonthName,
            totalBilled: 0,
            totalInvoices: 0,
            totalPendingCarried: 0,
            pendingCountCarried: 0,
          };
        }
        priorMonthsStatsMap[item.originYearMonth].totalBilled += item.totalAmount;
        priorMonthsStatsMap[item.originYearMonth].totalInvoices += 1;
      }
    }

    if (!isSearching) {
      for (const item of filteredItems) {
        if (item.originYearMonth < selectedMonth) {
          // Did this item clear BEFORE the end of selectedMonth?
          let isUnresolvedInSelectedMonth = false;

          if (!item.isCleared) {
            // Never cleared -> Unresolved and carried over!
            isUnresolvedInSelectedMonth = true;
          } else {
            // It was cleared, but WHEN?
            if (item.clearedYearMonth && item.clearedYearMonth > selectedMonth) {
              // Cleared in a future month (e.g. December payment cleared in February, viewing January)
              // So during selectedMonth (January), it was NOT yet cleared!
              isUnresolvedInSelectedMonth = true;
            }
            // If clearedYearMonth <= selectedMonth, then by selectedMonth it was already cleared,
            // so it does NOT carry forward into selectedMonth!
          }

          if (isUnresolvedInSelectedMonth) {
            // Compute months overdue
            const [origY, origM] = item.originYearMonth.split('-').map(Number);
            const diffMonths = (selYear - origY) * 12 + (selMonthNum - origM);

            overdueCarryoverInvoices.push({
              ...item,
              isOverdueCarryover: true,
              monthsOverdue: diffMonths,
              highlightRed: true,
              strictNotice: `STRICT NOTICE: Overdue payment carried over from ${item.originMonthName}!`,
            });

            // Accumulate into prior month stats
            if (priorMonthsStatsMap[item.originYearMonth]) {
              priorMonthsStatsMap[item.originYearMonth].totalPendingCarried += item.pendingAmount;
              priorMonthsStatsMap[item.originYearMonth].pendingCountCarried += 1;
            }
          }
        }
      }
    }

    // Convert prior months map to sorted array (most recent prior month first)
    const priorMonthsBreakdown = Object.values(priorMonthsStatsMap)
      .filter(pm => pm.pendingCountCarried > 0)
      .sort((a, b) => b.month.localeCompare(a.month));

    const totalOverduePendingAmount = overdueCarryoverInvoices.reduce((s, it) => s + it.pendingAmount, 0);
    const totalOverdueInvoicesCount = overdueCarryoverInvoices.length;

    return NextResponse.json({
      success: true,
      selectedMonth,
      selectedMonthName: formatMonthName(selectedMonth),
      currentYearMonth,
      isSearchActive: isSearching,
      searchResults: isSearching ? filteredItems : [],
      stats: {
        currentMonth: {
          totalBilled: currentMonthTotalBilled,
          totalReceived: currentMonthTotalReceived,
          totalPending: currentMonthTotalPending,
          totalInvoices: currentMonthInvoices.length,
          pendingInvoices: currentMonthPendingCount,
          clearedInvoices: currentMonthClearedCount,
          clearancePercent: currentMonthTotalBilled > 0
            ? Math.round((currentMonthTotalReceived / currentMonthTotalBilled) * 100)
            : 0,
        },
        carryover: {
          totalOverduePending: totalOverduePendingAmount,
          totalOverdueInvoices: totalOverdueInvoicesCount,
          hasStrictNotice: totalOverdueInvoicesCount > 0,
          priorMonthsBreakdown,
        },
      },
      currentMonthInvoices,
      overdueCarryoverInvoices,
      allAvailableMonths,
      employees,
    });
  } catch (error) {
    console.error('Pending payments API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch pending payments' },
      { status: 500 }
    );
  }
}
