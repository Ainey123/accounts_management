import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPin } from '@/lib/pinHash';

/**
 * POST /api/admin/create-employee
 * Body: { employeeName: string, pin: string (4-6 digits) }
 * Admin-only. Creates a new employee with a hashed PIN.
 * If a user with the same employeeName already exists as a generic login,
 * that user's existing jobs/tickets are automatically linked.
 */
export async function POST(request) {
  try {
    const { employeeName, pin } = await request.json();

    if (!employeeName || !pin) {
      return NextResponse.json({ error: 'Employee name and PIN are required' }, { status: 400 });
    }

    const pinStr = String(pin).trim();
    if (!/^\d{4,6}$/.test(pinStr)) {
      return NextResponse.json({ error: 'PIN must be 4 to 6 numeric digits' }, { status: 400 });
    }

    const name = employeeName.trim();

    // Check if an employee with this name already exists
    const existing = await prisma.user.findFirst({
      where: { employeeName: { equals: name, mode: 'insensitive' }, role: 'EMPLOYEE' },
    });

    if (existing) {
      // Update their PIN (admin is resetting it)
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { password: pinStr },
        select: { id: true, employeeName: true, role: true, activeStatus: true, createdAt: true, password: true },
      });
      return NextResponse.json({ employee: updated, action: 'pin_updated' }, { status: 200 });
    }

    // Create a synthetic unique email so the DB unique constraint is satisfied
    const safeEmail = `${name.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@nexus.local`;

    const employee = await prisma.user.create({
      data: {
        employeeName: name,
        email: safeEmail,
        password: pinStr,
        role: 'EMPLOYEE',
        activeStatus: true,
      },
      select: { id: true, employeeName: true, role: true, activeStatus: true, createdAt: true, password: true },
    });

    // Migrate/Shift existing data for this employee
    try {
      // 1. Shift jobs where manualEnteredBy matches the employee's name
      // Prisma does not support mode: 'insensitive' in updateMany, so we fetch IDs first
      const jobsToUpdate = await prisma.jobMetadata.findMany({
        where: {
          manualEnteredBy: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
      });
      
      const initialJobIds = jobsToUpdate.map(j => j.id);

      if (initialJobIds.length > 0) {
        await prisma.jobMetadata.updateMany({
          where: { id: { in: initialJobIds } },
          data: {
            assignedEmployeeId: employee.id,
            createdById: employee.id,
          },
        });
      }

      // Fetch the shifted jobs to migrate related tickets, surveys, quotations, etc.
      const userJobs = await prisma.jobMetadata.findMany({
        where: {
          assignedEmployeeId: employee.id,
        },
        select: {
          id: true,
          ticketId: true,
        },
      });

      const jobIds = userJobs.map((j) => j.id);
      const ticketIds = userJobs.map((j) => j.ticketId);

      // 2. Shift related tickets
      if (ticketIds.length > 0) {
        await prisma.ticket.updateMany({
          where: {
            id: { in: ticketIds },
          },
          data: {
            createdById: employee.id,
          },
        });
      }

      // 3. Shift child items (surveys, quotations, expenses, payments, work completion, bank approval)
      if (jobIds.length > 0) {
        await prisma.surveyReport.updateMany({
          where: { jobMetadataId: { in: jobIds } },
          data: { createdById: employee.id },
        });
        await prisma.quotationInvoice.updateMany({
          where: { jobMetadataId: { in: jobIds } },
          data: { createdById: employee.id },
        });
        await prisma.expense.updateMany({
          where: { jobMetadataId: { in: jobIds } },
          data: { createdById: employee.id },
        });
        await prisma.paymentReceived.updateMany({
          where: { jobMetadataId: { in: jobIds } },
          data: { createdById: employee.id },
        });
        await prisma.workCompletion.updateMany({
          where: { jobMetadataId: { in: jobIds } },
          data: { createdById: employee.id },
        });
        await prisma.bankApproval.updateMany({
          where: { jobMetadataId: { in: jobIds } },
          data: { createdById: employee.id },
        });
      }

      console.log(`Successfully migrated ${jobIds.length} jobs and related records to new employee ${name}`);
    } catch (migrationError) {
      // Log the error but don't fail the employee creation response
      console.error('Data migration error during employee creation:', migrationError);
    }

    return NextResponse.json({ employee, action: 'created' }, { status: 201 });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}
