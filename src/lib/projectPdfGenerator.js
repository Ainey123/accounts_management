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

/**
 * Generates an official A4 PDF for FES MATERIAL DEMAND / REQUISITION FORM (matching uploaded PDF #1)
 */
export async function downloadMaterialDemandPdf(formData = {}, manualAmount = 0) {
  const logoSrc =
    typeof window !== 'undefined'
      ? `${window.location.origin}/fes-logo-cropped.png`
      : '/fes-logo-cropped.png';

  const items =
    Array.isArray(formData.items) && formData.items.length > 0
      ? formData.items
      : Array.from({ length: 8 }, (_, idx) => ({
          srNo: String(idx + 1),
          description: '',
          requiredQty: '',
          unit: '',
          availableStock: '',
        }));

  let rowsHtml = '';
  items.forEach((it, idx) => {
    rowsHtml += `
      <tr style="height: 31px; border-bottom: 1px solid #cbd5e1; background: #ffffff;">
        <td style="padding: 5px 6px; text-align: center; width: 52px; border-right: 1px solid #cbd5e1;">${escapeHtml(it.srNo || idx + 1)}</td>
        <td style="padding: 5px 10px; border-right: 1px solid #cbd5e1;">${escapeHtml(it.description || '')}</td>
        <td style="padding: 5px 8px; text-align: center; width: 105px; border-right: 1px solid #cbd5e1;">${escapeHtml(it.requiredQty || '')}</td>
        <td style="padding: 5px 8px; text-align: center; width: 78px; border-right: 1px solid #cbd5e1;">${escapeHtml(it.unit || '')}</td>
        <td style="padding: 5px 8px; text-align: center; width: 112px;">${escapeHtml(it.availableStock || '')}</td>
      </tr>
    `;
  });

  const pageEl = document.createElement('div');
  pageEl.style.width = '794px';
  pageEl.style.minHeight = '1123px';
  pageEl.style.background = '#ffffff';
  pageEl.style.color = '#0f172a';
  pageEl.style.fontFamily = 'Arial, Helvetica, sans-serif';
  pageEl.style.fontSize = '11.5px';
  pageEl.style.boxSizing = 'border-box';
  pageEl.style.padding = '34px 48px 28px 48px';
  pageEl.style.display = 'flex';
  pageEl.style.flexDirection = 'column';
  pageEl.style.justifyContent = 'space-between';
  pageEl.style.position = 'fixed';
  pageEl.style.top = '-99999px';
  pageEl.style.left = '-99999px';

  pageEl.innerHTML = `
    <div>
      <!-- Official FES Header -->
      <div style="display: flex; align-items: center; gap: 24px; margin-bottom: 18px;">
        <div style="width: 115px; height: 115px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          <img src="${logoSrc}" alt="FES" crossorigin="anonymous" style="width: 112px; height: 112px; object-fit: contain;" />
        </div>
        <div style="flex: 1; text-align: center; padding-right: 20px;">
          <div style="font-size: 25px; font-weight: 800; color: #16325c; letter-spacing: 0.6px;">
            FAST ENGINEERING SOLUTIONS
          </div>
          <div style="font-size: 14.5px; font-weight: 800; color: #cc1f1f; margin-top: 5px; letter-spacing: 0.4px;">
            MATERIAL DEMAND / REQUISITION FORM
          </div>
        </div>
      </div>

      <!-- Metadata Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 18px; font-size: 11.5px;">
        <tbody>
          <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 8px 10px; width: 52%; border-right: 1px solid #cbd5e1;">
              <strong>Requisition No.:</strong>
              <span style="display: inline-block; min-width: 190px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.requisitionNo || '')}</span>
            </td>
            <td style="padding: 8px 10px; width: 48%;">
              <strong>Date:</strong>
              <span style="display: inline-block; min-width: 155px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.date || '')}</span>
            </td>
          </tr>
          <tr style="background: #ffffff; border-bottom: 1px solid #cbd5e1;">
            <td colspan="2" style="padding: 8px 10px;">
              <strong>Project / Branch Name:</strong>
              <span style="display: inline-block; min-width: 340px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.projectBranchName || '')}</span>
            </td>
          </tr>
          <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
            <td colspan="2" style="padding: 8px 10px;">
              <strong>Site Location:</strong>
              <span style="display: inline-block; min-width: 390px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.siteLocation || '')}</span>
            </td>
          </tr>
          <tr style="background: #ffffff;">
            <td style="padding: 8px 10px; border-right: 1px solid #cbd5e1;">
              <strong>Requested By:</strong>
              <span style="display: inline-block; min-width: 190px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.requestedBy || '')}</span>
            </td>
            <td style="padding: 8px 10px;">
              <strong>Required Delivery Date:</strong>
              <span style="display: inline-block; min-width: 115px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.requiredDeliveryDate || '')}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- MATERIAL DETAILS Heading & Table -->
      <div style="font-size: 13px; font-weight: 800; color: #16325c; margin-bottom: 6px; letter-spacing: 0.3px;">
        MATERIAL DETAILS
      </div>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 16px; font-size: 11px;">
        <thead>
          <tr style="background: #16325c; color: #ffffff; font-weight: 700;">
            <th style="padding: 8px 6px; text-align: center; width: 52px; border-right: 1px solid #335280;">Sr. No.</th>
            <th style="padding: 8px 10px; text-align: left; border-right: 1px solid #335280;">Material Description / Specification</th>
            <th style="padding: 8px 8px; text-align: center; width: 105px; border-right: 1px solid #335280;">Required Qty.</th>
            <th style="padding: 8px 8px; text-align: center; width: 78px; border-right: 1px solid #335280;">Unit</th>
            <th style="padding: 8px 8px; text-align: center; width: 112px;">Available Stock</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- Purpose & Remarks Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 18px; font-size: 11.5px;">
        <tbody>
          <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 6px 10px; font-weight: 700;">Purpose / Work Description:</td>
          </tr>
          <tr style="background: #ffffff; border-bottom: 1px solid #cbd5e1; height: 34px;">
            <td style="padding: 6px 10px;">${escapeHtml(formData.purpose || '')}</td>
          </tr>
          <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 6px 10px; font-weight: 700;">
              Remarks:${Number(manualAmount) > 0 ? ` &nbsp; (Estimated Material Amount: Rs. ${Number(manualAmount).toLocaleString()})` : ''}
            </td>
          </tr>
          <tr style="background: #ffffff; height: 34px;">
            <td style="padding: 6px 10px;">${escapeHtml(formData.remarks || '')}</td>
          </tr>
        </tbody>
      </table>

      <!-- Signatures Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 11.5px;">
        <thead>
          <tr style="background: #e8eff7; border-bottom: 1px solid #cbd5e1; color: #0f172a;">
            <th style="padding: 7px 10px; text-align: left; width: 33.33%; border-right: 1px solid #cbd5e1;">Requested By</th>
            <th style="padding: 7px 10px; text-align: left; width: 33.33%; border-right: 1px solid #cbd5e1;">Checked By</th>
            <th style="padding: 7px 10px; text-align: left; width: 33.33%;">Approved By</th>
          </tr>
        </thead>
        <tbody>
          <tr style="height: 32px; border-bottom: 1px solid #cbd5e1; background: #ffffff;">
            <td style="padding: 6px 10px; border-right: 1px solid #cbd5e1;">${escapeHtml(formData.requestedByName || '')}</td>
            <td style="padding: 6px 10px; border-right: 1px solid #cbd5e1;">${escapeHtml(formData.checkedByName || '')}</td>
            <td style="padding: 6px 10px;">${escapeHtml(formData.approvedByName || '')}</td>
          </tr>
          <tr style="height: 30px; background: #ffffff;">
            <td style="padding: 6px 10px; border-right: 1px solid #cbd5e1;">
              Signature: <span style="display: inline-block; min-width: 130px; border-bottom: 1px solid #475569;">${escapeHtml(formData.requestedBySign || '')}</span>
            </td>
            <td style="padding: 6px 10px; border-right: 1px solid #cbd5e1;">
              Signature: <span style="display: inline-block; min-width: 130px; border-bottom: 1px solid #475569;">${escapeHtml(formData.checkedBySign || '')}</span>
            </td>
            <td style="padding: 6px 10px;">
              Signature: <span style="display: inline-block; min-width: 130px; border-bottom: 1px solid #475569;">${escapeHtml(formData.approvedBySign || '')}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="text-align: center; font-size: 10.5px; color: #64748b; padding-top: 12px;">
      Construction &bull; Civil Works &bull; Electrical Works &bull; Maintenance
    </div>
  `;

  document.body.appendChild(pageEl);
  try {
    const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const renderedHeight = Math.min(pdfHeight, (canvas.height * pdfWidth) / canvas.width);
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, renderedHeight);
    const branchSlug = (formData.projectBranchName || 'Site').replace(/\s+/g, '_');
    pdf.save(`FES_Material_Demand_${branchSlug}.pdf`);
  } finally {
    document.body.removeChild(pageEl);
  }
}

