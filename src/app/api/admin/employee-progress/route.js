import { NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULT_ALIASES = {
  'Rizwan Hussain': 'Ali Shehzad (Batch 1)',
  'Ali Shezad': 'Ali Shehzad (Batch 1)',
  'Ali Shehzad': 'Ali Shehzad (Batch 1)',
  'Ibrahim': 'Muhammad Ibrahim (Batch 2)',
  'Muhammad Ibrahim': 'Muhammad Ibrahim (Batch 2)',
  'Shahzaib': 'Shah Zaib (Batch 3)',
  'Shah Zaib': 'Shah Zaib (Batch 3)',
  'Sermad Islam': 'Sarmad Islam (Batch 4)',
  'Sarmad Islam': 'Sarmad Islam (Batch 4)',
};

function getTicketEntryPerson(ticket) {
  return (
    ticket.statusLastChangedBy ||
    ticket.jobMetadata?.assignedEmployee?.employeeName ||
    ticket.jobMetadata?.createdBy?.employeeName ||
    ticket.jobMetadata?.manualEnteredBy ||
    'Unassigned / Auto-Ingested'
  );
}

function getMappedBatch(rawName, aliasMap = DEFAULT_ALIASES) {
  if (!rawName) return 'Unassigned / Auto-Ingested';
  if (aliasMap[rawName]) return aliasMap[rawName];
  const lower = rawName.toLowerCase().trim();
  for (const [key, val] of Object.entries(aliasMap)) {
    if (key.toLowerCase().trim() === lower) return val;
    if (lower.includes('rizwan') && key.toLowerCase().includes('rizwan')) return val;
    if (lower.includes('ibrahim') && key.toLowerCase().includes('ibrahim')) return val;
    if (
      (lower.includes('shahzaib') || lower.includes('shah zaib')) &&
      (key.toLowerCase().includes('shahzaib') || key.toLowerCase().includes('shah zaib'))
    ) {
      return val;
    }
    if (
      (lower.includes('sermad') || lower.includes('sarmad')) &&
      (key.toLowerCase().includes('sermad') || key.toLowerCase().includes('sarmad'))
    ) {
      return val;
    }
  }
  return rawName;
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

function calculateJobBilledAmount(job) {
  if (!job) return 0;
  // 1. Invoices line items sum
  const invoices = (job.quotationInvoices || []).filter((q) => q.documentType === 'INVOICE');
  for (const inv of invoices) {
    const items = parseLineItems(inv.lineItems);
    const sum = items.reduce(
      (s, it) =>
        s +
        (Number(it.amount) ||
          Number(it.qty || it.quantity || 0) * Number(it.rate || it.unitPrice || 0) ||
          0),
      0
    );
    if (sum > 0) return sum;
  }

  // 2. Quotation line items sum
  const quotes = (job.quotationInvoices || []).filter((q) => q.documentType === 'QUOTATION');
  for (const quote of quotes) {
    const items = parseLineItems(quote.lineItems);
    const sum = items.reduce(
      (s, it) =>
        s +
        (Number(it.amount) ||
          Number(it.qty || it.quantity || 0) * Number(it.rate || it.unitPrice || 0) ||
          0),
      0
    );
    if (sum > 0) return sum;
  }

  // 3. Work completion recorded amount
  if (job.workCompletion?.amount && Number(job.workCompletion.amount) > 0) {
    return Number(job.workCompletion.amount);
  }

  // 4. Bank approval amount
  if (job.bankApproval?.amount && Number(job.bankApproval.amount) > 0) {
    return Number(job.bankApproval.amount);
  }

  // 5. Total payments received
  const paymentsSum = (job.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return paymentsSum;
}

function computeTicketPendingDetails(ticket) {
  const pendingItems = [];
  const job = ticket.jobMetadata;

  if (!job) {
    const isExcluded = ticket.status === 'IRRELEVANT' || ticket.status === 'CANCELLED';
    if (!isExcluded) {
      pendingItems.push({
        type: 'INTAKE',
        badge: '🚨 Job Intake Pending',
        desc: 'Ticket not converted into Job Intake',
        color: '#ef4444',
      });
    }
    return {
      hasJob: false,
      intakePending: !isExcluded,
      surveyPending: false,
      quotationPending: false,
      bankApprovalPending: false,
      workCompletionPending: false,
      invoicePending: false,
      paymentPending: false,
      billedAmount: 0,
      receivedAmount: 0,
      pendingPaymentAmount: 0,
      paymentStatus: 'NOT_ENTERED',
      pendingItems,
      hasPending: pendingItems.length > 0,
    };
  }

  // 1. Survey Report
  const surveyPending = !job.surveyReport;
  if (surveyPending) {
    pendingItems.push({
      type: 'SURVEY',
      badge: '📋 Survey Report Pending',
      desc: 'Site survey and report text not submitted',
      color: '#f59e0b',
    });
  }

  // 2. Quotation
  const quotes = (job.quotationInvoices || []).filter((q) => q.documentType === 'QUOTATION');
  const quotationNotCreated = quotes.length === 0;
  const quotationUnapproved = quotes.some((q) => q.status === 'PENDING');
  const quotationPending = quotationNotCreated || quotationUnapproved;
  if (quotationNotCreated) {
    pendingItems.push({
      type: 'QUOTATION',
      badge: '💼 Quotation Missing',
      desc: 'Quotation document not prepared',
      color: '#38bdf8',
    });
  } else if (quotationUnapproved) {
    pendingItems.push({
      type: 'QUOTATION_APPROVAL',
      badge: '💼 Quotation Approval Pending',
      desc: 'Quotation submitted, awaiting client/bank approval',
      color: '#38bdf8',
    });
  }

  // 3. Bank Approval
  const bankApprovalPending = !job.bankApproval || job.bankApproval.status === 'PENDING';
  if (!job.bankApproval) {
    pendingItems.push({
      type: 'BANK_APPROVAL',
      badge: '🏛️ Bank Approval Missing',
      desc: 'Bank approval not recorded',
      color: '#a78bfa',
    });
  } else if (job.bankApproval.status === 'PENDING') {
    pendingItems.push({
      type: 'BANK_APPROVAL',
      badge: '🏛️ Bank Approval Awaiting',
      desc: 'Bank approval pending confirmation',
      color: '#a78bfa',
    });
  }

  // 4. Work Completion
  const wc = job.workCompletion;
  const workCompletionPending = !wc || (wc.status !== 'COMPLETED' && wc.status !== 'CLEARED');
  if (!wc) {
    pendingItems.push({
      type: 'WORK_COMPLETION',
      badge: '🔨 Work Completion Pending',
      desc: 'Work execution report not completed',
      color: '#ec4899',
    });
  } else if (wc.status !== 'COMPLETED' && wc.status !== 'CLEARED') {
    pendingItems.push({
      type: 'WORK_COMPLETION',
      badge: `🔨 Work In Progress (${wc.status || 'Pending'})`,
      desc: 'Work status pending completion',
      color: '#ec4899',
    });
  }

  // 5. Invoice
  const invoices = (job.quotationInvoices || []).filter((q) => q.documentType === 'INVOICE');
  const invoicePending = invoices.length === 0;
  if (invoicePending) {
    pendingItems.push({
      type: 'INVOICE',
      badge: '🧾 Invoice Pending',
      desc: 'Final bill/invoice document not generated',
      color: '#f97316',
    });
  }

  // 6. Payments
  const billedAmount = calculateJobBilledAmount(job);
  const payments = job.payments || [];
  const receivedAmount = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const pendingPaymentAmount = Math.max(0, billedAmount - receivedAmount);
  const isJobProgressPaid = (job.paymentProgress || 0) >= 100;
  const isExplicitCleared = job.paymentStatus === 'CLEARED' || job.paymentStatus === 'PAID';
  const isAmountCleared = billedAmount > 0 && pendingPaymentAmount <= 0;
  const isCleared = isJobProgressPaid || isExplicitCleared || isAmountCleared;

  const paymentPending = !isCleared && (pendingPaymentAmount > 0 || (billedAmount === 0 && receivedAmount === 0));

  let paymentStatus = 'CLEARED';
  if (isCleared) {
    paymentStatus = 'CLEARED';
  } else if (receivedAmount > 0) {
    paymentStatus = 'PARTIALLY_PAID';
  } else if (billedAmount > 0) {
    paymentStatus = 'UNPAID';
  } else {
    paymentStatus = 'PENDING';
  }

  if (paymentPending) {
    if (pendingPaymentAmount > 0) {
      pendingItems.push({
        type: 'PAYMENT',
        badge: `💰 Payment Pending (Rs. ${pendingPaymentAmount.toLocaleString()})`,
        desc: `Billed: Rs. ${billedAmount.toLocaleString()} | Received: Rs. ${receivedAmount.toLocaleString()}`,
        color: '#eab308',
        amount: pendingPaymentAmount,
      });
    } else {
      pendingItems.push({
        type: 'PAYMENT',
        badge: '💰 Payment Pending (Unbilled)',
        desc: 'Work intake active, invoice and payment pending',
        color: '#eab308',
        amount: 0,
      });
    }
  }

  return {
    hasJob: true,
    intakePending: false,
    surveyPending,
    quotationPending,
    bankApprovalPending,
    workCompletionPending,
    invoicePending,
    paymentPending,
    billedAmount,
    receivedAmount,
    pendingPaymentAmount,
    paymentStatus,
    pendingItems,
    hasPending: pendingItems.length > 0,
  };
}

function generateWhatsAppMessage({ personName, tenureLabel, metrics, pendingComplaints }) {
  const line = '━━━━━━━━━━━━━━━━━━━━';
  let msg = `📊 *NEXUS OPERATIONS — PERFORMANCE & PENDING REPORT*\n${line}\n`;
  msg += `👤 *Staff Member:* ${personName}\n`;
  msg += `📅 *Tenure Period:* ${tenureLabel}\n`;
  msg += `🕒 *Report Date:* ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}\n${line}\n\n`;

  msg += `📈 *PROGRESS OVERVIEW:*\n`;
  msg += `• *Total Assigned Complaints:* ${metrics.totalComplaints}\n`;
  msg += `• *Job Intakes Completed:* ${metrics.intakesDone} (${metrics.intakeRate}%)\n`;
  msg += `• *Job Intakes Pending:* ${metrics.intakesPending}\n`;
  msg += `• *Payments Received:* Rs. ${metrics.paymentsReceivedTotal.toLocaleString()} (${metrics.paymentsReceivedCount} payments)\n`;
  msg += `• *Payments Pending:* Rs. ${metrics.paymentsPendingTotal.toLocaleString()} (${metrics.paymentsPendingCount} jobs)\n\n`;

  msg += `⚠️ *PENDING ACTIONS SUMMARY:*\n`;
  if (metrics.intakesPending > 0) msg += `• 🚨 Intakes Pending: ${metrics.intakesPending}\n`;
  if (metrics.surveysPending > 0) msg += `• 📋 Surveys Pending: ${metrics.surveysPending}\n`;
  if (metrics.quotationsPending > 0) msg += `• 💼 Quotations Pending: ${metrics.quotationsPending}\n`;
  if (metrics.bankApprovalsPending > 0) msg += `• 🏛️ Bank Approvals Pending: ${metrics.bankApprovalsPending}\n`;
  if (metrics.workCompletionsPending > 0) msg += `• 🔨 Work Completions Pending: ${metrics.workCompletionsPending}\n`;
  if (metrics.invoicesPending > 0) msg += `• 🧾 Invoices Pending: ${metrics.invoicesPending}\n`;
  if (metrics.paymentsPendingCount > 0) msg += `• 💰 Payments Pending: ${metrics.paymentsPendingCount} (Rs. ${metrics.paymentsPendingTotal.toLocaleString()})\n`;
  if (metrics.totalPendingThingsCount === 0) {
    msg += `• ✅ ALL COMPLAINTS FULLY COMPLETED & CLEARED!\n`;
  }
  msg += `\n${line}\n`;

  if (pendingComplaints && pendingComplaints.length > 0) {
    msg += `📌 *DETAILED PENDING COMPLAINTS (${pendingComplaints.length}):*\n\n`;
    const maxListed = Math.min(pendingComplaints.length, 25);
    for (let i = 0; i < maxListed; i++) {
      const c = pendingComplaints[i];
      const client = c.jobMetadata?.clientName || 'General';
      const branch = c.jobMetadata?.branchName ? ` - ${c.jobMetadata.branchName}` : '';
      const pendingStr =
        c.pendingSummary?.pendingItems
          ?.map((it) => it.badge.replace(/[^\w\s\(\)\:\.\,]/gi, '').trim())
          .join(' | ') || 'Pending';
      msg += `${i + 1}. *[${c.serialNo || c.id}]* ${client}${branch}\n`;
      msg += `   • Subject: ${c.subject || 'Complaint'}\n`;
      msg += `   • *Pending:* ${pendingStr}\n\n`;
    }
    if (pendingComplaints.length > maxListed) {
      msg += `_...and ${pendingComplaints.length - maxListed} more pending complaints._\n\n`;
    }
    msg += `${line}\n`;
  }

  msg += `⚡ *Action Required:* Please review the pending items listed above and update their status in the portal.\n`;
  msg += `Generated via NEXUS Operations Portal`;
  return msg;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const monthParam = searchParams.get('month'); // YYYY-MM
    const excludeIrrelevantParam = searchParams.get('excludeIrrelevant');
    const aliasesParam = searchParams.get('aliases');
    const dateFieldParam = searchParams.get('dateField') || 'exactDate'; // 'exactDate' or 'createdAt'

    const excludeIrrelevant = excludeIrrelevantParam !== 'false';

    let aliasMap = { ...DEFAULT_ALIASES };
    if (aliasesParam) {
      try {
        const parsed = JSON.parse(aliasesParam);
        aliasMap = { ...aliasMap, ...parsed };
      } catch (e) {
        console.error('Failed to parse custom aliases:', e);
      }
    }

    let startDate;
    let endDate;
    let tenureLabel = 'Custom Period';

    if (fromParam && toParam) {
      startDate = new Date(`${fromParam}T00:00:00.000Z`);
      endDate = new Date(`${toParam}T23:59:59.999Z`);
      tenureLabel = `${fromParam} to ${toParam}`;
    } else if (monthParam) {
      const [yearStr, monthStr] = monthParam.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1;
      startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
      const monthDate = new Date(year, month, 1);
      tenureLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      const now = new Date();
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
      tenureLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    const dateFilter = {
      gte: startDate,
      lte: endDate,
    };

    const whereClause = dateFieldParam === 'createdAt'
      ? { createdAt: dateFilter }
      : { exactDate: dateFilter };

    const { rawTickets, employees } = await withDbRetry(async () => {
      const tickets = await prisma.ticket.findMany({
        where: whereClause,
        include: {
          jobMetadata: {
            include: {
              assignedEmployee: {
                select: { id: true, employeeName: true, email: true },
              },
              createdBy: {
                select: { id: true, employeeName: true, email: true },
              },
              surveyReport: true,
              quotationInvoices: {
                orderBy: { createdAt: 'desc' },
              },
              bankApproval: true,
              workCompletion: true,
              payments: {
                orderBy: { createdAt: 'asc' },
              },
              expenses: {
                select: { id: true, amount: true, status: true, category: true },
              },
            },
          },
          createdBy: {
            select: { id: true, employeeName: true, email: true },
          },
        },
        orderBy: {
          exactDate: 'asc',
        },
      });

      const emps = await prisma.user.findMany({
        where: { role: 'EMPLOYEE' },
        select: { id: true, employeeName: true, email: true, activeStatus: true },
        orderBy: { employeeName: 'asc' },
      });

      return { rawTickets: tickets, employees: emps };
    });

    // Map each ticket with its entry person, batches, and pending items
    const mappedTickets = rawTickets.map((t) => {
      const entryPerson = getTicketEntryPerson(t);
      const batchName = getMappedBatch(entryPerson, aliasMap);
      const pendingSummary = computeTicketPendingDetails(t);

      return {
        id: t.id,
        serialNo: t.serialNo,
        exactDate: t.exactDate,
        time: t.time,
        sender: t.sender,
        subject: t.subject,
        status: t.status,
        statusLastChangedBy: t.statusLastChangedBy,
        entryPerson,
        batchName,
        jobIntakeDone: pendingSummary.hasJob,
        intakePending: pendingSummary.intakePending,
        surveyPending: pendingSummary.surveyPending,
        quotationPending: pendingSummary.quotationPending,
        bankApprovalPending: pendingSummary.bankApprovalPending,
        workCompletionPending: pendingSummary.workCompletionPending,
        invoicePending: pendingSummary.invoicePending,
        paymentPending: pendingSummary.paymentPending,
        billedAmount: pendingSummary.billedAmount,
        receivedAmount: pendingSummary.receivedAmount,
        pendingPaymentAmount: pendingSummary.pendingPaymentAmount,
        paymentStatus: pendingSummary.paymentStatus,
        pendingSummary,
        jobMetadata: t.jobMetadata
          ? {
              id: t.jobMetadata.id,
              clientName: t.jobMetadata.clientName,
              branchName: t.jobMetadata.branchName,
              personOfContact: t.jobMetadata.personOfContact,
              workNature: t.jobMetadata.workNature,
              paymentProgress: t.jobMetadata.paymentProgress || 0,
              paymentStatus: t.jobMetadata.paymentStatus || 'PENDING',
              assignedEmployee: t.jobMetadata.assignedEmployee?.employeeName || null,
              hasSurvey: !!t.jobMetadata.surveyReport,
              quotesCount: (t.jobMetadata.quotationInvoices || []).filter((q) => q.documentType === 'QUOTATION').length,
              invoicesCount: (t.jobMetadata.quotationInvoices || []).filter((q) => q.documentType === 'INVOICE').length,
              hasBankApproval: !!t.jobMetadata.bankApproval,
              workStatus: t.jobMetadata.workCompletion?.status || 'NOT_STARTED',
              paymentsCount: (t.jobMetadata.payments || []).length,
            }
          : null,
      };
    });

    // Filter tickets if excludeIrrelevant is set
    const filteredTickets = excludeIrrelevant
      ? mappedTickets.filter((t) => t.status !== 'IRRELEVANT')
      : mappedTickets;

    // Group complaints by Person / Batch
    const batchMap = {};
    filteredTickets.forEach((t) => {
      const bName = t.batchName;
      if (!batchMap[bName]) {
        batchMap[bName] = [];
      }
      batchMap[bName].push(t);
    });

    // Compute metrics for each person/batch
    const personsSummary = Object.keys(batchMap).map((bName) => {
      const tickets = batchMap[bName];
      const personName = bName.split('(')[0].trim();
      const totalComplaints = tickets.length;
      const intakesDone = tickets.filter((t) => t.jobIntakeDone).length;
      const intakesPending = tickets.filter((t) => t.intakePending).length;
      const intakeRate = totalComplaints > 0 ? Math.round((intakesDone / totalComplaints) * 100) : 0;

      const paymentsReceivedTotal = tickets.reduce((s, t) => s + (t.receivedAmount || 0), 0);
      const paymentsReceivedCount = tickets.filter((t) => (t.receivedAmount || 0) > 0).length;

      const paymentsPendingTotal = tickets.reduce((s, t) => s + (t.pendingPaymentAmount || 0), 0);
      const paymentsPendingCount = tickets.filter((t) => t.paymentPending).length;

      const surveysPendingCount = tickets.filter((t) => t.surveyPending).length;
      const quotationsPendingCount = tickets.filter((t) => t.quotationPending).length;
      const bankApprovalsPendingCount = tickets.filter((t) => t.bankApprovalPending).length;
      const workCompletionsPendingCount = tickets.filter((t) => t.workCompletionPending).length;
      const invoicesPendingCount = tickets.filter((t) => t.invoicePending && t.jobIntakeDone).length;

      const pendingComplaints = tickets.filter((t) => t.pendingSummary?.hasPending);
      const totalPendingThingsCount =
        intakesPending +
        surveysPendingCount +
        quotationsPendingCount +
        bankApprovalsPendingCount +
        workCompletionsPendingCount +
        invoicesPendingCount +
        paymentsPendingCount;

      const metrics = {
        totalComplaints,
        intakesDone,
        intakesPending,
        intakeRate,
        paymentsReceivedTotal,
        paymentsReceivedCount,
        paymentsPendingTotal,
        paymentsPendingCount,
        surveysPendingCount,
        quotationsPendingCount,
        bankApprovalsPendingCount,
        workCompletionsPendingCount,
        invoicesPendingCount,
        totalPendingThingsCount,
      };

      const whatsappMessage = generateWhatsAppMessage({
        personName,
        tenureLabel,
        metrics,
        pendingComplaints,
      });

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

      return {
        batchName: bName,
        personName,
        metrics,
        pendingComplaintsCount: pendingComplaints.length,
        pendingComplaints,
        allComplaints: tickets,
        whatsappMessage,
        whatsappUrl,
      };
    });

    // Sort persons summary (Batch 1, 2, 3, 4 first, then others, then Unassigned)
    personsSummary.sort((a, b) => {
      const getOrder = (name) => {
        if (name.includes('Batch 1')) return 1;
        if (name.includes('Batch 2')) return 2;
        if (name.includes('Batch 3')) return 3;
        if (name.includes('Batch 4')) return 4;
        if (name.includes('Unassigned')) return 99;
        return 50;
      };
      const orderA = getOrder(a.batchName);
      const orderB = getOrder(b.batchName);
      if (orderA !== orderB) return orderA - orderB;
      return a.batchName.localeCompare(b.batchName);
    });

    // Overall Company Stats for this tenure
    const totalTicketsInTenure = filteredTickets.length;
    const totalIntakesDone = filteredTickets.filter((t) => t.jobIntakeDone).length;
    const totalIntakesPending = filteredTickets.filter((t) => t.intakePending).length;
    const overallIntakeRate =
      totalTicketsInTenure > 0 ? Math.round((totalIntakesDone / totalTicketsInTenure) * 100) : 0;
    const totalPaymentsReceived = filteredTickets.reduce((s, t) => s + (t.receivedAmount || 0), 0);
    const totalPaymentsPending = filteredTickets.reduce(
      (s, t) => s + (t.pendingPaymentAmount || 0),
      0
    );
    const totalPendingComplaints = filteredTickets.filter((t) => t.pendingSummary?.hasPending).length;

    const overallStats = {
      totalTickets: totalTicketsInTenure,
      totalIntakesDone,
      totalIntakesPending,
      overallIntakeRate,
      totalPaymentsReceived,
      totalPaymentsPending,
      totalPendingComplaints,
      totalPendingSurveys: filteredTickets.filter((t) => t.surveyPending).length,
      totalPendingQuotations: filteredTickets.filter((t) => t.quotationPending).length,
      totalPendingApprovals: filteredTickets.filter((t) => t.bankApprovalPending).length,
      totalPendingWorkCompletions: filteredTickets.filter((t) => t.workCompletionPending).length,
      totalPendingInvoices: filteredTickets.filter((t) => t.invoicePending && t.jobIntakeDone).length,
    };

    return NextResponse.json({
      success: true,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      tenureLabel,
      totalTickets: mappedTickets.length,
      filteredTicketsCount: filteredTickets.length,
      employees,
      overallStats,
      personsSummary,
      tickets: mappedTickets,
    });
  } catch (error) {
    console.error('Error in employee progress API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch employee progress' },
      { status: 500 }
    );
  }
}
