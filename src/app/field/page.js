"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  HardHat, Briefcase, Mail, Phone, Calendar, Clock,
  CheckCircle2, AlertTriangle, FileText, DollarSign, Upload,
  Camera, Download, RefreshCw, LogOut, ChevronRight, ArrowLeft,
  Save, Send, ShieldAlert, History, Paperclip, Eye, X, AlertCircle
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { apiFetch } from '@/lib/api';
import { PROJECT_EXPENSE_TEMPLATE, PROJECT_PROGRESS_TEMPLATE } from '@/lib/projectReportTemplates';
import { downloadExpenseReportPdf, downloadProgressReportPdf } from '@/lib/projectPdfGenerator';

export default function FieldPortalPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState('jobs'); // 'jobs' | 'history'
  const [selectedJob, setSelectedJob] = useState(null);
  const [reportTab, setReportTab] = useState('progress'); // 'progress' | 'expense' | 'attachments' | 'audit'

  // Form State
  const [progressSections, setProgressSections] = useState([]);
  const [expenseSections, setExpenseSections] = useState([]);
  const [paidBy, setPaidBy] = useState('FES');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [attachments, setAttachments] = useState([]);
  const [existingReport, setExistingReport] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const fileInputRef = useRef(null);

  // Initialize form templates
  const initTemplates = (report = null) => {
    if (report && report.progressData) {
      try {
        const parsed = JSON.parse(report.progressData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProgressSections(parsed);
        } else {
          setProgressSections(JSON.parse(JSON.stringify(PROJECT_PROGRESS_TEMPLATE)));
        }
      } catch {
        setProgressSections(JSON.parse(JSON.stringify(PROJECT_PROGRESS_TEMPLATE)));
      }
    } else {
      setProgressSections(JSON.parse(JSON.stringify(PROJECT_PROGRESS_TEMPLATE)));
    }

    if (report && report.expenseData) {
      try {
        const parsed = JSON.parse(report.expenseData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExpenseSections(parsed);
        } else {
          setExpenseSections(JSON.parse(JSON.stringify(PROJECT_EXPENSE_TEMPLATE)));
        }
      } catch {
        setExpenseSections(JSON.parse(JSON.stringify(PROJECT_EXPENSE_TEMPLATE)));
      }
    } else {
      setExpenseSections(JSON.parse(JSON.stringify(PROJECT_EXPENSE_TEMPLATE)));
    }

    if (report && report.attachments) {
      try {
        const parsed = JSON.parse(report.attachments);
        setAttachments(Array.isArray(parsed) ? parsed : []);
      } catch {
        setAttachments([]);
      }
    } else {
      setAttachments([]);
    }

    if (report && report.paidBy) {
      setPaidBy(report.paidBy);
    } else {
      setPaidBy('FES');
    }

    if (report && report.reportDate) {
      try {
        setReportDate(new Date(report.reportDate).toISOString().split('T')[0]);
      } catch {}
    } else {
      setReportDate(new Date().toISOString().split('T')[0]);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setActionMessage({ type: '', text: '' });
    try {
      const [jobsRes, reportsRes] = await Promise.all([
        apiFetch('/api/jobs'),
        apiFetch('/api/project-reports?myReports=true'),
      ]);
      const fetchedJobs = jobsRes.jobs || [];
      const fetchedReports = reportsRes.reports || [];
      setJobs(fetchedJobs);
      setMySubmissions(fetchedReports);

      // If active job is open, refresh its report
      if (selectedJob) {
        const matched = fetchedReports.find((r) => r.jobMetadataId === selectedJob.id);
        setExistingReport(matched || null);
      }
    } catch (err) {
      console.error('Failed to load field portal data:', err);
      setActionMessage({ type: 'error', text: 'Failed to sync latest jobs: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openJob = (job) => {
    setSelectedJob(job);
    setActionMessage({ type: '', text: '' });
    const matched = (mySubmissions || []).find((r) => r.jobMetadataId === job.id);
    setExistingReport(matched || null);
    initTemplates(matched || null);
    setReportTab('progress');
  };

  const closeJob = () => {
    setSelectedJob(null);
    setExistingReport(null);
    setActionMessage({ type: '', text: '' });
  };

  // ── Calculation Helpers ───────────────────────────────────────────────────
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

  // Progress change handler
  const handleProgressChange = (secIndex, itemIndex, field, value) => {
    setProgressSections((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      clone[secIndex].items[itemIndex][field] = value;
      return clone;
    });
  };

  // Expense change handler
  const handleExpenseChange = (secIndex, itemIndex, field, value) => {
    setExpenseSections((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      clone[secIndex].items[itemIndex][field] = value;
      return clone;
    });
  };

  // Add custom row to an expense section
  const addExpenseCustomRow = (secIndex) => {
    setExpenseSections((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      const items = clone[secIndex].items;
      const nextLetter = String.fromCharCode(97 + items.length);
      items.push({
        code: nextLetter,
        name: '',
        qty: '',
        amount: '',
        others: '',
        isCustom: true,
      });
      return clone;
    });
  };

  // Add custom row to a progress section
  const addProgressCustomRow = (secIndex) => {
    setProgressSections((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      const items = clone[secIndex].items;
      const nextLetter = String.fromCharCode(97 + items.length);
      items.push({
        code: nextLetter,
        name: '',
        unit: 'Jop',
        workPercent: '',
        remark: '',
        others: '',
        isCustom: true,
      });
      return clone;
    });
  };

  // Image / Bill upload handler (converts to persistent base64 data)
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target.result;
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            type: file.type,
            url: base64Data,
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

  // ── Save Draft or Submit Reports ──────────────────────────────────────────
  const handleSaveOrSubmit = async (statusToSet = 'SUBMITTED') => {
    if (!selectedJob) return;

    const isSubmitting = statusToSet === 'SUBMITTED';
    if (isSubmitting) {
      setSubmitting(true);
    } else {
      setSavingDraft(true);
    }
    setActionMessage({ type: '', text: '' });

    const totalExpense = calculateTotalExpenses();
    const overallProgress = calculateOverallProgress();

    try {
      const payload = {
        jobMetadataId: selectedJob.id,
        branchName: selectedJob.branchName,
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

      setExistingReport(res.report);
      setActionMessage({
        type: 'success',
        text: isSubmitting
          ? '🎉 Project reports & expenses successfully submitted to office management!'
          : '💾 Draft successfully saved on server.',
      });

      // Refresh background submissions
      const reportsRes = await apiFetch('/api/project-reports?myReports=true');
      setMySubmissions(reportsRes.reports || []);
    } catch (err) {
      console.error('Submission failed:', err);
      setActionMessage({
        type: 'error',
        text: 'Failed to submit: ' + (err.message || 'Network error'),
      });
    } finally {
      setSubmitting(false);
      setSavingDraft(false);
    }
  };

  // ── PDF Exports ───────────────────────────────────────────────────────────
  const handleDownloadExpensePdf = async () => {
    if (!selectedJob) return;
    setDownloadingPdf(true);
    try {
      await downloadExpenseReportPdf({
        job: selectedJob,
        reportDate,
        sections: expenseSections,
        totalExpenseAmount: calculateTotalExpenses(),
        paidBy,
        employeeName: user?.employeeName,
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: 'PDF export failed: ' + err.message });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadProgressPdf = async () => {
    if (!selectedJob) return;
    setDownloadingPdf(true);
    try {
      await downloadProgressReportPdf({
        job: selectedJob,
        reportDate,
        sections: progressSections,
        overallProgressPercent: calculateOverallProgress(),
        employeeName: user?.employeeName,
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: 'PDF export failed: ' + err.message });
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Filtering assigned jobs
  const filteredJobs = jobs.filter((j) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      j.clientName?.toLowerCase().includes(q) ||
      j.branchName?.toLowerCase().includes(q) ||
      j.workNature?.toLowerCase().includes(q) ||
      j.ticket?.serialNo?.toLowerCase().includes(q) ||
      j.ticket?.subject?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (jobId) => {
    const report = mySubmissions.find((r) => r.jobMetadataId === jobId);
    if (!report) {
      return <span style={{ background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>NOT STARTED</span>;
    }
    if (report.status === 'APPROVED') {
      return <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>✅ APPROVED</span>;
    }
    if (report.status === 'CORRECTION_REQUIRED') {
      return <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>⚠️ CORRECTION REQUIRED</span>;
    }
    if (report.status === 'SUBMITTED') {
      return <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>📩 SUBMITTED</span>;
    }
    return <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>📝 DRAFT SAVED</span>;
  };

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '16px', minHeight: '100vh' }}>
      {/* ── Top Field Header ─────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 18px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <HardHat size={22} color="#34d399" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#f8fafc', letterSpacing: 0.5 }}>
              NEXUS FIELD PORTAL
            </div>
            <div style={{ fontSize: 12, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }}></span>
              {user?.employeeName || 'Field Engineer'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="nexus-btn nexus-btn-ghost"
            style={{ padding: '8px 12px', fontSize: 12 }}
            onClick={loadData}
            title="Refresh assigned jobs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span style={{ marginLeft: 4 }}>Sync</span>
          </button>
          <button
            type="button"
            className="nexus-btn nexus-btn-ghost"
            style={{ padding: '8px 12px', fontSize: 12, color: '#f87171' }}
            onClick={logout}
          >
            <LogOut size={14} />
            <span style={{ marginLeft: 4 }}>Logout</span>
          </button>
        </div>
      </header>

      {/* ── Action Notification Banner ───────────────────────────────────── */}
      {actionMessage.text && (
        <div
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 13,
            background: actionMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            color: actionMessage.type === 'error' ? '#f87171' : '#4ade80',
            border: `1px solid ${actionMessage.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{actionMessage.text}</span>
          <button
            type="button"
            onClick={() => setActionMessage({ type: '', text: '' })}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── VIEW 1: ACTIVE JOB REPORT WORKSPACE ─────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {selectedJob ? (
        <div>
          {/* Header Bar with Back Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <button
              type="button"
              className="nexus-btn nexus-btn-ghost"
              onClick={closeJob}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
            >
              <ArrowLeft size={16} /> Back to Assigned Jobs
            </button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {getStatusBadge(selectedJob.id)}
              {existingReport && (
                <span style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 4 }}>
                  Version {existingReport.version}
                </span>
              )}
            </div>
          </div>

          {/* Job & Email Details Card */}
          <div className="glass-card" style={{ marginBottom: 20, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', color: '#00f2fe', fontSize: 13, fontWeight: 'bold' }}>
                    Serial #{selectedJob.ticket?.serialNo || selectedJob.id}
                  </span>
                  <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                    {selectedJob.workNature}
                  </span>
                </div>
                <h2 style={{ fontSize: 18, color: '#f8fafc', margin: '4px 0 8px 0' }}>
                  {selectedJob.branchName}
                </h2>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>
                  Client: <strong style={{ color: '#e2e8f0' }}>{selectedJob.clientName}</strong> | POC: <strong style={{ color: '#e2e8f0' }}>{selectedJob.personOfContact}</strong>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                <div>Date: {selectedJob.ticket?.exactDate ? new Date(selectedJob.ticket.exactDate).toLocaleDateString() : '—'}</div>
                <div>Time: {selectedJob.ticket?.time || '—'}</div>
              </div>
            </div>

            {/* Email Subject Section */}
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mail size={12} /> Originating Email Subject & Instructions
              </div>
              <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>
                {selectedJob.ticket?.subject || 'No description provided'}
              </div>
              {selectedJob.ticket?.sender && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  From: {selectedJob.ticket.sender}
                </div>
              )}
            </div>

            {/* Reviewer Comments Warning (if correction requested) */}
            {existingReport?.status === 'CORRECTION_REQUIRED' && existingReport.reviewerNotes && (
              <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f87171', fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>
                  <AlertCircle size={16} /> Office Reviewer Feedback & Correction Required:
                </div>
                <div style={{ fontSize: 13, color: '#fca5a5' }}>
                  {existingReport.reviewerNotes}
                </div>
              </div>
            )}
          </div>

          {/* Report Tab Navigation */}
          <div className="tab-segment" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className={`tab-segment-btn ${reportTab === 'progress' ? 'active-field' : ''}`}
              onClick={() => setReportTab('progress')}
            >
              1. Daily Progress Report
            </button>
            <button
              type="button"
              className={`tab-segment-btn ${reportTab === 'expense' ? 'active-field' : ''}`}
              onClick={() => setReportTab('expense')}
            >
              2. Project Expense Report
            </button>
            <button
              type="button"
              className={`tab-segment-btn ${reportTab === 'attachments' ? 'active-field' : ''}`}
              onClick={() => setReportTab('attachments')}
            >
              3. Bills & Receipts ({attachments.length})
            </button>
            {existingReport?.audits?.length > 0 && (
              <button
                type="button"
                className={`tab-segment-btn ${reportTab === 'audit' ? 'active-field' : ''}`}
                onClick={() => setReportTab('audit')}
              >
                4. Audit Trail
              </button>
            )}
          </div>

          {/* ── TAB 1: DAILY PROGRESS REPORT ──────────────────────────────── */}
          {reportTab === 'progress' && (
            <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc' }}>
                    progress report {selectedJob.branchName}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>
                    Recreation of official 9-category progress inspection sheet
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '6px 14px', borderRadius: 8, fontWeight: 'bold', fontSize: 14 }}>
                    Overall Progress: {calculateOverallProgress()}%
                  </div>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={handleDownloadProgressPdf}
                    disabled={downloadingPdf}
                  >
                    <Download size={13} /> {downloadingPdf ? 'Exporting...' : 'PDF'}
                  </button>
                </div>
              </div>

              {/* Progress Sections Accordion/Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {progressSections.map((sec, secIdx) => {
                  let secTotal = 0;
                  let secCount = 0;
                  (sec.items || []).forEach((it) => {
                    const p = parseFloat(it.workPercent);
                    if (!isNaN(p)) {
                      secTotal += p;
                      secCount++;
                    }
                  });
                  const secAvg = secCount > 0 ? Math.round(secTotal / secCount) : 0;

                  return (
                    <div key={sec.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#38bdf8' }}>
                          {sec.id}. {sec.title} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>({sec.subtitle})</span>
                        </div>
                        <div style={{ fontSize: 12, color: secAvg > 0 ? '#34d399' : '#64748b', fontWeight: 600 }}>
                          Section Progress: {secAvg}%
                        </div>
                      </div>

                      {/* Items Table */}
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                              <th style={{ width: 35, padding: '6px 4px' }}>Sr</th>
                              <th style={{ padding: '6px 8px', minWidth: 160 }}>Type of work</th>
                              <th style={{ width: 70, padding: '6px 6px' }}>Unit</th>
                              <th style={{ width: 85, padding: '6px 6px' }}>Work%</th>
                              <th style={{ minWidth: 120, padding: '6px 8px' }}>Remak</th>
                              <th style={{ minWidth: 120, padding: '6px 8px' }}>Others</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sec.items.map((item, itIdx) => (
                              <tr key={itIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ color: '#64748b', padding: '6px 4px', fontFamily: 'monospace' }}>
                                  {item.code}
                                </td>
                                <td style={{ padding: '6px 8px', color: '#e2e8f0' }}>
                                  {item.isCustom ? (
                                    <input
                                      className="nexus-input"
                                      style={{ padding: '4px 8px', fontSize: 12, height: 28 }}
                                      placeholder="Add description..."
                                      value={item.name}
                                      onChange={(e) => handleProgressChange(secIdx, itIdx, 'name', e.target.value)}
                                    />
                                  ) : (
                                    item.name
                                  )}
                                </td>
                                <td style={{ padding: '6px 6px' }}>
                                  <input
                                    className="nexus-input"
                                    style={{ padding: '4px 6px', fontSize: 12, height: 28, width: '100%' }}
                                    placeholder="unit"
                                    value={item.unit}
                                    onChange={(e) => handleProgressChange(secIdx, itIdx, 'unit', e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: '6px 6px' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="nexus-input"
                                    style={{ padding: '4px 6px', fontSize: 12, height: 28, width: '100%', color: item.workPercent ? '#34d399' : 'inherit', fontWeight: 600 }}
                                    placeholder="0%"
                                    value={item.workPercent}
                                    onChange={(e) => handleProgressChange(secIdx, itIdx, 'workPercent', e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px' }}>
                                  <input
                                    className="nexus-input"
                                    style={{ padding: '4px 8px', fontSize: 12, height: 28, width: '100%' }}
                                    placeholder="Remark..."
                                    value={item.remark}
                                    onChange={(e) => handleProgressChange(secIdx, itIdx, 'remark', e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px' }}>
                                  <input
                                    className="nexus-input"
                                    style={{ padding: '4px 8px', fontSize: 12, height: 28, width: '100%' }}
                                    placeholder="Other notes..."
                                    value={item.others}
                                    onChange={(e) => handleProgressChange(secIdx, itIdx, 'others', e.target.value)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        type="button"
                        onClick={() => addProgressCustomRow(secIdx)}
                        style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 12, marginTop: 8, cursor: 'pointer', padding: '4px 0' }}
                      >
                        + Add Custom Row in {sec.title}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB 2: PROJECT EXPENSE REPORT ─────────────────────────────── */}
          {reportTab === 'expense' && (
            <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc' }}>
                    UBL Bank branch ({selectedJob.branchName}) Expense Sheet
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>
                    Exact 11-category construction & site cost reporting template
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '6px 14px', borderRadius: 8, fontWeight: 'bold', fontSize: 14 }}>
                    Grand Total: Rs. {calculateTotalExpenses().toLocaleString()}
                  </div>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={handleDownloadExpensePdf}
                    disabled={downloadingPdf}
                  >
                    <Download size={13} /> {downloadingPdf ? 'Exporting...' : 'PDF'}
                  </button>
                </div>
              </div>

              {/* Paid By Selection & Report Date */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 18, background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label className="field-label">Expense Incurred / Paid By</label>
                  <select
                    className="nexus-select"
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                  >
                    <option value="FES">FES Direct / Office Advance</option>
                    <option value="EMPLOYEE">Field Employee Out-of-Pocket Claim</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label className="field-label">Report Date</label>
                  <input
                    type="date"
                    className="nexus-input"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                  />
                </div>
              </div>

              {/* 11 Expense Categories */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {expenseSections.map((sec, secIdx) => {
                  let secTotal = 0;
                  (sec.items || []).forEach((it) => {
                    const a = parseFloat(it.amount);
                    if (!isNaN(a) && a > 0) secTotal += a;
                  });

                  return (
                    <div key={sec.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#38bdf8' }}>
                          {sec.id}. {sec.title} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>({sec.subtitle})</span>
                        </div>
                        <div style={{ fontSize: 12, color: secTotal > 0 ? '#38bdf8' : '#64748b', fontWeight: 600 }}>
                          Subtotal: Rs. {secTotal.toLocaleString()}
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                              <th style={{ width: 35, padding: '6px 4px' }}>Sr</th>
                              <th style={{ padding: '6px 8px', minWidth: 160 }}>Type of work</th>
                              <th style={{ width: 80, padding: '6px 6px' }}>Qty</th>
                              <th style={{ width: 110, padding: '6px 6px' }}>Amount (Rs)</th>
                              <th style={{ minWidth: 140, padding: '6px 8px' }}>Others / Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sec.items.map((item, itIdx) => (
                              <tr key={itIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ color: '#64748b', padding: '6px 4px', fontFamily: 'monospace' }}>
                                  {item.code}
                                </td>
                                <td style={{ padding: '6px 8px', color: '#e2e8f0' }}>
                                  {item.isCustom ? (
                                    <input
                                      className="nexus-input"
                                      style={{ padding: '4px 8px', fontSize: 12, height: 28 }}
                                      placeholder="Add item name..."
                                      value={item.name}
                                      onChange={(e) => handleExpenseChange(secIdx, itIdx, 'name', e.target.value)}
                                    />
                                  ) : (
                                    item.name
                                  )}
                                </td>
                                <td style={{ padding: '6px 6px' }}>
                                  <input
                                    className="nexus-input"
                                    style={{ padding: '4px 6px', fontSize: 12, height: 28, width: '100%' }}
                                    placeholder="Qty"
                                    value={item.qty}
                                    onChange={(e) => handleExpenseChange(secIdx, itIdx, 'qty', e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: '6px 6px' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    className="nexus-input"
                                    style={{ padding: '4px 6px', fontSize: 12, height: 28, width: '100%', color: item.amount ? '#38bdf8' : 'inherit', fontWeight: 600 }}
                                    placeholder="Rs."
                                    value={item.amount}
                                    onChange={(e) => handleExpenseChange(secIdx, itIdx, 'amount', e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px' }}>
                                  <input
                                    className="nexus-input"
                                    style={{ padding: '4px 8px', fontSize: 12, height: 28, width: '100%' }}
                                    placeholder="Remarks / details..."
                                    value={item.others}
                                    onChange={(e) => handleExpenseChange(secIdx, itIdx, 'others', e.target.value)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        type="button"
                        onClick={() => addExpenseCustomRow(secIdx)}
                        style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 12, marginTop: 8, cursor: 'pointer', padding: '4px 0' }}
                      >
                        + Add Custom Row in {sec.title}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB 3: BILLS & RECEIPTS ATTACHMENTS ──────────────────────── */}
          {reportTab === 'attachments' && (
            <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc' }}>
                    Supporting Bills, Invoices & Site Photos
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>
                    Attach proof for labor, material purchases, and vendor receipts
                  </p>
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-primary"
                    style={{ padding: '8px 14px', fontSize: 12 }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={14} /> Upload Bills / Photos
                  </button>
                </div>
              </div>

              {attachments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b', background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <Camera size={36} color="#64748b" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  <div>No receipts attached yet.</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Tap "Upload Bills / Photos" to attach camera shots or files.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {attachments.map((att, idx) => (
                    <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                      {att.url && att.url.startsWith('data:image') ? (
                        <img src={att.url} alt={att.name} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)' }}>
                          <FileText size={36} color="#38bdf8" />
                        </div>
                      )}
                      <div style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, maxWidth: 140 }}>
                          {att.name || `Attachment #${idx + 1}`}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: AUDIT TRAIL ────────────────────────────────────────── */}
          {reportTab === 'audit' && existingReport && (
            <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: 16, color: '#f8fafc' }}>
                Submission & Review Audit Trail
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(existingReport.audits || []).map((audit) => (
                  <div key={audit.id} style={{ padding: 12, background: 'rgba(0,0,0,0.25)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: audit.action === 'APPROVED' ? '#4ade80' : audit.action.includes('CORRECTION') ? '#f87171' : '#38bdf8' }}>
                          {audit.action}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>v{audit.version}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                        {audit.comment || 'Status updated'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
                      <div>By: {audit.changedByName || 'System'}</div>
                      <div>{new Date(audit.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STICKY BOTTOM ACTION BAR ──────────────────────────────────── */}
          <div
            style={{
              position: 'sticky',
              bottom: 12,
              zIndex: 30,
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(16px)',
              padding: '12px 18px',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Overall Summary:</div>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: '#f8fafc' }}>
                Progress: <span style={{ color: '#34d399' }}>{calculateOverallProgress()}%</span> | Total Expense: <span style={{ color: '#38bdf8' }}>Rs. {calculateTotalExpenses().toLocaleString()}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={() => handleSaveOrSubmit('IN_PROGRESS')}
                disabled={savingDraft || submitting}
                style={{ padding: '10px 16px', fontSize: 13 }}
              >
                <Save size={15} /> {savingDraft ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                type="button"
                className="nexus-btn nexus-btn-primary"
                onClick={() => handleSaveOrSubmit('SUBMITTED')}
                disabled={submitting || savingDraft}
                style={{
                  padding: '10px 20px',
                  fontSize: 13,
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  fontWeight: 600,
                }}
              >
                <Send size={15} /> {submitting ? 'Submitting...' : existingReport?.status === 'CORRECTION_REQUIRED' ? 'Resubmit Corrected Report' : 'Submit Reports'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════════════ */
        /* ── VIEW 2: ASSIGNED JOBS LIST & HISTORY ────────────────────────── */
        /* ════════════════════════════════════════════════════════════════════ */
        <div>
          {/* View Tab Switcher */}
          <div className="tab-segment" style={{ marginBottom: 20 }}>
            <button
              type="button"
              className={`tab-segment-btn ${activeTab === 'jobs' ? 'active-field' : ''}`}
              onClick={() => setActiveTab('jobs')}
            >
              <Briefcase size={15} style={{ display: 'inline', marginRight: 4 }} /> My Assigned Jobs ({jobs.length})
            </button>
            <button
              type="button"
              className={`tab-segment-btn ${activeTab === 'history' ? 'active-field' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={15} style={{ display: 'inline', marginRight: 4 }} /> Submitted Reports & Expenses ({mySubmissions.length})
            </button>
          </div>

          {activeTab === 'jobs' ? (
            <div>
              {/* Search Bar */}
              <div style={{ marginBottom: 16 }}>
                <input
                  className="nexus-input"
                  placeholder="Search assigned jobs by branch, client, serial, subject..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px' }}
                />
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
                  Loading your assigned jobs...
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
                  <CheckCircle2 size={40} color="#34d399" style={{ margin: '0 auto 12px auto' }} />
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
                    {searchTerm ? 'No matching jobs found' : 'No Assigned Jobs'}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {searchTerm ? 'Try a different search term.' : 'Office management will assign jobs to your portal.'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {filteredJobs.map((job) => {
                    const submission = mySubmissions.find((r) => r.jobMetadataId === job.id);
                    return (
                      <div
                        key={job.id}
                        className="glass-card"
                        style={{
                          padding: 18,
                          transition: 'transform 0.15s, border-color 0.15s',
                          cursor: 'pointer',
                          borderColor: submission?.status === 'CORRECTION_REQUIRED' ? 'rgba(239, 68, 68, 0.4)' : undefined,
                        }}
                        onClick={() => openJob(job)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 600, fontSize: 13 }}>
                                Serial #{job.ticket?.serialNo || job.id}
                              </span>
                              <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                {job.workNature}
                              </span>
                            </div>
                            <h3 style={{ margin: '2px 0 4px 0', fontSize: 16, color: '#f8fafc' }}>
                              {job.branchName}
                            </h3>
                            <div style={{ fontSize: 13, color: '#94a3b8' }}>
                              Client: <strong style={{ color: '#e2e8f0' }}>{job.clientName}</strong>
                            </div>
                          </div>
                          <div>
                            {getStatusBadge(job.id)}
                          </div>
                        </div>

                        {/* Originating Email Subject */}
                        <div style={{ margin: '10px 0', padding: '8px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: 6, fontSize: 12, color: '#cbd5e1' }}>
                          <span style={{ color: '#64748b', marginRight: 6 }}>Email Subject:</span>
                          {job.ticket?.subject || '—'}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 12, color: '#64748b' }}>
                          <div style={{ display: 'flex', gap: 14 }}>
                            <span>POC: {job.personOfContact || '—'}</span>
                            <span>Date: {job.ticket?.exactDate ? new Date(job.ticket.exactDate).toLocaleDateString() : '—'}</span>
                          </div>
                          <div style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            Open Job & Fill Reports <ChevronRight size={14} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ── SUBMITTED REPORTS & EXPENSES HISTORY ─────────────────────── */
            <div>
              {mySubmissions.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
                  <FileText size={40} color="#64748b" style={{ margin: '0 auto 12px auto' }} />
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
                    No Reports Submitted Yet
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    Complete and submit Project reports from your assigned jobs list.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {mySubmissions.map((report) => (
                    <div key={report.id} className="glass-card" style={{ padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 'bold', color: '#f8fafc' }}>
                              {report.branchName}
                            </span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>
                              v{report.version}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            Client: {report.jobMetadata?.clientName || '—'} | Serial: #{report.jobMetadata?.ticket?.serialNo || report.jobMetadataId}
                          </div>
                        </div>
                        <div>
                          {report.status === 'APPROVED' ? (
                            <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>
                              APPROVED
                            </span>
                          ) : report.status === 'CORRECTION_REQUIRED' ? (
                            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>
                              CORRECTION REQUIRED
                            </span>
                          ) : (
                            <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>
                              SUBMITTED
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 13, flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <span style={{ color: '#94a3b8' }}>Progress: </span>
                          <strong style={{ color: '#34d399' }}>{Math.round(report.overallProgressPercent)}%</strong>
                          <span style={{ color: '#64748b', margin: '0 8px' }}>|</span>
                          <span style={{ color: '#94a3b8' }}>Expenses: </span>
                          <strong style={{ color: '#38bdf8' }}>Rs. {report.totalExpenseAmount.toLocaleString()}</strong>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          Submitted: {new Date(report.updatedAt).toLocaleString()}
                        </div>
                      </div>

                      {report.reviewerNotes && (
                        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6, fontSize: 12, color: '#fca5a5' }}>
                          <strong>Reviewer Note:</strong> {report.reviewerNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
