"use client";

import React, { useState } from 'react';
import {
  HardHat, Download, CheckCircle2, AlertTriangle, FileText,
  DollarSign, Check, X, Eye, Clock, MessageSquare, AlertCircle, RefreshCw
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { downloadExpenseReportPdf, downloadProgressReportPdf } from '@/lib/projectPdfGenerator';

export default function ProjectReportReviewer({ job, onReportUpdated }) {
  const reports = job?.projectReports || [];
  const latestReport = reports.length > 0 ? reports[0] : null;

  const [activeTab, setActiveTab] = useState('expense'); // 'expense' | 'progress' | 'bills' | 'audits'
  const [reviewerComment, setReviewerComment] = useState('');
  const [showCorrectionBox, setShowCorrectionBox] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [downloading, setDownloading] = useState(false);

  if (!latestReport) {
    return (
      <div style={{ padding: 24, background: 'rgba(0,0,0,0.25)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <HardHat size={36} color="#64748b" style={{ margin: '0 auto 8px auto' }} />
        <h4 style={{ margin: '4px 0', fontSize: 15, color: '#f8fafc' }}>No Field Reports Submitted Yet</h4>
        <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
          Assigned to: <strong style={{ color: '#38bdf8' }}>{job.assignedEmployee?.employeeName || 'Unassigned'}</strong>
        </p>
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          When the field employee submits their Project reports and expenses, they will appear here automatically for review.
        </p>
      </div>
    );
  }

  let expenseSections = [];
  try {
    expenseSections = JSON.parse(latestReport.expenseData || '[]');
  } catch {}

  let progressSections = [];
  try {
    progressSections = JSON.parse(latestReport.progressData || '[]');
  } catch {}

  let attachments = [];
  try {
    attachments = JSON.parse(latestReport.attachments || '[]');
  } catch {}

  const handleUpdateStatus = async (newStatus) => {
    if (newStatus === 'CORRECTION_REQUIRED' && !reviewerComment.trim()) {
      setMessage('Please enter comments explaining what needs correction.');
      return;
    }

    setProcessing(true);
    setMessage('');
    try {
      await apiFetch(`/api/project-reports/${latestReport.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          reviewerNotes: reviewerComment.trim() || undefined,
        }),
      });
      setMessage(newStatus === 'APPROVED' ? 'Report successfully approved!' : 'Correction request sent to field employee.');
      setShowCorrectionBox(false);
      setReviewerComment('');
      if (onReportUpdated) {
        onReportUpdated();
      }
    } catch (err) {
      setMessage('Error updating status: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadExpensePdf = async () => {
    setDownloading(true);
    try {
      await downloadExpenseReportPdf({
        job,
        reportDate: latestReport.reportDate,
        sections: expenseSections,
        totalExpenseAmount: latestReport.totalExpenseAmount,
        paidBy: latestReport.paidBy,
        employeeName: latestReport.employee?.employeeName,
      });
    } catch (err) {
      setMessage('PDF download failed: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadProgressPdf = async () => {
    setDownloading(true);
    try {
      await downloadProgressReportPdf({
        job,
        reportDate: latestReport.reportDate,
        sections: progressSections,
        overallProgressPercent: latestReport.overallProgressPercent,
        employeeName: latestReport.employee?.employeeName,
      });
    } catch (err) {
      setMessage('PDF download failed: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'APPROVED') return '#4ade80';
    if (status === 'CORRECTION_REQUIRED') return '#f87171';
    if (status === 'SUBMITTED') return '#38bdf8';
    return '#fbbf24';
  };

  return (
    <div style={{ padding: 20, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc' }}>
              Field Report Review: {latestReport.branchName || job.branchName}
            </h3>
            <span
              style={{
                fontSize: 11,
                fontWeight: 'bold',
                padding: '3px 8px',
                borderRadius: 4,
                background: `${getStatusColor(latestReport.status)}20`,
                color: getStatusColor(latestReport.status),
                border: `1px solid ${getStatusColor(latestReport.status)}40`,
              }}
            >
              {latestReport.status}
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>
              v{latestReport.version}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Submitted by: <strong style={{ color: '#38bdf8' }}>{latestReport.employee?.employeeName || 'Field Employee'}</strong> | Mode: Paid by <strong style={{ color: '#e2e8f0' }}>{latestReport.paidBy}</strong> | Date: {new Date(latestReport.updatedAt).toLocaleString()}
          </div>
        </div>

        {/* Totals & Export Actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56,189,248,0.2)', padding: '6px 12px', borderRadius: 8, fontSize: 12 }}>
            <span style={{ color: '#94a3b8' }}>Total Expenses: </span>
            <strong style={{ color: '#38bdf8' }}>Rs. {latestReport.totalExpenseAmount.toLocaleString()}</strong>
          </div>
          <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52,211,153,0.2)', padding: '6px 12px', borderRadius: 8, fontSize: 12 }}>
            <span style={{ color: '#94a3b8' }}>Progress: </span>
            <strong style={{ color: '#34d399' }}>{Math.round(latestReport.overallProgressPercent)}%</strong>
          </div>
          <button
            type="button"
            className="nexus-btn nexus-btn-ghost"
            style={{ padding: '6px 10px', fontSize: 11 }}
            onClick={handleDownloadExpensePdf}
            disabled={downloading}
          >
            <Download size={12} /> Expense PDF
          </button>
          <button
            type="button"
            className="nexus-btn nexus-btn-ghost"
            style={{ padding: '6px 10px', fontSize: 11 }}
            onClick={handleDownloadProgressPdf}
            disabled={downloading}
          >
            <Download size={12} /> Progress PDF
          </button>
        </div>
      </div>

      {message && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 6, fontSize: 12, background: message.includes('success') || message.includes('approved') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: message.includes('success') || message.includes('approved') ? '#4ade80' : '#f87171' }}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
        <button
          type="button"
          onClick={() => setActiveTab('expense')}
          style={{ background: activeTab === 'expense' ? 'rgba(56, 189, 248, 0.2)' : 'transparent', color: activeTab === 'expense' ? '#38bdf8' : '#94a3b8', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Expense Breakdown (11 Categories)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('progress')}
          style={{ background: activeTab === 'progress' ? 'rgba(52, 211, 153, 0.2)' : 'transparent', color: activeTab === 'progress' ? '#34d399' : '#94a3b8', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Daily Progress Report (9 Categories)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bills')}
          style={{ background: activeTab === 'bills' ? 'rgba(167, 139, 250, 0.2)' : 'transparent', color: activeTab === 'bills' ? '#a78bfa' : '#94a3b8', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Bills & Attachments ({attachments.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audits')}
          style={{ background: activeTab === 'audits' ? 'rgba(255, 255, 255, 0.1)' : 'transparent', color: activeTab === 'audits' ? '#f8fafc' : '#94a3b8', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Audit History ({(latestReport.audits || []).length})
        </button>
      </div>

      {/* Tab 1: Expense Breakdown */}
      {activeTab === 'expense' && (
        <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {expenseSections.map((sec) => {
            const activeItems = (sec.items || []).filter((it) => (parseFloat(it.amount) || 0) > 0 || it.qty || it.others);
            let secTotal = 0;
            (sec.items || []).forEach((it) => {
              const a = parseFloat(it.amount);
              if (!isNaN(a) && a > 0) secTotal += a;
            });

            return (
              <div key={sec.id} style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>
                  <span>{sec.id}. {sec.title}</span>
                  <span style={{ color: secTotal > 0 ? '#38bdf8' : '#64748b' }}>Rs. {secTotal.toLocaleString()}</span>
                </div>
                {activeItems.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>No expenses claimed under this section.</div>
                ) : (
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left' }}>
                        <th style={{ width: 30, padding: 4 }}>Sr</th>
                        <th style={{ padding: 4 }}>Item</th>
                        <th style={{ width: 60, padding: 4 }}>Qty</th>
                        <th style={{ width: 90, padding: 4, textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: 4 }}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeItems.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ color: '#64748b', padding: 4 }}>{item.code}</td>
                          <td style={{ color: '#cbd5e1', padding: 4 }}>{item.isCustom ? item.name : item.name}</td>
                          <td style={{ color: '#94a3b8', padding: 4 }}>{item.qty || '—'}</td>
                          <td style={{ color: '#38bdf8', fontWeight: 600, textAlign: 'right', padding: 4 }}>
                            {parseFloat(item.amount) ? `Rs. ${Number(item.amount).toLocaleString()}` : '—'}
                          </td>
                          <td style={{ color: '#94a3b8', padding: 4 }}>{item.others || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Progress Report */}
      {activeTab === 'progress' && (
        <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {progressSections.map((sec) => {
            const activeItems = (sec.items || []).filter((it) => it.workPercent || it.remark || it.others);
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
              <div key={sec.id} style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>
                  <span>{sec.id}. {sec.title}</span>
                  <span style={{ color: secAvg > 0 ? '#34d399' : '#64748b' }}>Avg: {secAvg}%</span>
                </div>
                {activeItems.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>No progress entered under this section.</div>
                ) : (
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'left' }}>
                        <th style={{ width: 30, padding: 4 }}>Sr</th>
                        <th style={{ padding: 4 }}>Type of Work</th>
                        <th style={{ width: 50, padding: 4 }}>Unit</th>
                        <th style={{ width: 60, padding: 4, textAlign: 'center' }}>Work%</th>
                        <th style={{ padding: 4 }}>Remarks</th>
                        <th style={{ padding: 4 }}>Others</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeItems.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ color: '#64748b', padding: 4 }}>{item.code}</td>
                          <td style={{ color: '#cbd5e1', padding: 4 }}>{item.name}</td>
                          <td style={{ color: '#94a3b8', padding: 4 }}>{item.unit || '—'}</td>
                          <td style={{ color: '#34d399', fontWeight: 600, textAlign: 'center', padding: 4 }}>{item.workPercent ? `${item.workPercent}%` : '—'}</td>
                          <td style={{ color: '#94a3b8', padding: 4 }}>{item.remark || '—'}</td>
                          <td style={{ color: '#94a3b8', padding: 4 }}>{item.others || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: Bills & Attachments */}
      {activeTab === 'bills' && (
        <div>
          {attachments.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>No attachments uploaded with this report.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {attachments.map((att, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {att.url && att.url.startsWith('data:image') ? (
                    <a href={att.url} target="_blank" rel="noreferrer">
                      <img src={att.url} alt={att.name} style={{ width: '100%', height: 110, objectFit: 'cover' }} />
                    </a>
                  ) : (
                    <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={32} color="#38bdf8" />
                    </div>
                  )}
                  <div style={{ padding: 6, fontSize: 11, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {att.name || `Attachment #${i + 1}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Audits */}
      {activeTab === 'audits' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(latestReport.audits || []).map((audit) => (
            <div key={audit.id} style={{ padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <div>
                <strong style={{ color: getStatusColor(audit.action) }}>{audit.action}</strong>
                <span style={{ color: '#64748b', marginLeft: 6 }}>v{audit.version}</span>
                <div style={{ color: '#94a3b8', marginTop: 2 }}>{audit.comment || '—'}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
                <div>By: {audit.changedByName || 'User'}</div>
                <div>{new Date(audit.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reviewer Action Buttons */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        {showCorrectionBox ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="field-label" style={{ color: '#f87171' }}>
              Correction Notes for Field Employee:
            </label>
            <textarea
              className="nexus-input"
              rows={2}
              placeholder="Specify missing bills, incorrect quantities, or what requires changes..."
              value={reviewerComment}
              onChange={(e) => setReviewerComment(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={() => setShowCorrectionBox(false)}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="nexus-btn"
                style={{ padding: '6px 16px', fontSize: 12, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid #f87171' }}
                onClick={() => handleUpdateStatus('CORRECTION_REQUIRED')}
                disabled={processing}
              >
                Send Correction Request
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Current Status: <strong style={{ color: getStatusColor(latestReport.status) }}>{latestReport.status}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {latestReport.status !== 'CORRECTION_REQUIRED' && (
                <button
                  type="button"
                  className="nexus-btn nexus-btn-ghost"
                  style={{ padding: '7px 14px', fontSize: 12, color: '#f87171' }}
                  onClick={() => setShowCorrectionBox(true)}
                  disabled={processing}
                >
                  <AlertTriangle size={13} /> Request Correction
                </button>
              )}
              {latestReport.status !== 'APPROVED' && (
                <button
                  type="button"
                  className="nexus-btn nexus-btn-primary"
                  style={{ padding: '7px 18px', fontSize: 12, background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
                  onClick={() => handleUpdateStatus('APPROVED')}
                  disabled={processing}
                >
                  <CheckCircle2 size={14} /> Approve Submission
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
