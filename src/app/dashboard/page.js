"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import {
  Mail, RefreshCw, Activity, CheckCircle, DollarSign,
  User, AlertCircle, FileText, Camera, Upload, ChevronRight, Save, ClipboardList, Check
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

export default function EmployeeRealTimeDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('tasks');
  const [loading, setLoading] = useState(true);
  const [myStatus, setMyStatus] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ assigned: 0, completed: 0, surveys: 0, expenses: 0, payments: 0 });
  const [message, setMessage] = useState('');
  
  // Inline actions states
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [actionType, setActionType] = useState(null); // 'survey' | 'expense' | null
  
  // Survey form state
  const [surveyText, setSurveyText] = useState('');
  const [savingSurvey, setSavingSurvey] = useState(false);
  
  // Expense form state
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseImg, setExpenseImg] = useState('');
  const [capturedImg, setCapturedImg] = useState(null);
  const [savingExpense, setSavingExpense] = useState(false);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentTaxDeducted, setPaymentTaxDeducted] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentImg, setPaymentImg] = useState('');
  const [capturedPaymentImg, setCapturedPaymentImg] = useState(null);
  const [savingPayment, setSavingPayment] = useState(false);
  
  const webcamRef = useRef(null);
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dloxdnqfm';

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Load my assigned jobs
      const { jobs: fetchedJobs } = await apiFetch('/api/jobs');
      setJobs(fetchedJobs || []);

      // 2. Load users to get real-time active status
      const userRes = await apiFetch('/api/users');
      const me = (userRes.users || []).find((u) => u.id === user?.id);
      if (me) {
        setMyStatus(me.activeStatus);
      }

      // 3. Load ALL incoming Gmail tickets (full ingestion stream)
      const { tickets: allTickets } = await apiFetch('/api/tickets');
      setTickets(allTickets || []);

      // 4. Calculate metrics
      const assigned = (fetchedJobs || []).length;
      // Inferred completion: if a job has at least one approved quotation/invoice
      const completed = (fetchedJobs || []).filter(j => 
        (j.quotationInvoices || []).some(qi => qi.status === 'APPROVED')
      ).length;
      const surveys = (fetchedJobs || []).filter(j => j.surveyReport).length;
      const expenses = (fetchedJobs || []).reduce((sum, j) => sum + (j.expenses || []).reduce((s, e) => s + e.amount, 0), 0);
      const payments = (fetchedJobs || []).reduce((sum, j) => sum + (j.payments || []).reduce((s, p) => s + p.amount, 0), 0);

      setStats({ assigned, completed, surveys, expenses, payments });
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const toggleActiveStatus = async () => {
    setMessage('');
    try {
      const nextStatus = !myStatus;
      await apiFetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activeStatus: nextStatus }),
      });
      setMyStatus(nextStatus);
      setMessage(`Activity status toggled to: ${nextStatus ? 'Active / On Site' : 'Idle / Off Duty'}`);
    } catch (err) {
      setMessage('Failed to toggle status: ' + err.message);
    }
  };

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'unsigned-preset');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
    return data.secure_url;
  };

  const capturePhoto = useCallback(() => {
    const shot = webcamRef.current?.getScreenshot();
    if (shot) {
      if (actionType === 'expense') {
        setCapturedImg(shot);
      } else if (actionType === 'payment') {
        setCapturedPaymentImg(shot);
      }
    }
  }, [actionType]);

  const handlePaymentFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setMessage('Uploading photo...');
      const url = await uploadToCloudinary(file);
      setPaymentImg(url);
      setCapturedPaymentImg(url);
      setMessage('Payment receipt photo uploaded successfully.');
    } catch (err) {
      setMessage('Upload error: ' + err.message);
    }
  };

  const submitPayment = async (jobId) => {
    if (!paymentAmount || !paymentNotes.trim()) {
      setMessage('Payment amount and notes are required.');
      return;
    }
    setSavingPayment(true);
    setMessage('');
    try {
      let finalUrl = paymentImg;
      if (capturedPaymentImg && capturedPaymentImg.startsWith('data:')) {
        const blob = await fetch(capturedPaymentImg).then((r) => r.blob());
        finalUrl = await uploadToCloudinary(blob);
      }

      await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          jobMetadataId: jobId,
          amount: parseFloat(paymentAmount),
          taxDeducted: paymentTaxDeducted ? parseFloat(paymentTaxDeducted) : 0,
          imageUrl: finalUrl || null,
          summaryNotes: paymentNotes,
        }),
      });

      setMessage('Payment logged successfully!');
      setPaymentAmount('');
      setPaymentTaxDeducted('');
      setPaymentNotes('');
      setPaymentImg('');
      setCapturedPaymentImg(null);
      setActionType(null);
      await loadDashboardData();
    } catch (err) {
      setMessage('Failed to log payment: ' + err.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleExpenseFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setMessage('Uploading photo...');
      const url = await uploadToCloudinary(file);
      setExpenseImg(url);
      setCapturedImg(url);
      setMessage('Receipt photo uploaded successfully.');
    } catch (err) {
      setMessage('Upload error: ' + err.message);
    }
  };

  const submitSurvey = async (jobId) => {
    if (!surveyText.trim()) {
      setMessage('Survey report text cannot be empty.');
      return;
    }
    setSavingSurvey(true);
    setMessage('');
    try {
      await apiFetch('/api/survey', {
        method: 'POST',
        body: JSON.stringify({ jobMetadataId: jobId, reportText: surveyText }),
      });
      setMessage('Survey report submitted successfully!');
      setSurveyText('');
      setActionType(null);
      await loadDashboardData();
    } catch (err) {
      setMessage('Failed to submit survey: ' + err.message);
    } finally {
      setSavingSurvey(false);
    }
  };

  const submitExpense = async (jobId) => {
    if (!expenseAmount || !expenseNotes.trim()) {
      setMessage('Expense amount and notes are required.');
      return;
    }
    setSavingExpense(true);
    setMessage('');
    try {
      let finalUrl = expenseImg;
      if (capturedImg && capturedImg.startsWith('data:')) {
        const blob = await fetch(capturedImg).then((r) => r.blob());
        finalUrl = await uploadToCloudinary(blob);
      }

      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          jobMetadataId: jobId,
          amount: parseFloat(expenseAmount),
          imageUrl: finalUrl || null,
          summaryNotes: expenseNotes,
        }),
      });

      setMessage('Expense logged successfully!');
      setExpenseAmount('');
      setExpenseNotes('');
      setExpenseImg('');
      setCapturedImg(null);
      setActionType(null);
      await loadDashboardData();
    } catch (err) {
      setMessage('Failed to log expense: ' + err.message);
    } finally {
      setSavingExpense(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* HEADER SECTION */}
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Operations Workspace</h1>
          <p>Real-time Employee Control Center & Ingestion Stream</p>
        </div>

        {/* Real-time Activity status card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="field-label" style={{ marginBottom: 0 }}>Activity Status</span>
            <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: myStatus ? '#22c55e' : '#64748b', boxShadow: myStatus ? '0 0 8px #22c55e' : 'none' }}></span>
              <span style={{ fontWeight: 600, color: myStatus ? '#22c55e' : '#94a3b8' }}>
                {myStatus ? 'Active / On Site' : 'Idle / Off Duty'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className={`nexus-btn ${myStatus ? 'nexus-btn-ghost' : 'nexus-btn-primary'}`}
            style={{ padding: '8px 12px', fontSize: 12 }}
            onClick={toggleActiveStatus}
          >
            Switch to {myStatus ? 'Idle' : 'Active'}
          </button>
        </div>
      </header>

      {message && (
        <div className={message.includes('failed') || message.includes('Error') ? 'alert-error' : 'alert-success'}>
          {message}
        </div>
      )}

      {/* METRICS ROW */}
      <section className="glass-card" style={{ padding: '24px 32px' }}>
        <div className="admin-metrics-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {[
            { label: 'Assigned Jobs', value: stats.assigned, color: '#00f2fe', icon: ClipboardList },
            { label: 'Completed Jobs', value: stats.completed, color: '#10b981', icon: CheckCircle },
            { label: 'Survey Reports', value: stats.surveys, color: '#a78bfa', icon: FileText },
            { label: 'Logged Expenses', value: `Rs. ${stats.expenses.toLocaleString()}`, color: '#f87171', icon: DollarSign },
            { label: 'Collected Payments', value: `Rs. ${stats.payments.toLocaleString()}`, color: '#34d399', icon: Check },
          ].map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <div key={idx} className="metric-tile" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="field-label" style={{ marginBottom: 0 }}>{item.label}</span>
                  <IconComponent size={18} color={item.color} />
                </div>
                <div className="metric-digit" style={{ color: item.color, fontSize: 24 }}>{item.value}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 1 }}>
        <button
          type="button"
          onClick={() => { setActiveTab('tasks'); setMessage(''); }}
          className={`nav-panel ${activeTab === 'tasks' ? 'active' : ''}`}
          style={{ padding: '12px 24px', borderRadius: '12px 12px 0 0', border: 'none', background: 'transparent' }}
        >
          My Assigned Jobs ({jobs.length})
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('feed'); setMessage(''); }}
          className={`nav-panel ${activeTab === 'feed' ? 'active' : ''}`}
          style={{ padding: '12px 24px', borderRadius: '12px 12px 0 0', border: 'none', background: 'transparent' }}
        >
          Incoming Ingestion Stream ({tickets.length})
        </button>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
          <RefreshCw className="animate-spin" size={32} color="#00f2fe" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8' }}>Updating operational board...</p>
        </div>
      ) : activeTab === 'tasks' ? (
        /* MY ASSIGNED JOBS TAB */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {jobs.length === 0 ? (
            <div className="glass-card" style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
              <AlertCircle size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p>No active jobs currently assigned to you.</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Admins assign incoming tickets from the Job Intake Grid.</p>
            </div>
          ) : (
            jobs.map((job) => {
              const hasSurvey = !!job.surveyReport;
              const quotations = job.quotationInvoices || [];
              const quotation = quotations.find((q) => q.documentType === 'QUOTATION');
              const hasQuotation = !!quotation;
              const quotationApproved = quotation?.status === 'APPROVED';
              
              const totalExpenses = (job.expenses || []).reduce((sum, e) => sum + e.amount, 0);
              const totalPayments = (job.payments || []).reduce((sum, p) => sum + p.amount, 0);

              const isExpanded = expandedJobId === job.id;

              return (
                <div key={job.id} className="glass-card" style={{ padding: 24, border: isExpanded ? '1px solid rgba(0, 242, 254, 0.2)' : '1px solid var(--glass-border)' }}>
                  {/* Job Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 700, fontSize: 13, padding: '4px 8px', background: 'rgba(0,242,254,0.08)', borderRadius: 4 }}>
                          {job.ticket?.serialNo || `JOB-${job.id}`}
                        </span>
                        <span className="status-pill active" style={{ fontSize: 11, background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.2)' }}>
                          {job.workNature}
                        </span>
                      </div>
                      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{job.clientName}</h2>
                      <p style={{ color: '#94a3b8', fontSize: 14 }}>Site Branch: {job.branchName} · POC: {job.personOfContact}</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Assigned on: {new Date(job.createdAt).toLocaleDateString()}
                      </div>
                      <button
                        type="button"
                        className="nexus-btn nexus-btn-ghost"
                        style={{ padding: '8px 12px', fontSize: 12 }}
                        onClick={() => {
                          setExpandedJobId(isExpanded ? null : job.id);
                          setActionType(null);
                        }}
                      >
                        {isExpanded ? 'Collapse Checklist' : 'Update Task Checklist'}
                        <ChevronRight size={14} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>
                    </div>
                  </div>

                  {/* Task Checklist Tracker */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.15)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={12} color="#000" />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>1. Intake Form</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>Complete</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: hasSurvey ? '#22c55e' : 'rgba(255,255,255,0.05)', border: hasSurvey ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {hasSurvey ? <Check size={12} color="#000" /> : <span style={{ fontSize: 10, color: '#64748b' }}>2</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>2. Site Survey</div>
                        <div style={{ fontSize: 10, color: hasSurvey ? '#22c55e' : '#64748b' }}>{hasSurvey ? 'Report Filed' : 'Pending'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: quotationApproved ? '#22c55e' : (hasQuotation ? '#f59e0b' : 'rgba(255,255,255,0.05)'), border: hasQuotation ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {quotationApproved ? <Check size={12} color="#000" /> : <span style={{ fontSize: 10, color: '#64748b' }}>3</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>3. Quotation</div>
                        <div style={{ fontSize: 10, color: quotationApproved ? '#22c55e' : (hasQuotation ? '#f59e0b' : '#64748b') }}>
                          {quotationApproved ? 'Approved' : (hasQuotation ? 'Sent / Pending' : 'Pending')}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: totalExpenses > 0 ? '#22c55e' : 'rgba(255,255,255,0.05)', border: totalExpenses > 0 ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {totalExpenses > 0 ? <Check size={12} color="#000" /> : <span style={{ fontSize: 10, color: '#64748b' }}>4</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>4. Expenses Logged</div>
                        <div style={{ fontSize: 10, color: totalExpenses > 0 ? '#22c55e' : '#64748b' }}>
                          {totalExpenses > 0 ? `Rs. ${totalExpenses.toLocaleString()}` : 'Rs. 0 logged'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: totalPayments > 0 ? '#22c55e' : 'rgba(255,255,255,0.05)', border: totalPayments > 0 ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {totalPayments > 0 ? <Check size={12} color="#000" /> : <span style={{ fontSize: 10, color: '#64748b' }}>5</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>5. Payments Collected</div>
                        <div style={{ fontSize: 10, color: totalPayments > 0 ? '#22c55e' : '#64748b' }}>
                          {totalPayments > 0 ? `Rs. ${totalPayments.toLocaleString()}` : 'Rs. 0 collected'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Task Panels */}
                  {isExpanded && (
                    <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 20 }}>
                      
                      {/* Active Panel Selector Buttons */}
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          type="button"
                          className={`nexus-btn ${actionType === 'survey' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                          style={{ padding: '8px 16px', fontSize: 13 }}
                          onClick={() => {
                            setActionType(actionType === 'survey' ? null : 'survey');
                            if (job.surveyReport) setSurveyText(job.surveyReport.reportText);
                            else setSurveyText('');
                          }}
                        >
                          <FileText size={14} /> {hasSurvey ? 'View Survey Report' : 'File Site Survey'}
                        </button>
                        <button
                          type="button"
                          className={`nexus-btn ${actionType === 'expense' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                          style={{ padding: '8px 16px', fontSize: 13 }}
                          onClick={() => setActionType(actionType === 'expense' ? null : 'expense')}
                        >
                          <Camera size={14} /> Log On-site Expense
                        </button>
                        <button
                          type="button"
                          className={`nexus-btn ${actionType === 'payment' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                          style={{ padding: '8px 16px', fontSize: 13 }}
                          onClick={() => setActionType(actionType === 'payment' ? null : 'payment')}
                        >
                          <DollarSign size={14} /> Log Client Payment
                        </button>
                      </div>

                      {/* Survey Panel */}
                      {actionType === 'survey' && (
                        <div style={{ padding: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Site Survey Report</h3>
                          {hasSurvey ? (
                            <div>
                              <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: 14, color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {job.surveyReport.reportText}
                              </div>
                              <p style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>Filed in database. To edit, modify below and save.</p>
                            </div>
                          ) : (
                            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>Enter details of the on-site checkup and findings to proceed.</p>
                          )}

                          <textarea
                            className="nexus-textarea"
                            value={surveyText}
                            onChange={(e) => setSurveyText(e.target.value)}
                            placeholder="Write comprehensive notes of the survey findings..."
                            style={{ minHeight: 120, marginTop: 12 }}
                          />

                          <button
                            type="button"
                            className="nexus-btn nexus-btn-primary"
                            style={{ marginTop: 12 }}
                            onClick={() => submitSurvey(job.id)}
                            disabled={savingSurvey}
                          >
                            <Save size={14} /> {savingSurvey ? 'Saving Report...' : 'Save Survey Report'}
                          </button>
                        </div>
                      )}

                      {/* Expense Panel */}
                      {actionType === 'expense' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div>
                            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Log Site Expense</h3>
                            <label className="field-label">Amount (Rs.)</label>
                            <input
                              className="nexus-input"
                              type="number"
                              required
                              value={expenseAmount}
                              onChange={(e) => setExpenseAmount(e.target.value)}
                              placeholder="0.00"
                              style={{ marginBottom: 16 }}
                            />

                            <label className="field-label">Expense Notes</label>
                            <textarea
                              className="nexus-textarea"
                              required
                              value={expenseNotes}
                              onChange={(e) => setExpenseNotes(e.target.value)}
                              placeholder="Describe materials purchased, labor costs, etc..."
                              style={{ minHeight: 80, marginBottom: 16 }}
                            />

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1 }} onClick={capturePhoto}>
                                <Camera size={14} /> Capture Receipt
                              </button>
                              <label className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1, cursor: 'pointer', textAlign: 'center' }}>
                                <Upload size={14} /> Upload Image
                                <input type="file" accept="image/*" hidden onChange={handleExpenseFileUpload} />
                              </label>
                            </div>

                            <button
                              type="button"
                              className="nexus-btn nexus-btn-primary"
                              style={{ width: '100%', marginTop: 16 }}
                              onClick={() => submitExpense(job.id)}
                              disabled={savingExpense}
                            >
                              <Save size={14} /> {savingExpense ? 'Logging Expense...' : 'Log Expense'}
                            </button>
                          </div>

                          <div>
                            <label className="field-label">Live Camera Feed / Captured Receipt</label>
                            <div style={{ borderRadius: 8, overflow: 'hidden', background: '#0a0a0c', height: 230, border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {!capturedImg ? (
                                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <img src={capturedImg} alt="Captured receipt" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              )}
                            </div>
                            {capturedImg && (
                              <button
                                type="button"
                                className="nexus-btn nexus-btn-ghost"
                                style={{ marginTop: 8, padding: '4px 8px', fontSize: 11 }}
                                onClick={() => { setCapturedImg(null); setExpenseImg(''); }}
                              >
                                Retake Receipt Photo
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Payment Panel */}
                      {actionType === 'payment' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div>
                            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Log Client Payment</h3>
                            <label className="field-label">Amount Received (Rs.)</label>
                            <input
                              className="nexus-input"
                              type="number"
                              required
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              placeholder="0.00"
                              style={{ marginBottom: 16 }}
                            />

                            <label className="field-label">Tax Deduction (Rs. Optional)</label>
                            <input
                              className="nexus-input"
                              type="number"
                              value={paymentTaxDeducted}
                              onChange={(e) => setPaymentTaxDeducted(e.target.value)}
                              placeholder="0.00"
                              style={{ marginBottom: 16 }}
                            />

                            <label className="field-label">Payment Notes</label>
                            <textarea
                              className="nexus-textarea"
                              required
                              value={paymentNotes}
                              onChange={(e) => setPaymentNotes(e.target.value)}
                              placeholder="Describe payment collection details (e.g. cash, cheque, bank transfer reference)..."
                              style={{ minHeight: 80, marginBottom: 16 }}
                            />

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1 }} onClick={capturePhoto}>
                                <Camera size={14} /> Capture Slip
                              </button>
                              <label className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1, cursor: 'pointer', textAlign: 'center' }}>
                                <Upload size={14} /> Upload Slip
                                <input type="file" accept="image/*" hidden onChange={handlePaymentFileUpload} />
                              </label>
                            </div>

                            <button
                              type="button"
                              className="nexus-btn nexus-btn-primary"
                              style={{ width: '100%', marginTop: 16 }}
                              onClick={() => submitPayment(job.id)}
                              disabled={savingPayment}
                            >
                              <Save size={14} /> {savingPayment ? 'Logging Payment...' : 'Log Payment'}
                            </button>
                          </div>

                          <div>
                            <label className="field-label">Live Camera Feed / Captured Slip</label>
                            <div style={{ borderRadius: 8, overflow: 'hidden', background: '#0a0a0c', height: 230, border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {!capturedPaymentImg ? (
                                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <img src={capturedPaymentImg} alt="Captured receipt/slip" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              )}
                            </div>
                            {capturedPaymentImg && (
                              <button
                                type="button"
                                className="nexus-btn nexus-btn-ghost"
                                style={{ marginTop: 8, padding: '4px 8px', fontSize: 11 }}
                                onClick={() => { setCapturedPaymentImg(null); setPaymentImg(''); }}
                              >
                                Retake Slip Photo
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Logged Expenses List */}
                      {job.expenses && job.expenses.length > 0 && (
                        <div style={{ padding: 16, background: 'rgba(255,255,255,0.01)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                          <h4 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Expenses History for this Job ({job.expenses.length})</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {job.expenses.map((e, index) => (
                              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 13 }}>
                                <span>{e.summaryNotes}</span>
                                <span style={{ fontWeight: 600, color: '#f87171' }}>Rs. {e.amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Logged Payments List */}
                      {job.payments && job.payments.length > 0 && (
                        <div style={{ padding: 16, background: 'rgba(255,255,255,0.01)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                          <h4 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Payments History for this Job ({job.payments.length})</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {job.payments.map((p, index) => (
                              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 13 }}>
                                <span>{p.summaryNotes}</span>
                                <span style={{ fontWeight: 600, color: '#10b981' }}>Rs. {p.amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      ) : (
        /* INCOMING OPERATIONS FEED TAB */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Gmail Complaint Ingestion Stream</h2>
            <button type="button" className="nexus-btn nexus-btn-ghost" onClick={loadDashboardData} style={{ padding: '8px 12px', fontSize: 12 }}>
              <RefreshCw size={14} /> Refresh Stream
            </button>
          </div>

          {tickets.length === 0 ? (
            <div className="glass-card" style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
              <AlertCircle size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p>No new complaints in the ingestion stream.</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>The background daemon scanner checks connected Gmails continuously.</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <div key={ticket.id} className="glass-card ticket-summary" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ background: 'rgba(0,242,254,0.08)', padding: 8, borderRadius: 6 }}>
                    <Mail size={16} color="#00f2fe" />
                  </div>
                  <div>
                    <span className="field-label" style={{ marginBottom: 0, fontSize: 10 }}>Ingestion Serial</span>
                    <div style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 700, fontSize: 13 }}>{ticket.serialNo}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                  <div>
                    <span className="field-label" style={{ marginBottom: 2, fontSize: 10 }}>From Sender</span>
                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{ticket.sender}</div>
                  </div>
                  <div>
                    <span className="field-label" style={{ marginBottom: 2, fontSize: 10 }}>Received Date / Time</span>
                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>
                      {new Date(ticket.exactDate).toLocaleDateString()} @ {ticket.time}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="field-label" style={{ marginBottom: 2, fontSize: 10 }}>Subject Line</span>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{ticket.subject}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