/**
 * Generates an official A4 PDF for FES SITE PAYMENT DEMAND FORM (matching uploaded PDF #2)
 */
export async function downloadPaymentDemandPdf(formData = {}) {
  const logoSrc =
    typeof window !== 'undefined'
      ? `${window.location.origin}/fes-logo-cropped.png`
      : '/fes-logo-cropped.png';

  const items =
    Array.isArray(formData.items) && formData.items.length > 0
      ? formData.items
      : Array.from({ length: 6 }, (_, idx) => ({
          srNo: String(idx + 1),
          description: '',
          amount: '',
          remarks: '',
        }));

  let rowsHtml = '';
  items.forEach((it, idx) => {
    const amtNum = parseFloat(it.amount);
    const amtStr = !isNaN(amtNum) && amtNum > 0 ? amtNum.toLocaleString() : escapeHtml(it.amount || '');
    rowsHtml += `
      <tr style="height: 30px; border-bottom: 1px solid #cbd5e1; background: #ffffff;">
        <td style="padding: 5px 6px; text-align: center; width: 48px; border-right: 1px solid #cbd5e1;">${escapeHtml(it.srNo || idx + 1)}</td>
        <td style="padding: 5px 10px; border-right: 1px solid #cbd5e1;">${escapeHtml(it.description || '')}</td>
        <td style="padding: 5px 10px; text-align: right; width: 135px; border-right: 1px solid #cbd5e1; font-weight: 700;">${amtStr}</td>
        <td style="padding: 5px 10px; width: 165px;">${escapeHtml(it.remarks || '')}</td>
      </tr>
    `;
  });

  const docs = formData.supportingDocs || {};
  const box = (checked) =>
    checked
      ? `<span style="display:inline-block;width:11px;height:11px;background:#0f172a;color:#fff;font-size:9px;line-height:11px;text-align:center;margin-right:4px;">&#10003;</span>`
      : `<span style="display:inline-block;width:11px;height:11px;border:1.2px solid #0f172a;margin-right:4px;vertical-align:middle;"></span>`;

  const fmtAmt = (val) => {
    const n = parseFloat(val);
    if (!isNaN(n) && val !== '' && val !== null && val !== undefined) {
      return `Rs. ${n.toLocaleString()}`;
    }
    return escapeHtml(val || '');
  };

  const pageEl = document.createElement('div');
  pageEl.style.width = '794px';
  pageEl.style.minHeight = '1123px';
  pageEl.style.background = '#ffffff';
  pageEl.style.color = '#0f172a';
  pageEl.style.fontFamily = 'Arial, Helvetica, sans-serif';
  pageEl.style.fontSize = '11.5px';
  pageEl.style.boxSizing = 'border-box';
  pageEl.style.padding = '30px 48px 24px 48px';
  pageEl.style.display = 'flex';
  pageEl.style.flexDirection = 'column';
  pageEl.style.justifyContent = 'space-between';
  pageEl.style.position = 'fixed';
  pageEl.style.top = '-99999px';
  pageEl.style.left = '-99999px';

  pageEl.innerHTML = `
    <div>
      <!-- Official FES Header -->
      <div style="display: flex; align-items: center; gap: 24px; margin-bottom: 16px;">
        <div style="width: 112px; height: 112px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          <img src="${logoSrc}" alt="FES" crossorigin="anonymous" style="width: 108px; height: 108px; object-fit: contain;" />
        </div>
        <div style="flex: 1; text-align: center; padding-right: 20px;">
          <div style="font-size: 25px; font-weight: 800; color: #16325c; letter-spacing: 0.6px;">
            FAST ENGINEERING SOLUTIONS
          </div>
          <div style="font-size: 14.5px; font-weight: 800; color: #cc1f1f; margin-top: 5px; letter-spacing: 0.4px;">
            SITE PAYMENT DEMAND FORM
          </div>
        </div>
      </div>

      <!-- Metadata 4x2 Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 16px; font-size: 11.5px;">
        <tbody>
          <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 7px 10px; width: 52%; border-right: 1px solid #cbd5e1;">
              <strong>Payment Demand No.:</strong>
              <span style="display: inline-block; min-width: 160px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.paymentDemandNo || '')}</span>
            </td>
            <td style="padding: 7px 10px; width: 48%;">
              <strong>Date:</strong>
              <span style="display: inline-block; min-width: 155px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.date || '')}</span>
            </td>
          </tr>
          <tr style="background: #ffffff; border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 7px 10px; border-right: 1px solid #cbd5e1;">
              <strong>Project / Site Name:</strong>
              <span style="display: inline-block; min-width: 175px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.projectSiteName || '')}</span>
            </td>
            <td style="padding: 7px 10px;">
              <strong>Site Location:</strong>
              <span style="display: inline-block; min-width: 165px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.siteLocation || '')}</span>
            </td>
          </tr>
          <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 7px 10px; border-right: 1px solid #cbd5e1;">
              <strong>Client / Bank:</strong>
              <span style="display: inline-block; min-width: 210px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.clientBank || '')}</span>
            </td>
            <td style="padding: 7px 10px;">
              <strong>Branch / Ticket No.:</strong>
              <span style="display: inline-block; min-width: 135px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.branchTicketNo || '')}</span>
            </td>
          </tr>
          <tr style="background: #ffffff;">
            <td style="padding: 7px 10px; border-right: 1px solid #cbd5e1;">
              <strong>Site In-Charge:</strong>
              <span style="display: inline-block; min-width: 195px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.siteInCharge || '')}</span>
            </td>
            <td style="padding: 7px 10px;">
              <strong>Contact No.:</strong>
              <span style="display: inline-block; min-width: 170px; border-bottom: 1px solid #475569; padding: 0 6px 1px 6px; margin-left: 4px;">${escapeHtml(formData.contactNo || '')}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- PAYMENT REQUIREMENT DETAILS -->
      <div style="font-size: 13px; font-weight: 800; color: #16325c; margin-bottom: 6px; letter-spacing: 0.3px;">
        PAYMENT REQUIREMENT DETAILS
      </div>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 12px; font-size: 11px;">
        <thead>
          <tr style="background: #16325c; color: #ffffff; font-weight: 700;">
            <th style="padding: 8px 6px; text-align: center; width: 48px; border-right: 1px solid #335280;">Sr.</th>
            <th style="padding: 8px 10px; text-align: left; border-right: 1px solid #335280;">Description / Purpose</th>
            <th style="padding: 8px 10px; text-align: right; width: 135px; border-right: 1px solid #335280;">Amount (PKR)</th>
            <th style="padding: 8px 10px; text-align: left; width: 165px;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- 4-Row Financial Summary Box -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 12px; font-size: 11.5px;">
        <tbody>
          <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 6px 10px;">
              <strong>Total Amount Required (PKR):</strong> &nbsp; <span>${fmtAmt(formData.totalAmountRequired)}</span>
            </td>
          </tr>
          <tr style="background: #ffffff; border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 6px 10px;">
              <strong>Amount Already Issued / Available (PKR):</strong> &nbsp; <span>${fmtAmt(formData.amountAlreadyIssued)}</span>
            </td>
          </tr>
          <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 6px 10px;">
              <strong>Net Amount Demanded (PKR):</strong> &nbsp; <strong style="color: #16325c;">${fmtAmt(formData.netAmountDemanded)}</strong>
            </td>
          </tr>
          <tr style="background: #ffffff;">
            <td style="padding: 6px 10px;">
              <strong>Amount in Words:</strong> &nbsp; <span>${escapeHtml(formData.amountInWords || '')}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Purpose & Supporting Documents -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 14px; font-size: 11.5px;">
        <tbody>
          <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 6px 10px; font-weight: 700;">Purpose / Justification for Payment:</td>
          </tr>
          <tr style="background: #ffffff; border-bottom: 1px solid #cbd5e1; height: 32px;">
            <td style="padding: 6px 10px;">${escapeHtml(formData.purposeJustification || '')}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 7px 10px;">
              <strong>Supporting Documents Attached:</strong> &nbsp;
              ${box(docs.estimateBoq)} Estimate/BOQ &nbsp;&nbsp;
              ${box(docs.invoice)} Invoice &nbsp;&nbsp;
              ${box(docs.receipts)} Receipts &nbsp;&nbsp;
              ${box(docs.other)} Other:
              <span style="display: inline-block; min-width: 90px; border-bottom: 1px solid #475569; padding: 0 4px;">${escapeHtml(docs.otherText || '')}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Signatures Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 11.5px;">
        <thead>
          <tr style="background: #e8eff7; border-bottom: 1px solid #cbd5e1; color: #0f172a;">
            <th style="padding: 7px 10px; text-align: left; width: 33.33%; border-right: 1px solid #cbd5e1;">Requested By</th>
            <th style="padding: 7px 10px; text-align: left; width: 33.33%; border-right: 1px solid #cbd5e1;">Verified By</th>
            <th style="padding: 7px 10px; text-align: left; width: 33.33%;">Approved By</th>
          </tr>
        </thead>
        <tbody>
          <tr style="height: 28px; border-bottom: 1px solid #cbd5e1; background: #ffffff;">
            <td style="padding: 5px 10px; border-right: 1px solid #cbd5e1;">${escapeHtml(formData.requestedByName || '')}</td>
            <td style="padding: 5px 10px; border-right: 1px solid #cbd5e1;">${escapeHtml(formData.verifiedByName || '')}</td>
            <td style="padding: 5px 10px;">${escapeHtml(formData.approvedByName || '')}</td>
          </tr>
          <tr style="height: 28px; background: #ffffff;">
            <td style="padding: 5px 10px; border-right: 1px solid #cbd5e1;">
              Name / Signature: <span style="display: inline-block; min-width: 105px; border-bottom: 1px solid #475569;">${escapeHtml(formData.requestedBySign || '')}</span>
            </td>
            <td style="padding: 5px 10px; border-right: 1px solid #cbd5e1;">
              Name / Signature: <span style="display: inline-block; min-width: 105px; border-bottom: 1px solid #475569;">${escapeHtml(formData.verifiedBySign || '')}</span>
            </td>
            <td style="padding: 5px 10px;">
              Name / Signature: <span style="display: inline-block; min-width: 105px; border-bottom: 1px solid #475569;">${escapeHtml(formData.approvedBySign || '')}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="text-align: center; font-size: 10.5px; color: #64748b; padding-top: 10px;">
      For site-related material, labour, transport, subcontractor and other project expenses.
    </div>
  `;

  document.body.appendChild(pageEl);
  try {
    const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const renderedHeight = Math.min(pdfHeight, (canvas.height * pdfWidth) / canvas.width);
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, renderedHeight);
    const branchSlug = (formData.projectSiteName || 'Site').replace(/\s+/g, '_');
    pdf.save(`FES_Payment_Demand_${branchSlug}.pdf`);
  } finally {
    document.body.removeChild(pageEl);
  }
}
