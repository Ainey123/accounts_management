import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseStatementFile } from '@/lib/statementParser';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const statements = await prisma.bankStatement.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, employeeName: true, email: true } },
        _count: { select: { transactions: true } },
      },
    });

    return NextResponse.json({
      success: true,
      statements,
    });
  } catch (error) {
    console.error('Fetch statements error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const bankNameOverride = formData.get('bankName') || '';
    const adminName = formData.get('adminName') || 'Fatma';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'No valid file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name || 'bank_statement';

    // Parse statement
    const parsed = await parseStatementFile({
      buffer,
      fileName,
      bankNameOverride,
    });

    // Check for duplicate statement upload using fileHash
    const existing = await prisma.bankStatement.findFirst({
      where: { fileHash: parsed.fileHash },
    });

    if (existing) {
      return NextResponse.json({
        success: false,
        error: `This statement (${fileName}) was already uploaded on ${new Date(existing.createdAt).toLocaleDateString()} with ID #${existing.id}.`,
        isDuplicate: true,
        statementId: existing.id,
      }, { status: 409 });
    }

    // Insert BankStatement and its parsed transactions
    const statement = await prisma.bankStatement.create({
      data: {
        bankName: parsed.bankName,
        accountNumber: parsed.accountNumber || null,
        statementPeriod: parsed.statementPeriod,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        fileName: parsed.fileName,
        fileHash: parsed.fileHash,
        fileSize: parsed.fileSize,
        fileType: parsed.fileType,
        totalCredits: parsed.totalCredits,
        totalDebits: parsed.totalDebits,
        openingBalance: parsed.openingBalance,
        closingBalance: parsed.closingBalance,
        transactionCount: parsed.transactionCount,
        status: 'PROCESSED',
        transactions: {
          create: parsed.transactions.map((t) => ({
            transactionDate: t.transactionDate,
            valueDate: t.valueDate,
            description: t.description,
            referenceNo: t.referenceNo,
            chequeNo: t.chequeNo,
            debit: t.debit,
            credit: t.credit,
            balance: t.balance,
            transactionHash: t.transactionHash,
            matchStatus: 'UNMATCHED',
            reconciledAmount: 0,
          })),
        },
      },
      include: {
        transactions: true,
      },
    });

    // Log upload in audit trail
    await prisma.reconciliationAudit.create({
      data: {
        statementId: statement.id,
        adminName,
        action: 'STATEMENT_UPLOAD',
        comment: `Uploaded statement ${fileName} (${parsed.bankName}): ${parsed.transactionCount} transactions parsed, Total Debits: Rs. ${parsed.totalDebits.toLocaleString()}`,
      },
    });

    return NextResponse.json({
      success: true,
      statement,
      message: `Statement parsed successfully! ${parsed.transactionCount} transactions extracted (Total Debits: Rs. ${parsed.totalDebits.toLocaleString()}).`,
    });
  } catch (error) {
    console.error('Upload statement error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id'), 10);
    const adminName = searchParams.get('adminName') || 'Admin';

    if (!id) {
      return NextResponse.json({ success: false, error: 'Statement ID required' }, { status: 400 });
    }

    // Find linked expenses to reset them cleanly before deleting statement
    const transactions = await prisma.bankTransaction.findMany({
      where: { statementId: id },
      select: { id: true },
    });

    const txIds = transactions.map((t) => t.id);

    if (txIds.length > 0) {
      // Unlink any matched expenses
      await prisma.expense.updateMany({
        where: { bankTransactionId: { in: txIds } },
        data: {
          status: 'UNMATCHED',
          adjustedAmount: 0,
          remainingAmount: null,
          bankTransactionId: null,
        },
      });
    }

    // Delete statement (cascades to transactions and audits)
    await prisma.bankStatement.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Statement and its transactions removed successfully. Linked expenses have been reset to Unmatched.',
    });
  } catch (error) {
    console.error('Delete statement error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
