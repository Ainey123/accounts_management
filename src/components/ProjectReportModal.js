"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  HardHat, X, Save, Send, Download, Upload, Camera, FileText, CheckCircle2,
  AlertTriangle, DollarSign, Calendar, Mail, Paperclip
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PROJECT_EXPENSE_TEMPLATE, PROJECT_PROGRESS_TEMPLATE } from '@/lib/projectReportTemplates';
import { downloadExpenseReportPdf, downloadProgressReportPdf } from '@/lib/projectPdfGenerator';

export default function ProjectReportModal({ job, existingReport = null, onClose, onSubmitted }) {
  const [activeTab, setActiveTab] = useState('progress'); // 'progress' | 'expense' | 'attachments'
  const [progressSections, setProgressSections] = useState([]);
  const [expenseSections, setExpenseSections] = useState([]);
  const [paidBy, setPaidBy] = useState('FES');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (existingReport && existingReport.progressData) {
      try {
        const parsed = JSON.parse(existingReport.progressData);
        setProgressSections(Array.isArray(parsed) && parsed.length > 0 ? parsed : JSON.parse(JSON.stringify(PROJECT_PROGRESS_TEMPLATE)));
      } catch {
        setProgressSections(JSON.parse(JSON.stringify(PROJECT_PROGRESS_TEMPLATE)));
      }
    } else {
      setProgressSections(JSON.parse(JSON.stringify(PROJECT_PROGRESS_TEMPLATE)));
    }

    if (existingReport && existingReport.expenseData) {
      try {
        const parsed = JSON.parse(existingReport.expenseData);
        setExpenseSections(Array.isArray(parsed) && parsed.length > 0 ? parsed : JSON.parse(JSON.stringify(PROJECT_EXPENSE_TEMPLATE)));
      } catch {
        setExpenseSections(JSON.parse(JSON.stringify(PROJECT_EXPENSE_TEMPLATE)));
      }
    } else {
      setExpenseSections(JSON.parse(JSON.stringify(PROJECT_EXPENSE_TEMPLATE)));
    }

    if (existingReport && existingReport.attachments) {
      try {
        const parsed = JSON.parse(existingReport.attachments);
        setAttachments(Array.isArray(parsed) ? parsed : []);
      } catch {
        setAttachments([]);
      }
    } else {
      setAttachments([]);
    }

    if (existingReport?.paidBy) setPaidBy(existingReport.paidBy);
    if (existingReport?.reportDate) {
      try {
        setReportDate(new Date(existingReport.reportDate).toISOString().split('T')[0]);
      } catch {}
    }
  }, [existingReport]);

  const calculateTotalExpenses = () => {
    let sum = 0;
    expenseSections.forEach((sec) => {
      (sec.items || []).forEach((item) => {
        const val = parseFloat(item.amount);
        if (!isNaN(val) && val > 0) sum += val;
      });
    });
    return sum;
  };

  const calculateOverallProgress = () => {
    let total = 0;
    let count = 0;
    progressSections.forEach((sec) => {
      (sec.items || []).forEach((item) => {
        const val = parseFloat(item.workPercent);
        if (!isNaN(val)) {
          total += val;
          count++;
        }
      });
    });
    return count > 0 ? Math.round(total / count) : 0;
  };

  const handleProgressChange = (secIndex, itemIndex, field, value) => {
    setProgressSections((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      clone[secIndex].items[itemIndex][field] = value;
      return clone;
    });
  };

  const handleExpenseChange = (secIndex, itemIndex, field, value) => {
    setExpenseSections((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      clone[secIndex].items[itemIndex][field] = value;
      return clone;
    });
  };

  const addExpenseCustomRow = (secIndex) => {
    setExpenseSections((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      const items = clone[secIndex].items;
      const nextLetter = String.fromCharCode(97 + items.length);
      items.push({ code: nextLetter, name: '', qty: '', amount: '', others: '', isCustom: true });
      return clone;
    });
  };

  const addProgressCustomRow = (secIndex) => {
    setProgressSections((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      const items = clone[secIndex].items;
      const nextLetter = String.fromCharCode(97 + items.length);
      items.push({ code: nextLetter, name: '', unit: 'Jop', workPercent: '', remark: '', others: '', isCustom: true });
      return clone;
    });
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            type: file.type,
            url: event.target.result,
            uploadedAt: new Date().toISOString(),
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveOrSubmit = async (statusToSet = 'SUBMITTED') => {
    if (!job?.id) return;
    const isSubmitting = statusToSet === 'SUBMITTED';
    if (isSubmitting) setSubmitting(true);
    else setSavingDraft(true);
    setMessage({ type: '', text: '' });

    const totalExpense = calculateTotalExpenses();
    const overallProgress = calculateOverallProgress();

    try {
      const payload = {
        jobMetadataId: job.id,
        branchName: job.branchName,
        reportDate,
        expenseData: expenseSections,
        progressData: progressSections,
        totalExpenseAmount: totalExpense,
        overallProgressPercent: overallProgress,
        attachments,
        paidBy,
        status: statusToSet,
      };

      const res = await apiFetch('/api/project-reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage({
        type: 'success',
        text: isSubmitting
          ? '🎉 Project reports and expenses submitted! Automatically routed to the office employee.'
          : '💾 Draft saved successfully.',
      });

      if (onSubmitted) {
        onSubmitted(res.report);
      }

      if (isSubmitting) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Submission failed: ' + err.message });
    } finally {
      setSubmitting(false);
      setSavingDraft(false);
    }
  };

  const handleDownloadExpensePdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadExpenseReportPdf({
        job,
        reportDate,
        sections: expenseSections,
        totalExpenseAmount: calculateTotalExpenses(),
        paidBy,
        employeeName: job.assignedEmployee?.employeeName || 'Field Engineer',
      });
    } catch (err) {
      setMessage({ type: 'error', text: 'PDF export failed: ' + err.message });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadProgressPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadProgressReportPdf({
        job,
        reportDate,
        sections: progressSections,
        overallProgressPercent: calculateOverallProgress(),
        employeeName: job.assignedEmployee?.employeeName || 'Field Engineer',
      });
    } catch (err) {
      setMessage({ type: 'error', text: 'PDF export failed: ' + err.message });
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          border: '1px solid rgba(52, 211, 153, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'rgba(15, 23, 42, 0.95)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <HardHat size={22} color="#34d399" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 'bold', color: '#f8fafc' }}>
                  Project Digital Report: {job.branchName}
                </span>
                <span style={{ fontFamily: 'monospace', color: '#00f2fe', fontSize: 12, fontWeight: 'bold' }}>
                  #{job.ticket?.serialNo || job.id}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Client: <strong style={{ color: '#e2e8f0' }}>{job.clientName}</strong> | POC: {job.personOfContact}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="nexus-btn nexus-btn-ghost"
              onClick={onClose}
              style={{ padding: 6, minWidth: 'auto' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Originating Email Bar */}
        <div style={{ padding: '8px 20px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={13} color="#38bdf8" />
          <span style={{ color: '#64748b' }}>Email Subject:</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{job.ticket?.subject || '—'}</span>
          {job.ticket?.sender && (
            <span style={{ color: '#64748b', fontSize: 11 }}>From: {job.ticket.sender}</span>
          )}
        </div>

        {/* Message Banner */}
        {message.text && (
          <div style={{ padding: '10px 20px', background: message.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)', color: message.type === 'error' ? '#f87171' : '#4ade80', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {message.text}
          </div>
        )}

        {/* Tabs Bar */}
        <div style={{ display: 'flex', padding: '10px 20px 0 20px', background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 8 }}>
          <button
            type="button"
            className={`tab-segment-btn ${activeTab === 'progress' ? 'active-field' : ''}`}
            onClick={() => setActiveTab('progress')}
            style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px', fontSize: 12 }}
          >
            1. Daily Progress Report (9 Categories)
          </button>
          <button
            type="button"
            className={`tab-segment-btn ${activeTab === 'expense' ? 'active-field' : ''}`}
            onClick={() => setActiveTab('expense')}
            style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px', fontSize: 12 }}
          >
            2. Project Expense Report (11 Categories)
          </button>
          <button
            type="button"
            className={`tab-segment-btn ${activeTab === 'attachments' ? 'active-field' : ''}`}
            onClick={() => setActiveTab('attachments')}
            style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px', fontSize: 12 }}
          >
            3. Bills & Receipts ({attachments.length})
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* TAB 1: PROGRESS REPORT */}
          {activeTab === 'progress' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>
                  Progress Report for <strong>{job.branchName}</strong> (Civil, Electrical, HVAC, Plumbing, IT, Wood, Ceiling, Glass, Paint)
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '4px 10px', borderRadius: 6, fontWeight: 'bold', fontSize: 13 }}>
                    Overall: {calculateOverallProgress()}%
                  </span>
                  <button type="button" className="nexus-btn nexus-btn-ghost" onClick={handleDownloadProgressPdf} disabled={downloadingPdf} style={{ padding: '4px 10px', fontSize: 11 }}>
                    <Download size={12} /> Progress PDF
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {progressSections.map((sec, secIdx) => {
                  let secTotal = 0;
                  let count = 0;
                  (sec.items || []).forEach((it) => {
                    const p = parseFloat(it.workPercent);
                    if (!isNaN(p)) {
                      secTotal += p;
                      count++;
                    }
                  });
                  const secAvg = count > 0 ? Math.round(secTotal / count) : 0;

                  return (
                    <div key={sec.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <strong style={{ color: '#38bdf8', fontSize: 13 }}>{sec.id}. {sec.title}</strong>
                        <span style={{ fontSize: 12, color: secAvg > 0 ? '#34d399' : '#64748b' }}>Avg: {secAvg}%</span>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left' }}>
                              <th style={{ width: 28, padding: 4 }}>Sr</th>
                              <th style={{ padding: 4 }}>Type of work</th>
                              <th style={{ width: 60, padding: 4 }}>Unit</th>
                              <th style={{ width: 70, padding: 4 }}>Work%</th>
                              <th style={{ padding: 4 }}>Remak</th>
                              <th style={{ padding: 4 }}>Others</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sec.items.map((item, itIdx) => (
                              <tr key={itIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <td style={{ color: '#64748b', padding: 4, fontFamily: 'monospace' }}>{item.code}</td>
                                <td style={{ padding: 4, color: '#cbd5e1' }}>
                                  {item.isCustom ? (
                                    <input className="nexus-input" style={{ padding: '2px 6px', fontSize: 11, height: 24 }} placeholder="Custom row..." value={item.name} onChange={(e) => handleProgressChange(secIdx, itIdx, 'name', e.target.value)} />
                                  ) : item.name}
                                </td>
                                <td style={{ padding: 4 }}>
                                  <input className="nexus-input" style={{ padding: '2px 6px', fontSize: 11, height: 24, width: '100%' }} value={item.unit} onChange={(e) => handleProgressChange(secIdx, itIdx, 'unit', e.target.value)} />
                                </td>
                                <td style={{ padding: 4 }}>
                                  <input type="number" min="0" max="100" className="nexus-input" style={{ padding: '2px 6px', fontSize: 11, height: 24, width: '100%', color: item.workPercent ? '#34d399' : 'inherit', fontWeight: 600 }} placeholder="0" value={item.workPercent} onChange={(e) => handleProgressChange(secIdx, itIdx, 'workPercent', e.target.value)} />
                                </td>
                                <td style={{ padding: 4 }}>
                                  <input className="nexus-input" style={{ padding: '2px 6px', fontSize: 11, height: 24, width: '100%' }} placeholder="Remark..." value={item.remark} onChange={(e) => handleProgressChange(secIdx, itIdx, 'remark', e.target.value)} />
                                </td>
                                <td style={{ padding: 4 }}>
                                  <input className="nexus-input" style={{ padding: '2px 6px', fontSize: 11, height: 24, width: '100%' }} placeholder="Others..." value={item.others} onChange={(e) => handleProgressChange(secIdx, itIdx, 'others', e.target.value)} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button type="button" onClick={() => addProgressCustomRow(secIdx)} style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 11, marginTop: 6, cursor: 'pointer', padding: 0 }}>
                        + Add Custom Row in {sec.title}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: EXPENSE REPORT */}
          {activeTab === 'expense' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <label className="field-label" style={{ marginBottom: 2 }}>Payment Mode:</label>
                    <select className="nexus-select" style={{ fontSize: 12, padding: '4px 8px', height: 28 }} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                      <option value="FES">FES Direct Advance</option>
                      <option value="EMPLOYEE">Field Employee Claim</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label" style={{ marginBottom: 2 }}>Report Date:</label>
                    <input type="date" className="nexus-input" style={{ fontSize: 12, padding: '2px 8px', height: 28 }} value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: 6, fontWeight: 'bold', fontSize: 13 }}>
                    Grand Total: Rs. {calculateTotalExpenses().toLocaleString()}
                  </span>
                  <button type="button" className="nexus-btn nexus-btn-ghost" onClick={handleDownloadExpensePdf} disabled={downloadingPdf} style={{ padding: '4px 10px', fontSize: 11 }}>
                    <Download size={12} /> Expense PDF
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {expenseSections.map((sec, secIdx) => {
                  let secTotal = 0;
                  (sec.items || []).forEach((it) => {
                    const a = parseFloat(it.amount);
                    if (!isNaN(a) && a > 0) secTotal += a;
                  });

                  return (
                    <div key={sec.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <strong style={{ color: '#38bdf8', fontSize: 13 }}>{sec.id}. {sec.title}</strong>
                        <span style={{ fontSize: 12, color: secTotal > 0 ? '#38bdf8' : '#64748b' }}>Subtotal: Rs. {secTotal.toLocaleString()}</span>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left' }}>
                              <th style={{ width: 28, padding: 4 }}>Sr</th>
                              <th style={{ padding: 4 }}>Item / Type of work</th>
                              <th style={{ width: 70, padding: 4 }}>Qty</th>
                              <th style={{ width: 100, padding: 4 }}>Amount (Rs)</th>
                              <th style={{ padding: 4 }}>Others / Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sec.items.map((item, itIdx) => (
                              <tr key={itIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <td style={{ color: '#64748b', padding: 4, fontFamily: 'monospace' }}>{item.code}</td>
                                <td style={{ padding: 4, color: '#cbd5e1' }}>
                                  {item.isCustom ? (
                                    <input className="nexus-input" style={{ padding: '2px 6px', fontSize: 11, height: 24 }} placeholder="Item name..." value={item.name} onChange={(e) => handleExpenseChange(secIdx, itIdx, 'name', e.target.value)} />
                                  ) : item.name}
                                </td>
                                <td style={{ padding: 4 }}>
                                  <input className="nexus-input" style={{ padding: '2px 6px', fontSize: 11, height: 24, width: '100%' }} placeholder="Qty" value={item.qty} onChange={(e) => handleExpenseChange(secIdx, itIdx, 'qty', e.target.value)} />
                                </td>
                                <td style={{ padding: 4 }}>
                                  <input type="number" min="0" className="nexus-input" style={{ padding: '2px 6px', fontSize: 11, height: 24, width: '100%', color: item.amount ? '#38bdf8' : 'inherit', fontWeight: 600 }} placeholder="Rs." value={item.amount} onChange={(e) => handleExpenseChange(secIdx, itIdx, 'amount', e.target.value)} />
                                </td>
                                <td style={{ padding: 4 }}>
                                  <input className="nexus-input" style={{ padding: '2px 6px', fontSize: 11, height: 24, width: '100%' }} placeholder="Remarks..." value={item.others} onChange={(e) => handleExpenseChange(secIdx, itIdx, 'others', e.target.value)} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button type="button" onClick={() => addExpenseCustomRow(secIdx)} style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 11, marginTop: 6, cursor: 'pointer', padding: 0 }}>
                        + Add Custom Row in {sec.title}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: ATTACHMENTS */}
          {activeTab === 'attachments' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Attach bill receipts, invoices, and site photos.</div>
                <div>
                  <input type="file" accept="image/*,application/pdf" multiple ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                  <button type="button" className="nexus-btn nexus-btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => fileInputRef.current?.click()}>
                    <Upload size={13} /> Upload Bills / Photos
                  </button>
                </div>
              </div>

              {attachments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 36, color: '#64748b', background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.08)' }}>
                  <Camera size={32} color="#64748b" style={{ margin: '0 auto 8px auto' }} />
                  <div>No receipt attached.</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Click "Upload Bills / Photos" to attach camera shots or files.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {attachments.map((att, idx) => (
                    <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                      {att.url && att.url.startsWith('data:image') ? (
                        <img src={att.url} alt={att.name} style={{ width: '100%', height: 100, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={32} color="#38bdf8" />
                        </div>
                      )}
                      <div style={{ padding: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{att.name || `File #${idx + 1}`}</span>
                        <button type="button" onClick={() => removeAttachment(idx)} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}>
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '12px 20px',
            background: 'rgba(15, 23, 42, 0.95)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#f8fafc' }}>
              Progress: <span style={{ color: '#34d399' }}>{calculateOverallProgress()}%</span> | Total: <span style={{ color: '#38bdf8' }}>Rs. {calculateTotalExpenses().toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Submission will automatically sync to responsible office employee&apos;s feed
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="nexus-btn nexus-btn-ghost"
              onClick={() => handleSaveOrSubmit('IN_PROGRESS')}
              disabled={savingDraft || submitting}
              style={{ padding: '8px 14px', fontSize: 12 }}
            >
              <Save size={14} /> {savingDraft ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              className="nexus-btn nexus-btn-primary"
              onClick={() => handleSaveOrSubmit('SUBMITTED')}
              disabled={submitting || savingDraft}
              style={{
                padding: '8px 18px',
                fontSize: 12,
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                fontWeight: 600,
              }}
            >
              <Send size={14} /> {submitting ? 'Submitting...' : 'Submit Both Reports'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
