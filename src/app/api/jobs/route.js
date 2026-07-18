import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const WORK_NATURES = ['ELECTRICAL', 'WAPDA', 'MAINTENANCE', 'PROJECT'];

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
    const user = getUserFromCookie(request);
    let whereClause = undefined;

    if (user && user.role === 'EMPLOYEE') {
      const empId = user.id ? Number(user.id) : null;
      if (empId && !isNaN(empId)) {
        whereClause = { assignedEmployeeId: empId };
      }
      // If employee has no valid ID (e.g. PIN login), show ALL jobs (no filter)
      // so the dashboard is never empty due to broken cookie
    }

    let jobs = [];

    // Attempt 1: Full query with all relations
    try {
      jobs = await prisma.jobMetadata.findMany({
        where: whereClause,
        orderBy: { id: 'asc' },
        include: {
          ticket: true,
          createdBy: { select: { id: true, employeeName: true, email: true } },
          assignedEmployee: { select: { id: true, employeeName: true, email: true } },
          surveyReport: { select: { id: true, reportText: true, imageUrl: true, createdAt: true, createdBy: { select: { id: true, employeeName: true } } } },
          quotationInvoices: { select: { id: true, documentType: true, status: true, lineItems: true, poNumber: true, imageUrl: true, createdAt: true, createdBy: { select: { id: true, employeeName: true } } } },
          expenses: { select: { id: true, amount: true, summaryNotes: true, imageUrl: true, createdAt: true } },
          payments: { select: { id: true, amount: true, summaryNotes: true, imageUrl: true, createdAt: true } },
          workCompletion: { select: { id: true, status: true, amount: true, imageUrl: true, notes: true, createdAt: true, updatedAt: true } },
          bankApproval: { select: { id: true, bankName: true, accountNumber: true, amount: true, status: true, imageUrl: true, notes: true, createdAt: true } },
        },
      });
    } catch (fullErr) {
      console.warn('Full jobs query failed, trying without new relations:', fullErr.message);
      // Attempt 2: Without workCompletion/bankApproval
      try {
        jobs = await prisma.jobMetadata.findMany({
          where: whereClause,
          orderBy: { id: 'asc' },
          include: {
            ticket: true,
            createdBy: { select: { id: true, employeeName: true, email: true } },
            assignedEmployee: { select: { id: true, employeeName: true, email: true } },
            surveyReport: { select: { id: true, reportText: true, imageUrl: true, createdAt: true } },
            quotationInvoices: { select: { id: true, documentType: true, status: true, lineItems: true, poNumber: true, imageUrl: true, createdAt: true } },
            expenses: { select: { id: true, amount: true, summaryNotes: true, imageUrl: true, createdAt: true } },
            payments: { select: { id: true, amount: true, summaryNotes: true, imageUrl: true, createdAt: true } },
          },
        });
      } catch (medErr) {
        console.warn('Medium jobs query failed, trying minimal:', medErr.message);
        // Attempt 3: Minimal query
        try {
          jobs = await prisma.jobMetadata.findMany({
            where: whereClause,
            orderBy: { id: 'asc' },
            include: {
              ticket: true,
              assignedEmployee: { select: { id: true, employeeName: true, email: true } },
            },
          });
        } catch (minErr) {
          console.error('All job queries failed:', minErr.message);
          jobs = [];
        }
      }
    }

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Jobs fetch error:', error);
    const message = error.message || 'Unknown error';
    const code = error.code || '';
    let meta = '';
    try { meta = error.meta ? JSON.stringify(error.meta) : ''; } catch { meta = ''; }
    return NextResponse.json({ error: 'Failed to fetch jobs', details: message, code, meta }, { status: 500 });
  }
}


export async function POST(request) {
  try {
    const { ticketId, clientName, branchName, personOfContact, workNature, assignedEmployeeId, manualEnteredBy } =
      await request.json();
    const user = getUserFromCookie(request);
    const parsedId = user?.id ? Number(user.id) : null;
    const userId = (parsedId && !isNaN(parsedId)) ? parsedId : null;

    if (!ticketId || !clientName || !branchName || !personOfContact || !workNature) {
      return NextResponse.json({ error: 'All job metadata fields are required' }, { status: 400 });
    }

    if (!WORK_NATURES.includes(workNature)) {
      return NextResponse.json({ error: 'Invalid work nature' }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
      include: { jobMetadata: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    if (ticket.jobMetadata) {
      return NextResponse.json({ error: 'Ticket already has job metadata' }, { status: 409 });
    }

    const job = await prisma.jobMetadata.create({
      data: {
        ticketId: Number(ticketId),
        clientName,
        branchName,
        personOfContact,
        workNature,
        assignedEmployeeId: assignedEmployeeId ? Number(assignedEmployeeId) : null,
        manualEnteredBy: manualEnteredBy || null,
        createdById: userId,
      },
      include: {
        ticket: true,
        createdBy: { select: { id: true, employeeName: true, email: true } },
        assignedEmployee: { select: { id: true, employeeName: true, email: true } },
      },
    });

    // Auto-mark ticket as RELEVANT when intake/job is created
    await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: { status: 'RELEVANT' },
    }).catch(() => {}); // Non-fatal — don't fail the job creation

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error('Job create error:', error);
    const message = error.message || 'Failed to create job metadata';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}