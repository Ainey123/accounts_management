import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function escapeHtml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generates an official PDF for the Project Expense Report with FES branding & logo
 */
export async function downloadExpenseReportPdf({
  job,
  reportDate,
  sections,
  totalExpenseAmount,
  materialExpense,
  labourExpense,
  paidBy,
  employeeName,
}) {
  const branchName = job?.branchName || 'Project Site';
  const serialNo = job?.ticket?.serialNo || job?.id || '';
  const displayDate = reportDate
    ? new Date(reportDate).toLocaleDateString('en-GB')
    : new Date().toLocaleDateString('en-GB');
  const logoSrc = typeof window !== 'undefined' ? `${window.location.origin}/fes-logo-cropped.png` : '/fes-logo-cropped.png';

  const container = document.createElement('div');
  container.className = 'pdf-render-root';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';
  container.style.fontSize = '11px';
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';

  let sectionsHtml = '';
  (sections || []).forEach((sec, idx) => {
    const items = sec.items || [];
    let secTotal = 0;
    let rowsHtml = '';

    items.forEach((item, i) => {
      const amt = parseFloat(item.amount) || 0;
      secTotal += amt;
      const bg = i % 2 === 1 ? '#eef6f6' : '#ffffff';
      rowsHtml += `
        <tr style="background: ${bg}; border-bottom: 1px solid #cbd5e1;">
          <td style="padding: 6px 8px; text-align: center; width: 42px; border-right: 1px solid #cbd5e1;">${escapeHtml(item.code || i + 1)}</td>
          <td style="padding: 6px 10px; border-right: 1px solid #cbd5e1;">${escapeHtml(item.name || '—')}</td>
          <td style="padding: 6px 8px; text-align: center; width: 70px; border-right: 1px solid #cbd5e1;">${escapeHtml(item.qty || '—')}</td>
          <td style="padding: 6px 10px; text-align: right; width: 110px; border-right: 1px solid #cbd5e1; font-weight: 700;">${amt > 0 ? `Rs. ${amt.toLocaleString()}` : '—'}</td>
          <td style="padding: 6px 10px; color: #334155;">${escapeHtml(item.others || '—')}</td>
        </tr>
      `;
    });

    if (!rowsHtml) {
      rowsHtml = `
        <tr>
          <td colspan="5" style="padding: 10px; text-align: center; color: #64748b; font-style: italic;">No entries recorded in this category.</td>
        </tr>
      `;
    }

    sectionsHtml += `
      <div style="margin-bottom: 18px; page-break-inside: avoid;">
        <div style="background: #117a7a; color: #ffffff; padding: 8px 14px; border-radius: 6px; font-weight: 700; font-size: 13px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span>0${idx + 1} &nbsp; ${escapeHtml((sec.title || '').toUpperCase())}</span>
          <span>Subtotal: Rs. ${secTotal.toLocaleString()}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; font-size: 11px;">
          <thead>
            <tr style="background: #d9ebeb; border-bottom: 1px solid #94a3b8; font-weight: 700; color: #0f172a;">
              <th style="padding: 7px 8px; text-align: center; width: 42px; border-right: 1px solid #94a3b8;">No.</th>
              <th style="padding: 7px 10px; text-align: left; border-right: 1px solid #94a3b8;">Description</th>
              <th style="padding: 7px 8px; text-align: center; width: 70px; border-right: 1px solid #94a3b8;">Qty</th>
              <th style="padding: 7px 10px; text-align: right; width: 110px; border-right: 1px solid #94a3b8;">Amount (Rs)</th>
              <th style="padding: 7px 10px; text-align: left;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  });

  container.innerHTML = `
    <div style="background: #162d4c; color: #ffffff; padding: 18px 28px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">FAST ENGINEERING SOLUTIONS</div>
        <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px; letter-spacing: 0.6px; font-weight: 600;">CONSTRUCTION SITE / PROJECT EXPENSE REPORT</div>
      </div>
      <div style="background: #ffffff; border-radius: 10px; padding: 4px; width: 74px; height: 74px; display: flex; align-items: center; justify-content: center;">
        <img src="${logoSrc}" alt="FES" crossorigin="anonymous" style="width: 68px; height: 68px; object-fit: contain;" />
      </div>
    </div>

    <div style="padding: 20px 28px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px 28px; margin-bottom: 18px; font-size: 12px;">
        <div><strong>Project / Site:</strong> <span style="border-bottom: 1px solid #64748b; padding: 0 8px 2px 4px; display: inline-block; min-width: 190px;">${escapeHtml(branchName)}</span></div>
        <div><strong>Report Date:</strong> <span style="border-bottom: 1px solid #64748b; padding: 0 8px 2px 4px; display: inline-block; min-width: 150px;">${escapeHtml(displayDate)}</span></div>
        <div><strong>Site Supervisor:</strong> <span style="border-bottom: 1px solid #64748b; padding: 0 8px 2px 4px; display: inline-block; min-width: 180px;">${escapeHtml(employeeName || '—')}</span></div>
        <div><strong>Payment Mode:</strong> <span style="border-bottom: 1px solid #64748b; padding: 0 8px 2px 4px; display: inline-block; min-width: 150px;">Paid by ${escapeHtml(paidBy || 'FES')}</span></div>
      </div>

      ${
        materialExpense !== undefined || labourExpense !== undefined
          ? `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px;">
              <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 10px 12px; background: #f8fafc;">
                <div style="font-size: 10px; color: #475569; text-transform: uppercase; font-weight: 700;">Project Expense</div>
                <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px;">Rs. ${(Number(totalExpenseAmount) || 0).toLocaleString()}</div>
              </div>
              <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 10px 12px; background: #f8fafc;">
                <div style="font-size: 10px; color: #475569; text-transform: uppercase; font-weight: 700;">Material Expense</div>
                <div style="font-size: 16px; font-weight: 800; color: #0369a1; margin-top: 2px;">Rs. ${(Number(materialExpense) || 0).toLocaleString()}</div>
              </div>
              <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 10px 12px; background: #f8fafc;">
                <div style="font-size: 10px; color: #475569; text-transform: uppercase; font-weight: 700;">Labour Expense</div>
                <div style="font-size: 16px; font-weight: 800; color: #047857; margin-top: 2px;">Rs. ${(Number(labourExpense) || 0).toLocaleString()}</div>
              </div>
            </div>`
          : ''
      }

      ${sectionsHtml}

      <div style="margin-top: 16px; padding: 14px 16px; background: #eef6f6; border: 2px solid #117a7a; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 11px; color: #334155;">
          <strong>Ref:</strong> ${serialNo ? `#${escapeHtml(serialNo)}` : 'Direct Site Project'} | FES Site Monitoring &amp; Documentation
        </div>
        <div style="font-size: 16px; font-weight: 800; color: #162d4c;">
          TOTAL PROJECT EXPENSE: Rs. ${(Number(totalExpenseAmount) || 0).toLocaleString()}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    const pageHeight = pdf.internal.pageSize.getHeight();
    let heightLeft = pdfHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`FES_Project_Expense_${branchName.replace(/\s+/g, '_')}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Generates an exact 9-Page Official PDF matching the FES Construction Site / Bank Branch Progress Report PDF
 */
export async function downloadProgressReportPdf({
  job,
  reportDate,
  sections = [],
  employeeName,
  siteSupervisor,
  targetCompletion,
}) {
  const meta = sections?.[0]?.sheetMeta || {};
  const branchName = meta.branchSite || job?.branchName || 'Branch Site';
  const supervisor = siteSupervisor || meta.siteSupervisor || employeeName || '';
  const targetDate = targetCompletion || meta.targetCompletion || '';
  const rawDate = reportDate || meta.reportDate || '';
  const displayDate = rawDate
    ? new Date(rawDate).toLocaleDateString('en-GB')
    : new Date().toLocaleDateString('en-GB');
  const logoSrc = typeof window !== 'undefined' ? `${window.location.origin}/fes-logo-cropped.png` : '/fes-logo-cropped.png';

  const totalPages = sections.length || 9;
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  for (let idx = 0; idx < sections.length; idx++) {
    const sec = sections[idx];
    const secCode = sec.sectionCode || String(sec.id || idx + 1).padStart(2, '0');
    const standardItems = (sec.items || []).filter((it) => !it.isCustom);
    const customItems = (sec.items || []).filter((it) => it.isCustom);

    let pctSum = 0;
    let pctCount = 0;
    (sec.items || []).forEach((it) => {
      const p = parseFloat(it.workPercent);
      if (!isNaN(p)) {
        pctSum += p;
        pctCount++;
      }
    });
    const computedAvg = pctCount > 0 ? Math.round(pctSum / pctCount) : '';
    const displaySectionPct =
      sec.overallSectionProgress !== undefined && sec.overallSectionProgress !== ''
        ? sec.overallSectionProgress
        : computedAvg;

    let standardRowsHtml = '';
    standardItems.forEach((item, rIdx) => {
      const rowBg = rIdx % 2 === 1 ? '#edf6f6' : '#ffffff';
      const pct = item.workPercent !== '' && item.workPercent !== undefined ? `${escapeHtml(item.workPercent)}%` : '';
      standardRowsHtml += `
        <tr style="background: ${rowBg}; border-bottom: 1px solid #b6c8c8; height: 27px;">
          <td style="padding: 4px 8px; width: 44px; border-right: 1px solid #b6c8c8; color: #1e293b;">${escapeHtml(item.code || rIdx + 1)}</td>
          <td style="padding: 4px 10px; border-right: 1px solid #b6c8c8; color: #0f172a;">${escapeHtml(item.name)}</td>
          <td style="padding: 4px 8px; width: 68px; border-right: 1px solid #b6c8c8; color: #1e293b;">${escapeHtml(item.unit === 'Jop' ? 'Job' : item.unit)}</td>
          <td style="padding: 4px 8px; width: 78px; text-align: center; border-right: 1px solid #b6c8c8; font-weight: 700; color: #0f766e;">${pct}</td>
          <td style="padding: 4px 10px; color: #334155;">${escapeHtml(item.remark || item.others || '')}</td>
        </tr>
      `;
    });

    const customRowsToShow = customItems.length > 0 ? customItems : [{}, {}, {}, {}];
    let customRowsHtml = `
      <tr style="background: #ffffff; border-bottom: 1px solid #b6c8c8; height: 27px;">
        <td style="padding: 4px 8px; border-right: 1px solid #b6c8c8;"></td>
        <td style="padding: 4px 10px; border-right: 1px solid #b6c8c8; font-weight: 700; color: #0f172a;">Other / additional work:</td>
        <td style="padding: 4px 8px; border-right: 1px solid #b6c8c8;"></td>
        <td style="padding: 4px 8px; border-right: 1px solid #b6c8c8;"></td>
        <td style="padding: 4px 10px;"></td>
      </tr>
    `;

    customRowsToShow.forEach((cItem, cIdx) => {
      const rowBg = cIdx % 2 === 0 ? '#edf6f6' : '#ffffff';
      const pct = cItem.workPercent !== '' && cItem.workPercent !== undefined ? `${escapeHtml(cItem.workPercent)}%` : '';
      customRowsHtml += `
        <tr style="background: ${rowBg}; border-bottom: 1px solid #b6c8c8; height: 27px;">
          <td style="padding: 4px 8px; border-right: 1px solid #b6c8c8; color: #475569;">${cItem.name ? standardItems.length + cIdx + 1 : ''}</td>
          <td style="padding: 4px 10px; border-right: 1px solid #b6c8c8; color: #0f172a;">${escapeHtml(cItem.name || '')}</td>
          <td style="padding: 4px 8px; border-right: 1px solid #b6c8c8; color: #1e293b;">${escapeHtml(cItem.unit || '')}</td>
          <td style="padding: 4px 8px; text-align: center; border-right: 1px solid #b6c8c8; font-weight: 700; color: #0f766e;">${pct}</td>
          <td style="padding: 4px 10px; color: #334155;">${escapeHtml(cItem.remark || cItem.others || '')}</td>
        </tr>
      `;
    });

    const pageEl = document.createElement('div');
    pageEl.style.width = '794px';
    pageEl.style.minHeight = '1123px';
    pageEl.style.background = '#ffffff';
    pageEl.style.color = '#0f172a';
    pageEl.style.fontFamily = 'Arial, Helvetica, sans-serif';
    pageEl.style.display = 'flex';
    pageEl.style.flexDirection = 'column';
    pageEl.style.justifyContent = 'space-between';
    pageEl.style.position = 'fixed';
    pageEl.style.top = '-99999px';
    pageEl.style.left = '-99999px';
    pageEl.style.boxSizing = 'border-box';

    pageEl.innerHTML = `
      <div>
        <!-- Dark Navy Official FES Header -->
        <div style="background: #162d4c; color: #ffffff; padding: 20px 36px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">FAST ENGINEERING SOLUTIONS</div>
            <div style="font-size: 11.5px; color: #cbd5e1; margin-top: 6px; letter-spacing: 0.6px; font-weight: 700;">CONSTRUCTION SITE / BANK BRANCH PROGRESS REPORT</div>
          </div>
          <div style="background: #ffffff; border-radius: 10px; padding: 4px; width: 78px; height: 78px; display: flex; align-items: center; justify-content: center;">
            <img src="${logoSrc}" alt="FES" crossorigin="anonymous" style="width: 72px; height: 72px; object-fit: contain;" />
          </div>
        </div>

        <div style="padding: 20px 36px 0 36px;">
          <!-- Header Fields -->
          <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 12px 28px; margin-bottom: 16px; font-size: 12px; color: #0f172a;">
            <div style="display: flex; align-items: baseline; gap: 6px;">
              <strong style="white-space: nowrap;">Branch / Site:</strong>
              <span style="flex: 1; border-bottom: 1px solid #475569; padding: 0 6px 2px 6px; font-weight: 600;">${escapeHtml(branchName)}</span>
            </div>
            <div style="display: flex; align-items: baseline; gap: 6px;">
              <strong style="white-space: nowrap;">Report Date:</strong>
              <span style="flex: 1; border-bottom: 1px solid #475569; padding: 0 6px 2px 6px; font-weight: 600;">${escapeHtml(displayDate)}</span>
            </div>
            <div style="display: flex; align-items: baseline; gap: 6px;">
              <strong style="white-space: nowrap;">Site Supervisor:</strong>
              <span style="flex: 1; border-bottom: 1px solid #475569; padding: 0 6px 2px 6px;">${escapeHtml(supervisor)}</span>
            </div>
            <div style="display: flex; align-items: baseline; gap: 6px;">
              <strong style="white-space: nowrap;">Target Completion:</strong>
              <span style="flex: 1; border-bottom: 1px solid #475569; padding: 0 6px 2px 6px;">${escapeHtml(targetDate)}</span>
            </div>
          </div>

          <!-- Teal Section Banner -->
          <div style="background: #117a7a; color: #ffffff; padding: 10px 16px; border-radius: 6px; font-weight: 800; font-size: 14px; letter-spacing: 0.4px; margin-bottom: 14px;">
            ${escapeHtml(secCode)} &nbsp;&nbsp; ${escapeHtml((sec.title || '').toUpperCase())}
          </div>

          <!-- Progress Table -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #9eb3b3; font-size: 11.5px;">
            <thead>
              <tr style="background: #d9ebeb; border-bottom: 1px solid #9eb3b3; color: #0f172a; font-weight: 700; height: 32px;">
                <th style="padding: 6px 8px; text-align: left; width: 44px; border-right: 1px solid #9eb3b3;">No.</th>
                <th style="padding: 6px 10px; text-align: left; border-right: 1px solid #9eb3b3;">Description of Work</th>
                <th style="padding: 6px 8px; text-align: left; width: 68px; border-right: 1px solid #9eb3b3;">Unit</th>
                <th style="padding: 6px 8px; text-align: center; width: 78px; border-right: 1px solid #9eb3b3;">Done %</th>
                <th style="padding: 6px 10px; text-align: left;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${standardRowsHtml}
              ${customRowsHtml}
            </tbody>
          </table>

          <!-- Section Summary & Signatures -->
          <div style="margin-top: 18px; font-size: 11.5px; color: #0f172a;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 24px; margin-bottom: 12px;">
              <div>
                <strong>Overall Section Progress:</strong>
                <span style="display: inline-block; min-width: 56px; text-align: center; border-bottom: 1px solid #475569; font-weight: 700; color: #0f766e; padding-bottom: 1px;">${escapeHtml(displaySectionPct)}</span>
                <strong>%</strong>
              </div>
              <div style="flex: 1; max-width: 340px; display: flex; align-items: baseline; gap: 6px;">
                <strong style="white-space: nowrap;">Pending / Delayed Items:</strong>
                <span style="flex: 1; border-bottom: 1px solid #475569; padding: 0 4px 1px 4px;">${escapeHtml(sec.pendingItems || '')}</span>
              </div>
            </div>

            <div style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 16px;">
              <strong style="white-space: nowrap;">Site Issues / Material Required:</strong>
              <span style="flex: 1; border-bottom: 1px solid #475569; padding: 0 4px 1px 4px;">${escapeHtml(sec.siteIssues || '')}</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 28px;">
              <div style="display: flex; align-items: baseline; gap: 6px;">
                <strong style="white-space: nowrap;">Supervisor Signature:</strong>
                <span style="flex: 1; border-bottom: 1px solid #475569; padding: 0 4px 1px 4px;">${escapeHtml(sec.supervisorSignature || '')}</span>
              </div>
              <div style="display: flex; align-items: baseline; gap: 6px;">
                <strong style="white-space: nowrap;">Verified By:</strong>
                <span style="flex: 1; border-bottom: 1px solid #475569; padding: 0 4px 1px 4px;">${escapeHtml(sec.verifiedBy || '')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Official Page Footer -->
      <div style="padding: 12px 36px 20px 36px;">
        <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
          <span>FES | Site Monitoring &amp; Documentation | Manual Progress Register</span>
          <span>Page ${idx + 1} of ${totalPages}</span>
        </div>
      </div>
    `;

    document.body.appendChild(pageEl);
    try {
      const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      if (idx > 0) pdf.addPage();
      const renderedHeight = Math.min(pdfHeight, (canvas.height * pdfWidth) / canvas.width);
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, renderedHeight);
    } finally {
      document.body.removeChild(pageEl);
    }
  }

  pdf.save(`FES_Progress_Report_${branchName.replace(/\s+/g, '_')}.pdf`);
}
