/**
 * Deterministically ranks Office Employees (role === 'EMPLOYEE')
 * in descending order of their Gmail / complaint job count so the employee
 * with the highest Gmails is always Batch 1, second highest is Batch 2, etc.
 */
export function getEmployeeGmailScore(user) {
  const assigned =
    typeof user?._count?.assignedJobs === 'number'
      ? user._count.assignedJobs
      : Array.isArray(user?.assignedJobs)
      ? user.assignedJobs.length
      : 0;
  const createdJobs = user?._count?.createdJobs ?? 0;
  const createdTickets = user?._count?.createdTickets ?? 0;
  return {
    gmailCount: assigned,
    createdJobs,
    createdTickets,
  };
}

export function sortAndAssignOfficeBatches(officeUsers) {
  const sorted = [...(officeUsers || [])].sort((a, b) => {
    const scoreA = getEmployeeGmailScore(a);
    const scoreB = getEmployeeGmailScore(b);
    if (scoreB.gmailCount !== scoreA.gmailCount) {
      return scoreB.gmailCount - scoreA.gmailCount;
    }
    if (scoreB.createdJobs !== scoreA.createdJobs) {
      return scoreB.createdJobs - scoreA.createdJobs;
    }
    if (scoreB.createdTickets !== scoreA.createdTickets) {
      return scoreB.createdTickets - scoreA.createdTickets;
    }
    return (a.id || 0) - (b.id || 0);
  });

  return sorted.map((emp, idx) => {
    const score = getEmployeeGmailScore(emp);
    const batchNumber = idx + 1;
    const batchLabel = `Batch ${batchNumber}`;
    return {
      ...emp,
      batchNumber,
      batchLabel,
      gmailCount: score.gmailCount,
    };
  });
}
