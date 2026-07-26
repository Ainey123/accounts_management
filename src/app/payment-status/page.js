"use client";

import React, { useState, useEffect } from 'react';
import { DollarSign, Search, Mail, MessageSquare, Save } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

export default function PaymentStatusPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [gmailAccounts, setGmailAccounts] = useState([]);
  const [purposeDrafts, setPurposeDrafts] = useState({});
  const [savingPurposeId, setSavingPurposeId] = useState(null);

  const loadJobs = async () => {
    try {
      const data = await apiFetch('/api/jobs');
      setJobs(data.jobs || []);
    } catch (err) {
      setMessage('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const loadGmailAccounts = async () => {
    try {
      const data = await apiFetch('/api/gmail-account');
      const accounts = data.accounts || [];
      setGmailAccounts(accounts);
      const drafts = {};
      accounts.forEach((a) => {
        drafts[a.id] = a.purposeNotes || '';
      });
      setPurposeDrafts(drafts);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadJobs();
    loadGmailAccounts();
  }, []);

  const handleSavePurpose = async (accountId) => {
    setSavingPurposeId(accountId);
    try {
      const { account } = await apiFetch(`/api/gmail-account/${accountId}`, {
        method: 'PATCH',
        body: JSON.stringify({ purposeNotes: purposeDrafts[accountId] || '' }),
      });
      setGmailAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, purposeNotes: account.purposeNotes } : a))
      );
      setMessage('Gmail purpose note saved.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to save Gmail purpose note.');
    } finally {
      setSavingPurposeId(null);
    }
  };

  const handleProgressChange = async (jobId, newProgress) => {
    if (newProgress < 0 || newProgress > 100) return;
    
    setSaving(true);
    try {
      await apiFetch(`/api/jobs/${jobId}/payment-progress`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentProgress: Number(newProgress) }),
      });
      setJobs(prev => prev.map(job => 
        job.id === jobId ? { ...job, paymentProgress: Number(newProgress) } : job
      ));
      setMessage('Payment progress updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to update payment progress');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickSet = async (jobId, value) => {
    await handleProgressChange(jobId, value);
  };

  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      job.clientName?.toLowerCase().includes(q) ||
      job.branchName?.toLowerCase().includes(q) ||
      job.ticket?.serialNo?.toLowerCase().includes(q) ||
      job.ticket?.subject?.toLowerCase().includes(q)
    );
  });

  const getProgressColor = (progress) => {
    if (progress >= 100) return '#10b981';
    if (progress >= 50) return '#f59e0b';
    if (progress > 0) return '#ef4444';
    return '#64748b';
  };

  const getProgressLabel = (progress) => {
    if (progress >= 100) return 'Fully Paid';
    if (progress >= 75) return '75% Paid';
    if (progress >= 50) return '50% Paid';
    if (progress >= 25) return '25% Paid';
    if (progress > 0) return 'Partial';
    return 'No Payment';
  };

  return (
    <div>
      <header className="page-header">
        <h1>Payment Status</h1>
        <p>Update payment progress for jobs manually</p>
      </header>

      {message && (
        <div className={message.includes('Failed') || message.includes('failed') ? 'alert-error' : 'alert-success'} style={{ marginBottom: 20 }}>
          {message}
        </div>
      )}

      <div className="glass-card" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Jobs Payment Progress</h2>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
            <input
              className="nexus-input"
              style={{ paddingLeft: 32, width: 260 }}
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Sr #</th>
                <th>Client</th>
                <th>Branch</th>
                <th>Subject</th>
                <th>Total Amount</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No jobs found.</td></tr>
              ) : (
                filteredJobs.map((job) => {
                  const totalAmount = job.ticket?.quotationInvoices?.[0]?.amount || 0;
                  const progress = job.paymentProgress || 0;
                  return (
                    <tr key={job.id}>
                      <td style={{ fontFamily: 'monospace', color: '#00f2fe' }}>{job.ticket?.serialNo}</td>
                      <td>{job.clientName}</td>
                      <td>{job.branchName}</td>
                      <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.ticket?.subject || '—'}</td>
                      <td>Rs. {totalAmount.toLocaleString()}</td>
                      <td style={{ minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={progress}
                            onChange={(e) => handleProgressChange(job.id, e.target.value)}
                            style={{ width: 60, padding: '4px 8px' }}
                            className="nexus-input"
                          />
                          <span style={{ fontWeight: 600, color: getProgressColor(progress) }}>
                            {progress}%
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: getProgressColor(progress), borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                      </td>
                      <td>
                        <span style={{ color: getProgressColor(progress), fontWeight: 600, fontSize: 12 }}>
                          {getProgressLabel(progress)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {[0, 25, 50, 75, 100].map((val) => (
                            <button
                              key={val}
                              type="button"
                              className="nexus-btn nexus-btn-ghost"
                              onClick={() => handleQuickSet(job.id, val)}
                              style={{ padding: '4px 8px', fontSize: 11 }}
                              disabled={saving}
                            >
                              {val}%
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <section className="glass-card" style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <MessageSquare size={22} color="#00f2fe" />
          <h2 style={{ fontSize: 18, margin: 0 }}>Gmail Account Purpose Notes</h2>
        </div>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
          Document what each connected Gmail inbox is used for so the team knows which account to reference for payments and tickets.
        </p>

        {gmailAccounts.length === 0 ? (
          <p style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>
            No Gmail accounts connected yet. Ask an admin to connect inboxes from Gmail Connection.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {gmailAccounts.map((account) => (
              <div
                key={account.id}
                style={{
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Mail size={18} color="#00f2fe" />
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{account.gmailEmail}</span>
                  {account.purposeNotes && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        color: '#10b981',
                        background: 'rgba(16,185,129,0.12)',
                        padding: '4px 10px',
                        borderRadius: 999,
                        border: '1px solid rgba(16,185,129,0.25)',
                      }}
                    >
                      Documented
                    </span>
                  )}
                </div>
                <label className="field-label">Purpose / Use Case</label>
                <textarea
                  className="nexus-textarea"
                  style={{ minHeight: 90, marginBottom: 12 }}
                  placeholder="e.g. Bank Alfalah payment confirmations, WAPDA complaint inbox, maintenance requests for Lahore branch..."
                  value={purposeDrafts[account.id] ?? ''}
                  onChange={(e) =>
                    setPurposeDrafts((prev) => ({ ...prev, [account.id]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="nexus-btn nexus-btn-primary"
                  onClick={() => handleSavePurpose(account.id)}
                  disabled={savingPurposeId === account.id}
                  style={{ padding: '10px 18px' }}
                >
                  <Save size={16} />
                  {savingPurposeId === account.id ? 'Saving...' : 'Save Purpose Note'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}