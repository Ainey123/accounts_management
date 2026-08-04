export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const WORK_NATURES = ['ELECTRICAL', 'WAPDA', 'MAINTENANCE', 'PROJECT'];

function parseWorkNature(filter) {
  if (!filter) return null;
  const upper = filter.toUpperCase();
  return WORK_NATURES.includes(upper) ? upper : null;
}

function parsePendingFilter(filter) {
  if (!filter) return null;
  const map = {
    'quotation': 'QUOTATION_PENDING',
    'invoice': 'INVOICE_PENDING',
    'payment': 'PAYMENT_PENDING',
    'completion': 'COMPLETION_PENDING',
    'bank': 'BANK_PENDING',
    'expense': 'EXPENSE_PENDING',
  };
  return map[filter.toLowerCase()] || null;
}

async function getLedger(workNature, pendingFilter, fromDate, toDate) {
  const where = {};
  if (workNature) where.workNature = workNature;
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate + 'T23:59:59.999Z');
  }

  const jobs = await prisma.jobMetadata.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      ticket: { select: { id: true, serialNo: true, subject: true, status: true, exactDate: true } },
      assignedEmployee: { select: { id: true, employeeName: true } },
      createdBy: { select: { id: true, employeeName: true } },
      surveyReport: { select: { id: true, reportText: true, imageUrl: true, createdAt: true } },
      quotationInvoices: { select: { id: true, documentType: true, status: true, lineItems: true, poNumber: true, imageUrl: true, createdAt: true } },
      expenses: { select: { id: true, amount: true, summaryNotes: true, imageUrl: true, createdAt: true } },
      payments: { select: { id: true, amount: true, taxDeducted: true, summaryNotes: true, imageUrl: true, createdAt: true } },
      workCompletion: { select: { id: true, status: true, amount: true, imageUrl: true, notes: true, createdAt: true } },
      bankApproval: { select: { id: true, bankName: true, accountNumber: true, amount: true, status: true, imageUrl: true, notes: true, createdAt: true } },
    },
  });

  return jobs.map((job) => {
    const pending = classifyPending(job);
    return { ...job, pendingStatuses: pending };
  });
}

function classifyPending(job) {
  const p = {};

  const quotations = job.quotationInvoices || [];
  const quotationPending = quotations.filter((q) => q.documentType === 'QUOTATION' && q.status !== 'APPROVED');
  p.quotationPending = quotationPending.length;

  const invoices = quotations.filter((q) => q.documentType === 'INVOICE');
  const invoicePending = invoices.filter((inv) => inv.status !== 'PAID' && inv.status !== 'APPROVED');
  p.invoicePending = invoicePending.length;

  p.paymentPending = (job.paymentProgress || 0) < 100;

  const completion = job.workCompletion;
  p.completionPending = completion ? completion.status !== 'COMPLETED' : true;

  const bank = job.bankApproval;
  p.bankPending = bank ? bank.status !== 'APPROVED' : false;

  p.expensePending = (job.expenses || []).length > 0;

  return p;
}

async function getSummary(workNature, fromDate, toDate) {
  const jobWhere = {};
  if (workNature) jobWhere.workNature = workNature;
  if (fromDate || toDate) {
    jobWhere.createdAt = {};
    if (fromDate) jobWhere.createdAt.gte = new Date(fromDate);
    if (toDate) jobWhere.createdAt.lte = new Date(toDate + 'T23:59:59.999Z');
  }

  const relationFilter = Object.keys(jobWhere).length > 0 ? { jobMetadata: jobWhere } : {};

  const [totalJobs, jobsByNature, totalQuotations, approvedQuotations, totalInvoices, totalPayments, totalExpenses, completions, bankApprovals] = await Promise.all([
    prisma.jobMetadata.count({ where: jobWhere }),
    prisma.jobMetadata.groupBy({ by: ['workNature'], where: jobWhere, _count: { id: true } }),
    prisma.quotationInvoice.count({ where: { ...relationFilter, documentType: 'QUOTATION' } }),
    prisma.quotationInvoice.count({ where: { ...relationFilter, documentType: 'QUOTATION', status: 'APPROVED' } }),
    prisma.quotationInvoice.count({ where: { ...relationFilter, documentType: 'INVOICE' } }),
    prisma.paymentReceived.aggregate({ where: { ...relationFilter }, _sum: { amount: true }, _sum: { taxDeducted: true } }),
    prisma.expense.aggregate({ where: { ...relationFilter }, _sum: { amount: true } }),
    prisma.workCompletion.count({ where: { status: 'COMPLETED', ...relationFilter } }),
    prisma.bankApproval.count({ where: { status: 'APPROVED', ...relationFilter } }),
  ]);

  const natureMap = {};
  WORK_NATURES.forEach((n) => { natureMap[n] = 0; });
  (jobsByNature || []).forEach((g) => { natureMap[g.workNature] = g._count.id; });

  const paymentSum = totalPayments._sum?.amount || 0;
  const taxSum = totalPayments._sum?.taxDeducted || 0;
  const expenseSum = totalExpenses._sum?.amount || 0;

  return {
    totalJobs,
    jobsByNature: natureMap,
    totalQuotations,
    approvedQuotations,
    pendingQuotations: totalQuotations - approvedQuotations,
    totalInvoices,
    totalPayments: paymentSum,
    totalTaxDeducted: taxSum,
    totalExpenses: expenseSum,
    netReceived: paymentSum - taxSum,
    completions,
    bankApprovals,
    pendingJobs: totalJobs - completions,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const workNature = parseWorkNature(searchParams.get('workNature'));
    const pendingFilter = parsePendingFilter(searchParams.get('pending'));
    const fromDate = searchParams.get('fromDate') || null;
    const toDate = searchParams.get('toDate') || null;

    const [ledger, summary] = await Promise.all([
      getLedger(workNature, pendingFilter, fromDate, toDate),
      getSummary(workNature, fromDate, toDate),
    ]);

    let filteredLedger = ledger;
    if (pendingFilter) {
      filteredLedger = ledger.filter((job) => {
        const p = job.pendingStatuses;
        if (pendingFilter === 'QUOTATION_PENDING') return p.quotationPending > 0;
        if (pendingFilter === 'INVOICE_PENDING') return p.invoicePending > 0;
        if (pendingFilter === 'PAYMENT_PENDING') return p.paymentPending;
        if (pendingFilter === 'COMPLETION_PENDING') return p.completionPending;
        if (pendingFilter === 'BANK_PENDING') return p.bankPending;
        if (pendingFilter === 'EXPENSE_PENDING') return p.expensePending;
        return true;
      });
    }

    return NextResponse.json({
      success: true,
      ledger: filteredLedger,
      summary,
      filters: { workNature, pendingFilter, fromDate, toDate },
    });
  } catch (error) {
    console.error('All documents error:', error);
    return NextResponse.json({ error: 'Failed to fetch documents', details: error.message }, { status: 500 });
  }
}