export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const WORK_NATURES = ['ELECTRICAL', 'WAPDA', 'MAINTENANCE', 'PROJECT'];

function escapeCsv(value) {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function classifyPending(job) {
  const p = {};
  const quotations = job.quotationInvoices || [];
  p.quotationPending = quotations.filter((q) => q.documentType === 'QUOTATION' && q.status !== 'APPROVED').length;
  const invoices = quotations.filter((q) => q.documentType === 'INVOICE');
  p.invoicePending = invoices.filter((inv) => inv.status !== 'PAID' && inv.status !== 'APPROVED').length;
  p.paymentPending = (job.paymentProgress || 0) < 100;
  const completion = job.workCompletion;
  p.completionPending = completion ? completion.status !== 'COMPLETED' : true;
  const bank = job.bankApproval;
  p.bankPending = bank ? bank.status !== 'APPROVED' : false;
  p.expensePending = (job.expenses || []).length > 0;
  return p;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const workNature = searchParams.get('workNature');
    const format = searchParams.get('format') || 'csv';

    const where = {};
    if (workNature && WORK_NATURES.includes(workNature.toUpperCase())) {
      where.workNature = workNature.toUpperCase();
    }

    const jobs = await prisma.jobMetadata.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        ticket: { select: { serialNo: true, subject: true, status: true, exactDate: true } },
        assignedEmployee: { select: { employeeName: true } },
        createdBy: { select: { employeeName: true } },
        quotationInvoices: { select: { documentType: true, status: true, poNumber: true, lineItems: true, amount: true } },
        expenses: { select: { amount: true, summaryNotes: true } },
        payments: { select: { amount: true, taxDeducted: true, summaryNotes: true } },
        workCompletion: { select: { status: true, amount: true } },
        bankApproval: { select: { bankName: true, status: true, amount: true } },
      },
    });

    const rows = jobs.map((job) => {
      const p = classifyPending(job);
      const quotationItems = (job.quotationInvoices || []).filter((q) => q.documentType === 'QUOTATION');
      const invoiceItems = (job.quotationInvoices || []).filter((q) => q.documentType === 'INVOICE');
      const totalQuotationAmount = quotationItems.reduce((s, q) => {
        const items = Array.isArray(q.lineItems) ? q.lineItems : [];
        return s + items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      }, 0);
      const totalInvoiceAmount = invoiceItems.reduce((s, inv) => {
        const items = Array.isArray(inv.lineItems) ? inv.lineItems : [];
        return s + items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      }, 0);
      const totalPayment = (job.payments || []).reduce((s, pay) => s + pay.amount, 0);
      const totalTax = (job.payments || []).reduce((s, pay) => s + (pay.taxDeducted || 0), 0);
      const totalExpense = (job.expenses || []).reduce((s, exp) => s + exp.amount, 0);

      return {
        serialNo: job.ticket?.serialNo || '',
        subject: job.ticket?.subject || '',
        clientName: job.clientName,
        branchName: job.branchName,
        personOfContact: job.personOfContact,
        workNature: job.workNature,
        assignedTo: job.assignedEmployee?.employeeName || '',
        enteredBy: job.createdBy?.employeeName || '',
        createdAt: job.createdAt ? new Date(job.createdAt).toISOString().slice(0, 10) : '',
        paymentProgress: job.paymentProgress || 0,
        paymentStatus: job.paymentStatus || 'PENDING',
        quotationPending: p.quotationPending,
        invoicePending: p.invoicePending,
        paymentPending: p.paymentPending ? 'Yes' : 'No',
        completionPending: p.completionPending ? 'Yes' : 'No',
        bankPending: p.bankPending ? 'Yes' : 'No',
        expensePending: p.expensePending ? 'Yes' : 'No',
        totalQuotationAmount,
        totalInvoiceAmount,
        totalPayment,
        totalTax,
        totalExpense,
        netReceived: totalPayment - totalTax,
        workCompletionStatus: job.workCompletion?.status || 'NONE',
        workCompletionAmount: job.workCompletion?.amount || 0,
        bankApprovalStatus: job.bankApproval?.status || 'NONE',
        bankApprovalAmount: job.bankApproval?.amount || 0,
        bankName: job.bankApproval?.bankName || '',
      };
    });

    const headers = [
      'Serial No', 'Subject', 'Client Name', 'Branch Name', 'Person of Contact',
      'Work Nature', 'Assigned To', 'Entered By', 'Created Date',
      'Payment Progress %', 'Payment Status', 'Quotation Pending', 'Invoice Pending',
      'Payment Pending', 'Completion Pending', 'Bank Approval Pending', 'Expense Pending',
      'Total Quotation Amount', 'Total Invoice Amount', 'Total Payment', 'Total Tax Deducted',
      'Total Expense', 'Net Received', 'Work Completion Status', 'Work Completion Amount',
      'Bank Approval Status', 'Bank Approval Amount', 'Bank Name',
    ];

    const headerToKey = {
      'Serial No': 'serialNo',
      'Subject': 'subject',
      'Client Name': 'clientName',
      'Branch Name': 'branchName',
      'Person of Contact': 'personOfContact',
      'Work Nature': 'workNature',
      'Assigned To': 'assignedTo',
      'Entered By': 'enteredBy',
      'Created Date': 'createdAt',
      'Payment Progress %': 'paymentProgress',
      'Payment Status': 'paymentStatus',
      'Quotation Pending': 'quotationPending',
      'Invoice Pending': 'invoicePending',
      'Payment Pending': 'paymentPending',
      'Completion Pending': 'completionPending',
      'Bank Approval Pending': 'bankPending',
      'Expense Pending': 'expensePending',
      'Total Quotation Amount': 'totalQuotationAmount',
      'Total Invoice Amount': 'totalInvoiceAmount',
      'Total Payment': 'totalPayment',
      'Total Tax Deducted': 'totalTax',
      'Total Expense': 'totalExpense',
      'Net Received': 'netReceived',
      'Work Completion Status': 'workCompletionStatus',
      'Work Completion Amount': 'workCompletionAmount',
      'Bank Approval Status': 'bankApprovalStatus',
      'Bank Approval Amount': 'bankApprovalAmount',
      'Bank Name': 'bankName',
    };

    const csvLines = [headers.map(escapeCsv).join(',')];
    for (const row of rows) {
      csvLines.push(headers.map((h) => {
        const key = headerToKey[h] || h;
        return escapeCsv(row[key]);
      }).join(','));
    }

    const csv = csvLines.join('\n');

    const workLabel = workNature ? `-${workNature}` : '';
    const filename = `ledger${workLabel}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Download ledger error:', error);
    return NextResponse.json({ error: 'Failed to generate download', details: error.message }, { status: 500 });
  }
}