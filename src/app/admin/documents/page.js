"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Download, Filter, RefreshCw, FileText, DollarSign,
  Clock, CheckCircle, AlertTriangle, XCircle, Eye,
  Search, ChevronDown, ChevronUp, Table2,
  Wrench, Zap, Building2, Hammer,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

const WORK_NATURES = ['ELECTRICAL', 'WAPDA', 'MAINTENANCE', 'PROJECT'];
const PENDING_OPTIONS = [
  { value: '', label: 'All Documents' },
  { value: 'quotation', label: 'Quotation Pending' },
  { value: 'invoice', label: 'Invoice Pending' },
  { value: 'payment', label: 'Payment Pending' },
  { value: 'completion', label: 'Completion Pending' },
  { value: 'bank', label: 'Bank Approval Pending' },
  { value: 'expense', label: 'Has Expenses' },
];

export default function AdminDocumentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [ledger, setLedger] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [workNatureFilter, setWorkNatureFilter] = useState('');
  const [pendingFilter, setPendingFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams();
      if (workNatureFilter) params.set('workNature', workNatureFilter);
      if (pendingFilter) params.set('pending', pendingFilter);
      const data = await apiFetch(`/api/admin/all-documents?${params.toString()}`);
      setLedger(data.ledger || []);
      setSummary(data.summary);
    } catch (err) {
      setMessage('Failed to load documents: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [workNatureFilter, pendingFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDownload = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (workNatureFilter) params.set('workNature', workNatureFilter);
      params.set('format', 'csv');
      const res = await fetch(`/api/admin/download-ledger?${params.toString()}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-${workNatureFilter || 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage('Download started.');
    } catch (err) {
      setMessage('Download failed: ' + err.message);
    }
  }, [workNatureFilter]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filteredLedger = ledger.filter((job) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (job.ticket?.serialNo || '').toLowerCase().includes(q) ||
      (job.ticket?.subject || '').toLowerCase().includes(q) ||
      (job.clientName || '').toLowerCase().includes(q) ||
      (job.branchName || '').toLowerCase().includes(q) ||
      (job.assignedEmployee?.employeeName || '').toLowerCase().includes(q)
    );
  });

  const sortedLedger = [...filteredLedger].sort((a, b) => {
    let va = a[sortField], vb = b[sortField];
    if (sortField === 'createdAt') {
      va = new Date(va).getTime();
      vb = new Date(vb).getTime();
    }
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  if (user?.role !== 'ADMIN') {
    return null;
  }

  const natureIcon = (nature) => {
    switch (nature) {
      case 'ELECTRICAL': return <Zap size={14} />;
      case 'WAPDA': return <Building2 size={14} />;
      case 'MAINTENANCE': return <Wrench size={14} />;
      case 'PROJECT': return <Hammer size={14} />;
      default: return <FileText size={14} />;
    }
  };

  const pendingBadge = (count, color) => {
    if (!count) return null;
    return (
      <span style={{
        background: color,
        color: '#fff',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
      }}>
        {count}
      </span>
    );
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>All Documents & Ledger</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
            Complete business ledger with pending status tracking across all work natures.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="nexus-btn nexus-btn-ghost" onClick={loadData} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" className="nexus-btn nexus-btn-primary" onClick={handleDownload}>
            <Download size={16} /> Download CSV
          </button>
        </div>
      </header>

      {message && (
        <div className={message.includes('failed') ? 'alert-error' : 'alert-success'} style={{ marginBottom: 20 }}>
          {message}
        </div>
      )}

      {/* SUMMARY CARDS */}
      {summary && (
        <section className="glass-card" style={{ marginBottom: 24 }}>
          <div className="admin-metrics-row">
            {[
              { label: 'Total Jobs', value: summary.totalJobs, color: '#00f2fe' },
              { label: 'Quotations Sent', value: summary.totalQuotations, color: '#a78bfa' },
              { label: 'Approved Quotes', value: summary.approvedQuotations, color: '#22c55e' },
              { label: 'Invoices', value: summary.totalInvoices, color: '#3b82f6' },
              { label: 'Total Received', value: `Rs. ${(summary.totalPayments || 0).toLocaleString()}`, color: '#34d399' },
              { label: 'Net Received', value: `Rs. ${(summary.netReceived || 0).toLocaleString()}`, color: '#00f2fe' },
              { label: 'Total Expenses', value: `Rs. ${(summary.totalExpenses || 0).toLocaleString()}`, color: '#f87171' },
              { label: 'Completions', value: summary.completions, color: '#10b981' },
              { label: 'Pending Jobs', value: summary.pendingJobs, color: '#f59e0b' },
            ].map((m) => (
              <div key={m.label} className="metric-tile">
                <div className="metric-digit" style={{ color: m.color }}>{m.value}</div>
                <div className="metric-tile-label">{m.label}</div>
              </div>
            ))}
          </div>

          {/* WORK NATURE BREAKDOWN */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 20 }}>
            {WORK_NATURES.map((nature) => (
              <div key={nature} className="glass-card" style={{ padding: 16, cursor: 'pointer', border: workNatureFilter === nature ? '1px solid rgba(0,242,254,0.4)' : '1px solid rgba(255,255,255,0.05)' }}
                onClick={() => setWorkNatureFilter(workNatureFilter === nature ? '' : nature)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {natureIcon(nature)}
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{nature}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#00f2fe' }}>{summary.jobsByNature[nature] || 0}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>jobs</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FILTERS */}
      <section className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
            <input
              className="nexus-input"
              style={{ paddingLeft: 32 }}
              placeholder="Search by serial, subject, client, assignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select className="nexus-select" style={{ width: 180 }} value={workNatureFilter} onChange={(e) => setWorkNatureFilter(e.target.value)}>
            <option value="">All Work Natures</option>
            {WORK_NATURES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select className="nexus-select" style={{ width: 200 }} value={pendingFilter} onChange={(e) => setPendingFilter(e.target.value)}>
            {PENDING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </section>

      {/* LEDGER TABLE */}
      <section className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>
            Ledger Entries ({sortedLedger.length})
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>Loading ledger...</div>
        ) : sortedLedger.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>No documents found for the selected filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('ticket.serialNo')}>
                    Serial {sortField === 'ticket.serialNo' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th>Subject</th>
                  <th>Client</th>
                  <th>Branch</th>
                  <th>Nature</th>
                  <th>Assigned To</th>
                  <th>Quotation</th>
                  <th>Invoice</th>
                  <th>Payment</th>
                  <th>Completion</th>
                  <th>Bank</th>
                  <th>Expense</th>
                  <th>Progress</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedLedger.map((job) => {
                  const p = job.pendingStatuses || {};
                  const isExpanded = expandedId === job.id;
                  return (
                    <React.Fragment key={job.id}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : job.id)}>
                        <td style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 600, fontSize: 13 }}>
                          {job.ticket?.serialNo || '—'}
                        </td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {job.ticket?.subject || '—'}
                        </td>
                        <td>{job.clientName}</td>
                        <td>{job.branchName}</td>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {natureIcon(job.workNature)} {job.workNature}
                          </span>
                        </td>
                        <td>{job.assignedEmployee?.employeeName || '—'}</td>
                        <td>{pendingBadge(p.quotationPending, '#a78bfa')}</td>
                        <td>{pendingBadge(p.invoicePending, '#3b82f6')}</td>
                        <td>{p.paymentPending ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>Pending</span> : <span style={{ color: '#22c55e' }}>OK</span>}</td>
                        <td>{p.completionPending ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>Pending</span> : <span style={{ color: '#22c55e' }}>Done</span>}</td>
                        <td>{p.bankPending ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>Pending</span> : <span style={{ color: '#22c55e' }}>OK</span>}</td>
                        <td>{p.expensePending ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>Yes</span> : <span style={{ color: '#64748b' }}>—</span>}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', minWidth: 50 }}>
                              <div style={{ width: `${job.paymentProgress || 0}%`, height: '100%', background: job.paymentProgress === 100 ? '#22c55e' : '#a78bfa', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>{job.paymentProgress || 0}%</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: '#94a3b8' }}>
                          {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          <button type="button" className="nexus-btn nexus-btn-ghost" style={{ padding: 4 }} title="View details">
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={15} style={{ padding: 16, background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, fontSize: 13 }}>
                              <div>
                                <strong style={{ color: '#00f2fe' }}>Ticket Details</strong>
                                <div style={{ color: '#94a3b8', marginTop: 4 }}>
                                  Subject: {job.ticket?.subject || '—'}<br />
                                  Sender: {job.ticket?.status || '—'}<br />
                                  Date: {job.ticket?.exactDate ? new Date(job.ticket.exactDate).toLocaleDateString() : '—'}<br />
                                  Status: {job.ticket?.status || '—'}
                                </div>
                              </div>
                              <div>
                                <strong style={{ color: '#00f2fe' }}>Financials</strong>
                                <div style={{ color: '#94a3b8', marginTop: 4 }}>
                                  Total Quotation: Rs. {(job.quotationInvoices || []).filter(q => q.documentType === 'QUOTATION').reduce((s, q) => { const items = Array.isArray(q.lineItems) ? q.lineItems : []; return s + items.reduce((a, i) => a + (Number(i.amount) || 0), 0); }, 0).toLocaleString()}<br />
                                  Total Invoice: Rs. {(job.quotationInvoices || []).filter(q => q.documentType === 'INVOICE').reduce((s, q) => { const items = Array.isArray(q.lineItems) ? q.lineItems : []; return s + items.reduce((a, i) => a + (Number(i.amount) || 0), 0); }, 0).toLocaleString()}<br />
                                  Total Payment: Rs. {(job.payments || []).reduce((s, p) => s + p.amount, 0).toLocaleString()}<br />
                                  Total Tax Deducted: Rs. {(job.payments || []).reduce((s, p) => s + (p.taxDeducted || 0), 0).toLocaleString()}<br />
                                  Total Expense: Rs. {(job.expenses || []).reduce((s, e) => s + e.amount, 0).toLocaleString()}<br />
                                  Net Received: Rs. {(job.payments || []).reduce((s, p) => s + p.amount - (p.taxDeducted || 0), 0).toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <strong style={{ color: '#00f2fe' }}>Work Completion</strong>
                                <div style={{ color: '#94a3b8', marginTop: 4 }}>
                                  Status: {job.workCompletion?.status || 'NOT STARTED'}<br />
                                  Amount: Rs. {(job.workCompletion?.amount || 0).toLocaleString()}<br />
                                  Notes: {job.workCompletion?.notes || '—'}
                                </div>
                              </div>
                              <div>
                                <strong style={{ color: '#00f2fe' }}>Bank Approval</strong>
                                <div style={{ color: '#94a3b8', marginTop: 4 }}>
                                  Bank: {job.bankApproval?.bankName || '—'}<br />
                                  Account: {job.bankApproval?.accountNumber || '—'}<br />
                                  Amount: Rs. {(job.bankApproval?.amount || 0).toLocaleString()}<br />
                                  Status: {job.bankApproval?.status || '—'}
                                </div>
                              </div>
                              {(job.expenses || []).length > 0 && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <strong style={{ color: '#00f2fe' }}>Expenses</strong>
                                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {(job.expenses || []).map((exp) => (
                                      <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                                        <span>{exp.summaryNotes}</span>
                                        <span style={{ fontWeight: 700 }}>Rs. {exp.amount.toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(job.quotationInvoices || []).length > 0 && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <strong style={{ color: '#00f2fe' }}>Documents</strong>
                                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {(job.quotationInvoices || []).map((doc) => (
                                      <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                                        <span>{doc.documentType} {doc.poNumber ? `(${doc.poNumber})` : ''}</span>
                                        <span style={{ fontWeight: 700, color: doc.status === 'APPROVED' ? '#22c55e' : doc.status === 'PAID' ? '#3b82f6' : '#f59e0b' }}>{doc.status}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}