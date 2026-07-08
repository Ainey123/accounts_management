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
      whereClause = { assignedEmployeeId: user.id };
    }

    // Use raw SQL to avoid Prisma client/schema mismatch issues
    // This ensures the dashboard loads even if new DB columns don't exist yet
    const employeeFilter = user && user.role === 'EMPLOYEE' ? `AND jm."assignedEmployeeId" = ${user.id}` : '';
    
    const rows = await prisma.$queryRawUnsafe(`
      SELECT 
        jm.id, jm."ticketId", jm."clientName", jm."branchName", jm."personOfContact",
        jm."workNature", jm."assignedEmployeeId", jm."manualEnteredBy", jm."createdById",
        jm."createdAt", jm."updatedAt", jm."paymentProgress",
        t.id as "ticket_id", t."serialNo" as "ticket_serialNo", t.subject as "ticket_subject", t.sender as "ticket_sender",
        u.id as "employee_id", u."employeeName" as "employee_name", u.email as "employee_email"
      FROM "JobMetadata" jm
      LEFT JOIN "Ticket" t ON t.id = jm."ticketId"
      LEFT JOIN "User" u ON u.id = jm."assignedEmployeeId"
      WHERE 1=1 ${employeeFilter}
      ORDER BY jm.id DESC
    `);

    // Map raw rows to the expected format
    const jobs = rows.map(row => ({
      id: row.id,
      ticketId: row.ticketId,
      clientName: row.clientName,
      branchName: row.branchName,
      personOfContact: row.personOfContact,
      workNature: row.workNature,
      assignedEmployeeId: row.assignedEmployeeId,
      manualEnteredBy: row.manualEnteredBy,
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      paymentProgress: row.paymentProgress,
      paymentStatus: 'PENDING',
      ticket: row.ticket_id ? {
        id: row.ticket_id,
        serialNo: row.ticket_serialNo,
        subject: row.ticket_subject,
        sender: row.ticket_sender,
      } : null,
      assignedEmployee: row.employee_id ? {
        id: row.employee_id,
        employeeName: row.employee_name,
        email: row.employee_email,
      } : null,
      surveyReport: null,
      quotationInvoices: [],
      expenses: [],
      payments: [],
      workCompletion: null,
      bankApproval: null,
    }));

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Jobs fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { ticketId, clientName, branchName, personOfContact, workNature, assignedEmployeeId, manualEnteredBy } =
      await request.json();
    const user = getUserFromCookie(request);
    const userId = user?.id || null;

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

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error('Job create error:', error);
    const message = error.message || 'Failed to create job metadata';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}