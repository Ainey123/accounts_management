import { prisma } from './prisma';

/**
 * Normalizes strings for loose name and text comparison.
 */
function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if employee name tokens appear in bank transaction narration.
 */
function checkNameMatch(employeeName, description) {
  if (!employeeName || !description) return false;
  const nameNorm = normalizeText(employeeName);
  const descNorm = normalizeText(description);
  
  if (descNorm.includes(nameNorm)) return true;
  
  const tokens = nameNorm.split(' ').filter(t => t.length > 2);
  if (tokens.length >= 2) {
    const matches = tokens.filter(t => descNorm.includes(t));
    return matches.length >= 2;
  }
  return tokens.length === 1 && descNorm.includes(tokens[0]);
}

/**
 * Runs rule-based automated reconciliation on all unmatched or pending expenses against bank transactions.
 */
export async function runAutoReconciliation({ adminId = null, adminName = 'System' } = {}) {
  // Fetch all candidate expenses that are not fully matched
  const candidateExpenses = await prisma.expense.findMany({
    where: {
      status: { in: ['UNMATCHED', 'REVIEW_REQUIRED', 'PENDING'] },
    },
    include: {
      jobMetadata: {
        include: {
          assignedEmployee: true,
          ticket: true,
        },
      },
      createdBy: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Fetch available bank transactions (debits with remaining unallocated balance)
  const bankTransactions = await prisma.bankTransaction.findMany({
    where: {
      debit: { gt: 0 },
      matchStatus: { in: ['UNMATCHED', 'PARTIALLY_MATCHED'] },
    },
    include: {
      statement: true,
    },
    orderBy: { transactionDate: 'asc' },
  });

  let matchedCount = 0;
  let partiallyMatchedCount = 0;
  let reviewRequiredCount = 0;

  for (const expense of candidateExpenses) {
    const claimAmount = expense.amount;
    const expenseDate = expense.expenseDate || expense.createdAt;
    const employee = expense.createdBy || expense.jobMetadata?.assignedEmployee;
    const employeeName = employee?.employeeName || '';
    const ticketSerial = expense.jobMetadata?.ticket?.serialNo || '';
    const clientName = expense.jobMetadata?.clientName || '';

    // Find candidate transactions
    const matches = [];

    for (const tx of bankTransactions) {
      const remainingTxDebit = tx.debit - (tx.reconciledAmount || 0);
      if (remainingTxDebit <= 0) continue;

      let score = 0;
      const desc = tx.description || '';
      const ref = tx.referenceNo || '';
      const txDate = tx.transactionDate;
      const dayDiff = Math.abs((txDate.getTime() - new Date(expenseDate).getTime()) / (1000 * 60 * 60 * 24));

      // Rule 1: Reference number / Serial match (Highest confidence)
      if (ticketSerial && (desc.includes(ticketSerial) || ref.includes(ticketSerial))) {
        score += 100;
      }

      // Rule 2: Employee name in description
      if (checkNameMatch(employeeName, desc)) {
        score += 60;
      }

      // Rule 3: Client / Branch match
      if (clientName && desc.toLowerCase().includes(clientName.toLowerCase())) {
        score += 30;
      }

      // Rule 4: Amount exact match
      const amountDiff = Math.abs(claimAmount - remainingTxDebit);
      if (amountDiff < 0.01) {
        score += 50;
      } else if (amountDiff <= claimAmount * 0.05) {
        score += 20;
      }

      // Rule 5: Date proximity (within 7 days)
      if (dayDiff <= 3) {
        score += 30;
      } else if (dayDiff <= 7) {
        score += 20;
      } else if (dayDiff <= 15) {
        score += 10;
      }

      if (score >= 50) {
        matches.push({ tx, score, dayDiff, remainingTxDebit });
      }
    }

    // Sort candidates by score descending
    matches.sort((a, b) => b.score - a.score);

    if (matches.length === 1 && matches[0].score >= 80) {
      // High confidence exact match
      const { tx, remainingTxDebit } = matches[0];
      const matchAmt = Math.min(claimAmount, remainingTxDebit);
      const isFull = Math.abs(claimAmount - matchAmt) < 0.01;
      const newStatus = isFull ? 'MATCHED' : 'PARTIALLY_MATCHED';

      await prisma.expense.update({
        where: { id: expense.id },
        data: {
          status: newStatus,
          adjustedAmount: matchAmt,
          remainingAmount: claimAmount - matchAmt,
          bankTransactionId: tx.id,
        },
      });

      const updatedReconciledAmt = (tx.reconciledAmount || 0) + matchAmt;
      const txStatus = updatedReconciledAmt >= tx.debit - 0.01 ? 'MATCHED' : 'PARTIALLY_MATCHED';

      await prisma.bankTransaction.update({
        where: { id: tx.id },
        data: {
          matchStatus: txStatus,
          reconciledAmount: updatedReconciledAmt,
        },
      });

      // Audit trail
      await prisma.reconciliationAudit.create({
        data: {
          expenseId: expense.id,
          statementId: tx.statementId,
          transactionId: tx.id,
          adminId: adminId || null,
          adminName: adminName || 'Auto Reconciler',
          action: 'AUTO_MATCH',
          previousStatus: expense.status,
          newStatus,
          adjustedAmount: matchAmt,
          comment: `Auto-matched with ${tx.statement?.bankName || 'Bank'} transaction ref "${tx.referenceNo || tx.description.slice(0, 30)}" (Confidence score: ${matches[0].score})`,
        },
      });

      if (isFull) matchedCount++;
      else partiallyMatchedCount++;

    } else if (matches.length > 1) {
      // Multiple candidates -> Mark for admin review
      await prisma.expense.update({
        where: { id: expense.id },
        data: {
          status: 'REVIEW_REQUIRED',
        },
      });
      reviewRequiredCount++;
    }
  }

  return {
    matchedCount,
    partiallyMatchedCount,
    reviewRequiredCount,
  };
}

/**
 * Manually adjusts or matches an expense claim to a bank transaction (or direct admin adjustment).
 */
export async function manualAdjustExpense({
  expenseId,
  bankTransactionId = null,
  adjustedAmount,
  comment = '',
  adminId = null,
  adminName = 'Admin',
}) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { bankTransaction: true },
  });

  if (!expense) throw new Error('Expense not found');

  const prevStatus = expense.status;
  const adjAmt = parseFloat(adjustedAmount) || 0;
  const remAmt = Math.max(0, expense.amount - adjAmt);
  const newStatus = remAmt <= 0.01 ? 'MANUALLY_ADJUSTED' : adjAmt > 0 ? 'PARTIALLY_MATCHED' : 'UNMATCHED';

  let tx = null;
  if (bankTransactionId) {
    tx = await prisma.bankTransaction.findUnique({
      where: { id: bankTransactionId },
      include: { statement: true },
    });
    if (tx) {
      const newReconciledAmt = Math.min(tx.debit, (tx.reconciledAmount || 0) + adjAmt);
      const txStatus = newReconciledAmt >= tx.debit - 0.01 ? 'MANUALLY_ADJUSTED' : 'PARTIALLY_MATCHED';
      await prisma.bankTransaction.update({
        where: { id: tx.id },
        data: {
          matchStatus: txStatus,
          reconciledAmount: newReconciledAmt,
        },
      });
    }
  }

  const updatedExpense = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      status: newStatus,
      adjustedAmount: adjAmt,
      remainingAmount: remAmt,
      bankTransactionId: bankTransactionId || expense.bankTransactionId || null,
    },
  });

  // Audit entry
  await prisma.reconciliationAudit.create({
    data: {
      expenseId: expense.id,
      statementId: tx?.statementId || null,
      transactionId: tx?.id || null,
      adminId: adminId || null,
      adminName: adminName || 'Admin',
      action: 'MANUAL_ADJUST',
      previousStatus: prevStatus,
      newStatus,
      adjustedAmount: adjAmt,
      comment: comment || `Manually adjusted to Rs. ${adjAmt.toLocaleString()} by ${adminName}`,
    },
  });

  return updatedExpense;
}

