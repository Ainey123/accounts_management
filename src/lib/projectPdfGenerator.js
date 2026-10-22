import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates an official PDF for the Project Expense Report matching FES_Expens_Report_All_Pages.pdf
 */
export async function downloadExpenseReportPdf({ job, reportDate, sections, totalExpenseAmount, paidBy, employeeName }) {
  const branchName = job?.branchName || 'Branch Site';
  const serialNo = job?.ticket?.serialNo || job?.id || '';
  const clientName = job?.clientName || 'Client';
  const displayDate = reportDate ? new Date(reportDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

  // Create an offscreen printable container
  const container = document.createElement('div');
  container.className = 'pdf-render-root';
  container.style.width = '800px';
  container.style.padding = '24px';
  container.style.background = '#ffffff';
  container.style.color = '#000000';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.fontSize = '11px';
  container.style.position = 'absolute';
  container.style.top = '-99999px';
  container.style.left = '-99999px';

  let sectionsHtml = '';
  sections.forEach((sec, idx) => {
    let rowsHtml = '';
    const items = sec.items || [];
    let secTotal = 0;

    items.forEach((item) => {
      const amt = parseFloat(item.amount) || 0;
      secTotal += amt;
      const itemName = item.isCustom ? (item.name || '(Custom Item)') : item.name;
      const itemCode = item.code || '';
      rowsHtml += `
        <tr style="border-bottom: 1px solid #cbd5e1;">
          <td style="padding: 4px 6px; text-align: center; width: 35px; border-right: 1px solid #cbd5e1;">${itemCode}</td>
          <td style="padding: 4px 8px; border-right: 1px solid #cbd5e1;">${itemName}</td>
          <td style="padding: 4px 6px; text-align: center; width: 60px; border-right: 1px solid #cbd5e1;">${item.qty || '—'}</td>
          <td style="padding: 4px 8px; text-align: right; width: 90px; border-right: 1px solid #cbd5e1; font-weight: 500;">${amt > 0 ? amt.toLocaleString() : '—'}</td>
          <td style="padding: 4px 8px; color: #475569;">${item.others || '—'}</td>
        </tr>
      `;
    });

    sectionsHtml += `
      <div style="margin-bottom: 16px; page-break-inside: avoid; border: 1px solid #94a3b8; border-radius: 4px; overflow: hidden;">
        <div style="background: #f1f5f9; padding: 6px 10px; font-weight: bold; border-bottom: 1px solid #94a3b8; display: flex; justify-content: space-between;">
          <span>${sec.id}. ${sec.title}</span>
          <span style="color: #0f172a;">Subtotal: Rs. ${secTotal.toLocaleString()}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; font-weight: 600;">
              <th style="padding: 4px 6px; text-align: center; width: 35px; border-right: 1px solid #cbd5e1;">Sr</th>
              <th style="padding: 4px 8px; text-align: left; border-right: 1px solid #cbd5e1;">Description</th>
              <th style="padding: 4px 6px; text-align: center; width: 60px; border-right: 1px solid #cbd5e1;">Qty</th>
              <th style="padding: 4px 8px; text-align: right; width: 90px; border-right: 1px solid #cbd5e1;">Amount (Rs)</th>
              <th style="padding: 4px 8px; text-align: left;">Remarks / Others</th>
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
    <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 style="margin: 0; font-size: 18px; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px;">FAST ENGINEERING SOLUTIONS (FES)</h1>
        <h2 style="margin: 2px 0 0 0; font-size: 13px; color: #334155;">Project Expense Report</h2>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Ref Serial: #${serialNo} | Client: ${clientName}</div>
      </div>
      <div style="text-align: right; font-size: 11px;">
        <div style="font-weight: bold; font-size: 12px; color: #0f172a;">${branchName}</div>
        <div style="color: #475569; margin-top: 2px;">Date: ${displayDate}</div>
        <div style="color: #64748b; margin-top: 2px;">Field Staff: ${employeeName || '—'}</div>
      </div>
    </div>

    ${sectionsHtml}

    <div style="margin-top: 20px; padding: 14px; background: #f8fafc; border: 2px solid #0284c7; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 12px; font-weight: bold; color: #0f172a;">Payment Mode: Paid by ${paidBy || 'FES'}</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Verified electronic submission via NEXUS Operations</div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 12px; font-weight: 600; color: #475569; margin-right: 12px;">GRAND TOTAL:</span>
        <span style="font-size: 18px; font-weight: bold; color: #0284c7;">Rs. ${(Number(totalExpenseAmount) || 0).toLocaleString()}</span>
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
    
    // Support multi-page splitting if height exceeds A4
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

    pdf.save(`FES_Project_Expense_${branchName.replace(/\s+/g, '_')}_${serialNo}.pdf`);
  } catch (err) {
    console.error('Expense PDF generation error:', err);
    throw err;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Generates an official PDF for the Daily Progress Report matching progress report UBL Bank branch
 */
export async function downloadProgressReportPdf({ job, reportDate, sections, overallProgressPercent, employeeName }) {
  const branchName = job?.branchName || 'Branch Site';
  const serialNo = job?.ticket?.serialNo || job?.id || '';
  const clientName = job?.clientName || 'Client';
  const displayDate = reportDate ? new Date(reportDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

  const container = document.createElement('div');
  container.className = 'pdf-render-root';
  container.style.width = '800px';
  container.style.padding = '24px';
  container.style.background = '#ffffff';
  container.style.color = '#000000';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.fontSize = '11px';
  container.style.position = 'absolute';
  container.style.top = '-99999px';
  container.style.left = '-99999px';

  let sectionsHtml = '';
  sections.forEach((sec) => {
    let rowsHtml = '';
    const items = sec.items || [];
    let totalWorkPct = 0;
    let countPct = 0;

    items.forEach((item) => {
      const pct = parseFloat(item.workPercent);
      if (!isNaN(pct)) {
        totalWorkPct += pct;
        countPct++;
      }
      const itemName = item.isCustom ? (item.name || '(Custom Item)') : item.name;
      const itemCode = item.code || '';
      rowsHtml += `
        <tr style="border-bottom: 1px solid #cbd5e1;">
          <td style="padding: 4px 6px; text-align: center; width: 35px; border-right: 1px solid #cbd5e1;">${itemCode}</td>
          <td style="padding: 4px 8px; border-right: 1px solid #cbd5e1;">${itemName}</td>
          <td style="padding: 4px 6px; text-align: center; width: 50px; border-right: 1px solid #cbd5e1;">${item.unit || '—'}</td>
          <td style="padding: 4px 8px; text-align: center; width: 70px; border-right: 1px solid #cbd5e1; font-weight: 600; color: ${pct > 0 ? '#059669' : '#64748b'};">${!isNaN(pct) ? `${pct}%` : '—'}</td>
          <td style="padding: 4px 8px; border-right: 1px solid #cbd5e1;">${item.remark || '—'}</td>
          <td style="padding: 4px 8px; color: #475569;">${item.others || '—'}</td>
        </tr>
      `;
    });

    const avgPct = countPct > 0 ? Math.round(totalWorkPct / countPct) : 0;

    sectionsHtml += `
      <div style="margin-bottom: 16px; page-break-inside: avoid; border: 1px solid #94a3b8; border-radius: 4px; overflow: hidden;">
        <div style="background: #f1f5f9; padding: 6px 10px; font-weight: bold; border-bottom: 1px solid #94a3b8; display: flex; justify-content: space-between;">
          <span>${sec.id}. ${sec.title}</span>
          <span style="color: #059669;">Section Average: ${avgPct}%</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; font-weight: 600;">
              <th style="padding: 4px 6px; text-align: center; width: 35px; border-right: 1px solid #cbd5e1;">Sr</th>
              <th style="padding: 4px 8px; text-align: left; border-right: 1px solid #cbd5e1;">Type of work</th>
              <th style="padding: 4px 6px; text-align: center; width: 50px; border-right: 1px solid #cbd5e1;">unit</th>
              <th style="padding: 4px 8px; text-align: center; width: 70px; border-right: 1px solid #cbd5e1;">Work%</th>
              <th style="padding: 4px 8px; text-align: left; border-right: 1px solid #cbd5e1;">Remak</th>
              <th style="padding: 4px 8px; text-align: left;">others</th>
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
    <div style="border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 style="margin: 0; font-size: 18px; color: #047857; text-transform: uppercase; letter-spacing: 0.5px;">FAST ENGINEERING SOLUTIONS (FES)</h1>
        <h2 style="margin: 2px 0 0 0; font-size: 13px; color: #334155;">Daily / Project Progress Report</h2>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Ref Serial: #${serialNo} | Client: ${clientName}</div>
      </div>
      <div style="text-align: right; font-size: 11px;">
        <div style="font-weight: bold; font-size: 12px; color: #0f172a;">${branchName}</div>
        <div style="color: #475569; margin-top: 2px;">Date: ${displayDate}</div>
        <div style="color: #64748b; margin-top: 2px;">Field Staff: ${employeeName || '—'}</div>
      </div>
    </div>

    ${sectionsHtml}

    <div style="margin-top: 20px; padding: 14px; background: #f0fdf4; border: 2px solid #059669; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 12px; font-weight: bold; color: #065f46;">Site Execution & Inspection Status</div>
        <div style="font-size: 10px; color: #047857; margin-top: 2px;">Certified field progress report submitted to office management</div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 12px; font-weight: 600; color: #374151; margin-right: 12px;">OVERALL PROGRESS:</span>
        <span style="font-size: 20px; font-weight: bold; color: #059669;">${Math.round(overallProgressPercent || 0)}%</span>
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

    pdf.save(`FES_Daily_Progress_${branchName.replace(/\s+/g, '_')}_${serialNo}.pdf`);
  } catch (err) {
    console.error('Progress PDF generation error:', err);
    throw err;
  } finally {
    document.body.removeChild(container);
  }
}