/**
 * Unmatches an expense, reverting its status and freeing associated bank transaction.
 */
export async function unmatchExpense({ expenseId, adminId = null, adminName = 'Admin', comment = '' }) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { bankTransaction: true },
  });

  if (!expense) throw new Error('Expense not found');

  const prevStatus = expense.status;
  const prevTxId = expense.bankTransactionId;
  const prevAdj = expense.adjustedAmount || 0;

  if (prevTxId && expense.bankTransaction) {
    const tx = expense.bankTransaction;
    const newReconciledAmt = Math.max(0, (tx.reconciledAmount || 0) - prevAdj);
    const txStatus = newReconciledAmt <= 0.01 ? 'UNMATCHED' : 'PARTIALLY_MATCHED';

    await prisma.bankTransaction.update({
      where: { id: prevTxId },
      data: {
        matchStatus: txStatus,
        reconciledAmount: newReconciledAmt,
      },
    });
  }

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      status: 'UNMATCHED',
      adjustedAmount: 0,
      remainingAmount: expense.amount,
      bankTransactionId: null,
    },
  });

  await prisma.reconciliationAudit.create({
    data: {
      expenseId: expense.id,
      statementId: expense.bankTransaction?.statementId || null,
      transactionId: prevTxId || null,
      adminId: adminId || null,
      adminName: adminName || 'Admin',
      action: 'UNMATCH',
      previousStatus: prevStatus,
      newStatus: 'UNMATCHED',
      adjustedAmount: 0,
      comment: comment || `Reconciliation unlinked by ${adminName}`,
    },
  });

  return updated;
}
