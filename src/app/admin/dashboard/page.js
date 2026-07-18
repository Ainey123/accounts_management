"use client";

import React, { useState, useEffect } from 'react';
import {
  Users, Activity, UserPlus, Trash2, X, UserCheck, ShieldAlert,
  Settings, Mail, FileText, RefreshCw, Filter, Search,
  DollarSign, Globe, Phone, MapPin, Save, Eye, Key,
  TrendingUp, TrendingDown, Check, ClipboardCopy,
  CheckCircle, AlertCircle, XCircle
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function AdminCommandCenter() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [employeeMatrix, setEmployeeMatrix] = useState([]);
  const [financials, setFinancials] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [gmailAccounts, setGmailAccounts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ employeeName: '', pin: '' });
  const [message, setMessage] = useState('');
  const [registering, setRegistering] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [ticketFilter, setTicketFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedDate, setFeedDate] = useState('');
  const [feedMonth, setFeedMonth] = useState('');
  const [feedPerson, setFeedPerson] = useState('');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentEmail, setCurrentEmail] = useState('');

  const loadAll = async () => {
    const [userRes, statsRes, finRes, ticketsRes, gmailRes, settingsRes] = await Promise.all([
      apiFetch('/api/users'),
      apiFetch('/api/admin/stats'),
      apiFetch('/api/admin/financials'),
      apiFetch('/api/tickets'),
      apiFetch('/api/gmail-account'),
      apiFetch('/api/admin/settings'),
    ]);
    setUsers(userRes.users || []);
    setStats(statsRes.stats);
    setEmployeeMatrix(statsRes.employeeMatrix || []);
    setFinancials(finRes.financials);
    setTickets(ticketsRes.tickets || []);
    setGmailAccounts(gmailRes.accounts || []);
    setSettings(settingsRes.settings);
  };

  useEffect(() => {
    loadAll().catch(console.error);
  }, []);

  useEffect(() => {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('nexus_user='));
    if (cookie) {
      try {
        const user = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
        setCurrentEmail(user.email);
      } catch (e) { console.error(e); }
    }
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const res = await apiFetch('/api/admin/create-employee', {
        method: 'POST',
        body: JSON.stringify({ employeeName: form.employeeName, pin: form.pin }),
      });
      const action = res.action === 'pin_updated' ? 'PIN updated' : 'Employee created';
      setForm({ employeeName: '', pin: '' });
      setIsModalOpen(false);
      setMessage(`${action}: ${form.employeeName}`);
      await loadAll();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (id, role) => {
    if (role === 'ADMIN') return;
    if (!confirm('Revoke this user\'s system access?')) return;
    try {
      await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      setMessage('User deleted.');
      await loadAll();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      setMessage('Settings saved successfully.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDisconnectGmail = async (accountId) => {
    if (!confirm('Disconnect this Gmail account?')) return;
    try {
      await apiFetch(`/api/gmail-account?accountId=${accountId}`, { method: 'DELETE' });
      setMessage('Gmail disconnected.');
      await loadAll();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordUserId) return;
    setChangingPassword(true);
    try {
      if (passwordForm.password !== passwordForm.confirmPassword) {
        throw new Error('Passwords do not match');
      }
      if (passwordForm.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      await apiFetch(`/api/admin/users/${passwordUserId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: passwordForm.password }),
      });
      setPasswordForm({ password: '', confirmPassword: '' });
      setPasswordModalOpen(false);
      setPasswordUserId(null);
      setMessage('Password changed successfully.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSyncAllGmail = async () => {
    try {
      setMessage('Syncing all Gmail accounts...');
      const result = await apiFetch('/api/gmail-sync', { method: 'POST' });
      const count = result.results?.reduce((sum, r) => sum + (r.synced || 0), 0) || result.synced || 0;
      setMessage(`Synced ${count} new complaint emails.`);
      await loadAll();
    } catch (err) {
      setMessage('Sync failed: ' + err.message);
    }
  };

  const handleFixDuplicates = async () => {
    if (!confirm('This will remove duplicate tickets with same subject and sender. Continue?')) return;
    try {
      const result = await apiFetch('/api/admin/fix-duplicates', { method: 'POST' });
      setMessage(`Removed ${result.deleted} duplicate tickets.`);
      await loadAll();
    } catch (err) {
      setMessage('Fix duplicates failed: ' + err.message);
    }
  };

  const handleCleanInvalidSerials = async () => {
    if (!confirm('This will renumber all ticket serial numbers sequentially as 1, 2, 3... No tickets will be deleted. Continue?')) return;
    try {
      const result = await apiFetch('/api/admin/fix-duplicates', { method: 'DELETE' });
      setMessage(`Renumbered ${result.renumbered} tickets to sequential serials.`);
      await loadAll();
    } catch (err) {
      setMessage('Clean failed: ' + err.message);
    }
  };

  const getTicketEntryPerson = (ticket) =>
    ticket.jobMetadata?.createdBy?.employeeName ||
    ticket.jobMetadata?.createdBy?.email ||
    ticket.jobMetadata?.manualEnteredBy ||
    (ticket.sender === 'Manual Entry' ? 'Manual Entry' : 'Auto-Ingested');

  const feedPersonOptions = Array.from(
    new Set((tickets || []).map(getTicketEntryPerson).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const getLocalDateKey = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const filteredTickets = tickets.filter((t) => {
    if (ticketFilter === 'pending') return !t.jobMetadata;
    if (ticketFilter === 'intake') return !!t.jobMetadata;
    return true;
  }).filter((t) => {
    const dateKey = getLocalDateKey(t.exactDate);
    const monthKey = dateKey.slice(0, 7);
    const enteredBy = getTicketEntryPerson(t);

    if (feedDate && dateKey !== feedDate) return false;
    if (feedMonth && monthKey !== feedMonth) return false;
    if (feedPerson && enteredBy !== feedPerson) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.subject?.toLowerCase().includes(q) ||
      t.sender?.toLowerCase().includes(q) ||
      t.serialNo?.toLowerCase().includes(q) ||
      t.gmailAccount?.gmailEmail?.toLowerCase().includes(q) ||
      (enteredBy || '').toLowerCase().includes(q) ||
      t.jobMetadata?.clientName?.toLowerCase().includes(q) ||
      t.jobMetadata?.branchName?.toLowerCase().includes(q)
    );
  });

  const employees = users.filter((u) => u.role === 'EMPLOYEE');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'tickets', label: 'All Tickets', icon: FileText },
    { id: 'gmail', label: 'Gmail Accounts', icon: Mail },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="admin-grid">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', padding: 12, borderRadius: 12 }}>
            <ShieldAlert size={28} color="#fff" />
          </div>
          <div>
            <h1>Admin Command Center</h1>
            <p style={{ color: '#a78bfa' }}>Level 5 Authorization Active</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`nav-panel ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{ fontSize: 13 }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {message && <div className="alert-success">{message}</div>}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <>
          <section className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <Activity size={20} color="#f59e0b" />
              <h2 style={{ fontSize: 18, margin: 0 }}>Strategic Workflow Matrix</h2>
            </div>
            {stats && (
              <div className="admin-metrics-row">
                {[
                  { label: 'Not Entered Complaints', value: stats.notEnteredComplaints, color: '#f59e0b' },
                  { label: 'Entered Emails', value: stats.enteredEmails, color: '#00f2fe' },
                  { label: 'Generated Quotes', value: stats.generatedQuotes, color: '#a78bfa' },
                  { label: 'Approved Quotes', value: stats.approvedQuotations, color: '#22c55e' },
                  { label: 'Generated Invoices', value: stats.generatedInvoices, color: '#3b82f6' },
                ].map((m) => (
                  <div key={m.label} className="metric-tile">
                    <div className="metric-digit" style={{ color: m.color }}>{m.value}</div>
                    <div className="metric-tile-label">{m.label}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* EMAIL STATUS CARDS — Relevant / Irrelevant / Cancelled */}
          {stats && (
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {/* Relevant */}
              <div className="glass-card" style={{ padding: '28px 24px', border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.04)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -16, right: -16, width: 80, height: 80, borderRadius: '50%', background: 'rgba(34,197,94,0.08)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={22} color="#22c55e" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Relevant Emails</div>
                    <div style={{ fontSize: 10, color: '#4b5563' }}>Marked relevant by employees</div>
                  </div>
                </div>
                <div style={{ fontSize: 48, fontWeight: 800, color: '#22c55e', lineHeight: 1 }}>{stats.relevantCount ?? 0}</div>
                <div style={{ marginTop: 12, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, ((stats.relevantCount ?? 0) / Math.max(1, stats.totalTickets ?? 1)) * 100)}%`, background: 'linear-gradient(90deg, #22c55e, #4ade80)', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 11, color: '#4b5563', marginTop: 6 }}>{stats.totalTickets ? Math.round(((stats.relevantCount ?? 0) / stats.totalTickets) * 100) : 0}% of total emails</div>
              </div>

              {/* Irrelevant */}
              <div className="glass-card" style={{ padding: '28px 24px', border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.04)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -16, right: -16, width: 80, height: 80, borderRadius: '50%', background: 'rgba(245,158,11,0.08)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertCircle size={22} color="#f59e0b" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Irrelevant Emails</div>
                    <div style={{ fontSize: 10, color: '#4b5563' }}>Filtered out as not applicable</div>
                  </div>
                </div>
                <div style={{ fontSize: 48, fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>{stats.irrelevantCount ?? 0}</div>
                <div style={{ marginTop: 12, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, ((stats.irrelevantCount ?? 0) / Math.max(1, stats.totalTickets ?? 1)) * 100)}%`, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 11, color: '#4b5563', marginTop: 6 }}>{stats.totalTickets ? Math.round(((stats.irrelevantCount ?? 0) / stats.totalTickets) * 100) : 0}% of total emails</div>
              </div>

              {/* Cancelled */}
              <div className="glass-card" style={{ padding: '28px 24px', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -16, right: -16, width: 80, height: 80, borderRadius: '50%', background: 'rgba(239,68,68,0.08)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <XCircle size={22} color="#ef4444" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cancelled Emails</div>
                    <div style={{ fontSize: 10, color: '#4b5563' }}>Cancelled by employees</div>
                  </div>
                </div>
                <div style={{ fontSize: 48, fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>{stats.cancelledCount ?? 0}</div>
                <div style={{ marginTop: 12, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, ((stats.cancelledCount ?? 0) / Math.max(1, stats.totalTickets ?? 1)) * 100)}%`, background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 11, color: '#4b5563', marginTop: 6 }}>{stats.totalTickets ? Math.round(((stats.cancelledCount ?? 0) / stats.totalTickets) * 100) : 0}% of total emails</div>
              </div>
            </section>
          )}

          {/* EMPLOYEE BUSINESS CARD MATRIX */}
          <section className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Users size={20} color="#00f2fe" />
              <h2 style={{ fontSize: 18, margin: 0 }}>Employee Business Card Matrix</h2>
            </div>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 20 }}>
              Per-employee breakdown of all business card statuses (total across all tickets)
            </p>
            {employeeMatrix.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>No employees found.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th style={{ color: '#f59e0b' }}>Not Entered</th>
                      <th style={{ color: '#00f2fe' }}>Entered</th>
                      <th style={{ color: '#ef4444' }}>Cancelled</th>
                      <th style={{ color: '#22c55e' }}>Relevant</th>
                      <th style={{ color: '#a78bfa' }}>Quotation Sent</th>
                      <th style={{ color: '#3b82f6' }}>Invoice Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeMatrix.map((emp) => (
                      <tr key={emp.employeeId}>
                        <td style={{ fontWeight: 600 }}>{emp.employeeName}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '2px 10px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
                            {stats?.totalNotEntered ?? '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: 'rgba(0,242,254,0.1)', color: '#00f2fe', padding: '2px 10px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
                            {emp.entered}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 10px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
                            {emp.cancelled}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 10px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
                            {emp.relevant}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '2px 10px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
                            {emp.quotationSent}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '2px 10px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
                            {emp.invoiceSent}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', fontWeight: 700 }}>
                      <td style={{ color: '#a78bfa', fontWeight: 700 }}>TOTALS</td>
                      <td style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 700 }}>{stats?.totalNotEntered ?? '—'}</td>
                      <td style={{ textAlign: 'center', color: '#00f2fe', fontWeight: 700 }}>{stats?.enteredEmails ?? '—'}</td>
                      <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>{employeeMatrix.reduce((s, e) => s + e.cancelled, 0)}</td>
                      <td style={{ textAlign: 'center', color: '#22c55e', fontWeight: 700 }}>{employeeMatrix.reduce((s, e) => s + e.relevant, 0)}</td>
                      <td style={{ textAlign: 'center', color: '#a78bfa', fontWeight: 700 }}>{stats?.generatedQuotes ?? '—'}</td>
                      <td style={{ textAlign: 'center', color: '#3b82f6', fontWeight: 700 }}>{stats?.generatedInvoices ?? '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <DollarSign size={20} color="#10b981" />
              <h2 style={{ fontSize: 18, margin: 0 }}>Financial Overview</h2>
            </div>
             {financials && (
               <div className="financial-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                 <div className="financial-tile">
                   <span className="field-label">Total Business</span>
                   <div className="financial-value" style={{ color: '#3b82f6', fontSize: 20 }}>
                     Rs. {financials.totalBusiness.toLocaleString()}
                     <div style={{ fontSize: 11, color: '#64748b', fontWeight: 'normal', marginTop: 4 }}>
                       ({financials.invoicesCount || 0} Invoices)
                     </div>
                   </div>
                 </div>
                 <div className="financial-tile">
                   <span className="field-label">Total Tax Deduction</span>
                   <div className="financial-value" style={{ color: '#f87171', fontSize: 20 }}>
                     Rs. {financials.taxDeduction.toLocaleString()}
                   </div>
                 </div>
                 <div className="financial-tile">
                   <span className="field-label">Net Amount</span>
                   <div className="financial-value" style={{ color: '#00f2fe', fontSize: 20 }}>
                     Rs. {(financials.netTotalBusiness || 0).toLocaleString()}
                   </div>
                 </div>
                 <div className="financial-tile">
                   <span className="field-label">Total Received</span>
                   <div className="financial-value" style={{ color: '#34d399', fontSize: 20 }}>
                     Rs. {financials.totalReceived.toLocaleString()}
                   </div>
                 </div>
                 <div className="financial-tile net" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: 16 }}>
                   <span className="field-label" style={{ color: financials.isProfit ? '#10b981' : '#f87171', fontWeight: 600 }}>
                     {financials.isProfit ? 'Profit' : 'Loss'} Status
                   </span>
                   <div className="financial-value" style={{ color: financials.isProfit ? '#34d399' : '#f87171', display: 'flex', alignItems: 'center', gap: 6, fontSize: 20 }}>
                     {financials.isProfit ? <TrendingUp size={18} color="#34d399" /> : <TrendingDown size={18} color="#f87171" />}
                     Rs. {Math.abs(financials.profitOrLoss || 0).toLocaleString()}
                   </div>
                 </div>
               </div>
             )}
             {financials && (
               <div className="financial-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
                 <div className="financial-tile">
                   <span className="field-label">Payment Progress (Avg)</span>
                   <div className="financial-value" style={{ color: '#a78bfa', fontSize: 24 }}>
                     {financials.avgPaymentProgress || 0}%
                   </div>
                   <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
                     <div style={{ width: `${financials.avgPaymentProgress || 0}%`, height: '100%', background: '#a78bfa', borderRadius: 4, transition: 'width 0.3s' }} />
                   </div>
                 </div>
                 <div className="financial-tile">
                   <span className="field-label">Fully Paid Jobs</span>
                   <div className="financial-value" style={{ color: '#10b981', fontSize: 24 }}>
                     {financials.jobsByProgress?.fullyPaid || 0}
                   </div>
                 </div>
                 <div className="financial-tile">
                   <span className="field-label">Pending Payments</span>
                   <div className="financial-value" style={{ color: '#f59e0b', fontSize: 24 }}>
                     {(financials.jobsByProgress?.partial || 0) + (financials.jobsByProgress?.notStarted || 0)}
                   </div>
                 </div>
               </div>
             )}
          </section>
        </>
      )}

      {/* EMPLOYEES TAB */}
      {activeTab === 'employees' && (
        <section className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Users size={20} color="#00f2fe" />
              <h2 style={{ fontSize: 18, margin: 0 }}>Live Employee Tracker ({employees.length})</h2>
            </div>
            <button type="button" className="nexus-btn nexus-btn-primary" onClick={() => setIsModalOpen(true)}>
              <UserPlus size={16} /> Register User
            </button>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Login</th>
                <th>PIN</th>
                <th>Role</th>
                <th>Active Job</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const serial = u.assignedJobs?.[0]?.ticket?.serialNo;
                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.employeeName}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{u.role === 'EMPLOYEE' ? 'PIN Login' : u.email}</td>
                    <td style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', letterSpacing: 2 }}>{u.role === 'EMPLOYEE' ? (u.pin || '—') : '—'}</td>
                    <td>
                      <span className={`status-pill ${u.role === 'ADMIN' ? 'active' : ''}`} style={u.role === 'ADMIN' ? { background: 'rgba(167,139,250,0.2)', color: '#a78bfa' } : {}}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', color: '#00f2fe' }}>{serial || '—'}</td>
                    <td>
                      <span className={`status-pill ${u.activeStatus ? 'active' : 'inactive'}`}>
                        {u.activeStatus ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="nexus-btn nexus-btn-ghost" style={{ padding: 6 }} title="View">
                          <Eye size={14} />
                        </button>
                        {u.role !== 'ADMIN' && (
                          <button
                            type="button"
                            className="nexus-btn nexus-btn-ghost"
                            onClick={() => { setPasswordUserId(u.id); setPasswordForm({ password: '', confirmPassword: '' }); setPasswordModalOpen(true); }}
                            style={{ padding: 6, color: '#f59e0b' }}
                            title="Reset Password"
                          >
                            <Key size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="nexus-btn nexus-btn-ghost"
                          onClick={() => handleDelete(u.id, u.role)}
                          style={{ color: '#ef4444', padding: 6 }}
                          title="Delete"
                          disabled={u.role === 'ADMIN'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* TICKETS TAB */}
      {activeTab === 'tickets' && (
        <section className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FileText size={20} color="#00f2fe" />
              <h2 style={{ fontSize: 18, margin: 0 }}>All Tickets ({tickets.length})</h2>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="nexus-btn nexus-btn-ghost" onClick={handleFixDuplicates} style={{ color: '#f59e0b' }}>
                <Filter size={16} /> Fix Duplicates
              </button>
              <button type="button" className="nexus-btn nexus-btn-ghost" onClick={handleCleanInvalidSerials} style={{ color: '#ef4444' }}>
                <Trash2 size={16} /> Renumber Serials (1,2,3)
              </button>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
                <input
                  className="nexus-input"
                  style={{ paddingLeft: 32, width: 220 }}
                  placeholder="Search by subject, serial, sender..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <input className="nexus-input" type="date" value={feedDate} onChange={(e) => setFeedDate(e.target.value)} title="Exact Date" />
              <input className="nexus-input" type="month" value={feedMonth} onChange={(e) => setFeedMonth(e.target.value)} title="Month" />
              <select className="nexus-select" value={feedPerson} onChange={(e) => setFeedPerson(e.target.value)}>
                <option value="">All people</option>
                {feedPersonOptions.map((person) => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
              <select className="nexus-select" value={ticketFilter} onChange={(e) => setTicketFilter(e.target.value)}>
                <option value="all">All Tickets</option>
                <option value="pending">Pending Intake</option>
                <option value="intake">Intake Completed</option>
              </select>
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Serial</th>
                <th>Copy</th>
                <th>Date</th>
                <th>Time</th>
                <th>Sender</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Entered By</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((t) => {
                return (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 600 }}>{t.serialNo}</td>
                    <td>
                      <button
                        type="button"
                        className="nexus-btn nexus-btn-ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(t.serialNo);
                          setMessage(`Copied ${t.serialNo}`);
                        }}
                        title="Copy Serial"
                        style={{ padding: 4 }}
                      >
                        <ClipboardCopy size={14} />
                      </button>
                    </td>
                    <td>{new Date(t.exactDate).toLocaleDateString()}</td>
                    <td>{t.time}</td>
                    <td>{t.sender}</td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</td>
                    <td>
                      {(() => {
                        let text = 'Pending';
                        let pillStyle = { background: 'rgba(255,255,255,0.05)', color: '#64748b' };
                        
                        if (t.jobMetadata) {
                          text = 'Intake Done';
                          pillStyle = { background: 'rgba(34,197,94,0.15)', color: '#22c55e' };
                        } else if (t.status === 'RELEVANT') {
                          text = 'Relevant';
                          pillStyle = { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' };
                        } else if (t.status === 'IRRELEVANT') {
                          text = 'Irrelevant';
                          pillStyle = { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' };
                        } else if (t.status === 'CANCELLED') {
                          text = 'Cancelled';
                          pillStyle = { background: 'rgba(239,68,68,0.15)', color: '#ef4444' };
                        }

                        if (t.statusLastChangedBy) {
                          text += ` (by ${t.statusLastChangedBy})`;
                        }

                        return (
                          <span className="status-pill" style={{ ...pillStyle, fontSize: 11, padding: '4px 8px', borderRadius: 6, display: 'inline-block', whiteSpace: 'nowrap' }}>
                            {text}
                          </span>
                        );
                      })()}
                    </td>
                    <td>{t.jobMetadata?.assignedEmployee?.employeeName || '—'}</td>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>
                      {getTicketEntryPerson(t)}
                    </td>
                  </tr>
                );
              })}
              {filteredTickets.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No tickets found.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* GMAIL TAB */}
      {activeTab === 'gmail' && (
        <section className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Mail size={20} color="#22c55e" />
              <h2 style={{ fontSize: 18, margin: 0 }}>Connected Gmail Accounts ({gmailAccounts.length})</h2>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="nexus-btn nexus-btn-ghost" onClick={handleFixDuplicates} style={{ color: '#f59e0b' }}>
                <Filter size={16} /> Fix Duplicates
              </button>
              <button type="button" className="nexus-btn nexus-btn-ghost" onClick={handleCleanInvalidSerials} style={{ color: '#ef4444' }}>
                <Trash2 size={16} /> Renumber Serials (1,2,3)
              </button>
              <button type="button" className="nexus-btn nexus-btn-primary" onClick={handleSyncAllGmail}>
                <RefreshCw size={16} /> Sync All Accounts
              </button>
            </div>
          </div>

          {gmailAccounts.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
              No Gmail accounts connected. Go to Gmail Connection page to add one.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Connected</th>
                  <th>Last Synced</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {gmailAccounts.map((acc) => (
                  <tr key={acc.id}>
                    <td style={{ fontWeight: 600 }}>{acc.gmailEmail}</td>
                    <td>{new Date(acc.createdAt).toLocaleDateString()}</td>
                    <td>{acc.syncedAt ? new Date(acc.syncedAt).toLocaleString() : 'Never'}</td>
                    <td>
                      <button
                        type="button"
                        className="nexus-btn nexus-btn-ghost"
                        onClick={() => handleDisconnectGmail(acc.id)}
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 size={14} /> Disconnect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && settings && (
        <section className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Settings size={20} color="#a78bfa" />
            <h2 style={{ fontSize: 18, margin: 0 }}>System Settings</h2>
          </div>

          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="field-label"><Globe size={12} style={{ display: 'inline', marginRight: 4 }} />App Name</label>
                <input className="nexus-input" value={settings.appName} onChange={(e) => setSettings({ ...settings, appName: e.target.value })} />
              </div>
              <div>
                <label className="field-label"><Globe size={12} style={{ display: 'inline', marginRight: 4 }} />Company Name</label>
                <input className="nexus-input" value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} />
              </div>
              <div>
                <label className="field-label"><Mail size={12} style={{ display: 'inline', marginRight: 4 }} />Company Email</label>
                <input className="nexus-input" type="email" value={settings.companyEmail} onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })} />
              </div>
              <div>
                <label className="field-label"><Phone size={12} style={{ display: 'inline', marginRight: 4 }} />Company Phone</label>
                <input className="nexus-input" value={settings.companyPhone} onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="field-label"><MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />Company Address</label>
                <input className="nexus-input" value={settings.companyAddress} onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Tax Rate (%)</label>
                <input className="nexus-input" type="number" step="0.01" value={settings.taxRate * 100} onChange={(e) => setSettings({ ...settings, taxRate: Number(e.target.value) / 100 })} />
              </div>
              <div>
                <label className="field-label">Currency</label>
                <select className="nexus-select" value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })}>
                  <option value="PKR">PKR (Rs)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.emailFilterEnabled} onChange={(e) => setSettings({ ...settings, emailFilterEnabled: e.target.checked })} />
                <span>Enable complaint email filter</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.autoSyncEnabled} onChange={(e) => setSettings({ ...settings, autoSyncEnabled: e.target.checked })} />
                <span>Enable auto-sync Gmail</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={() => {
                  const admin = users.find(u => u.email === currentEmail);
                  if (admin) {
                    setPasswordUserId(admin.id);
                    setPasswordForm({ password: '', confirmPassword: '' });
                    setPasswordModalOpen(true);
                  }
                }}
              >
                <Key size={16} /> Change My Password
              </button>
            </div>

            <button type="submit" className="nexus-btn nexus-btn-primary" disabled={savingSettings}>
              <Save size={16} /> {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </section>
      )}

      {/* EMPLOYEE MODAL */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }} onClick={() => setIsModalOpen(false)}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <UserCheck size={20} color="#00f2fe" />
                <h3 style={{ margin: 0 }}>Add Employee Login</h3>
              </div>
              <button type="button" className="nexus-btn nexus-btn-ghost" onClick={() => setIsModalOpen(false)} style={{ padding: 8 }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
              Enter the employee&apos;s name and assign them a 4-6 digit PIN.
              If the employee already exists, their PIN will be updated.
            </p>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Employee Name</label>
                <input
                  className="nexus-input"
                  required
                  placeholder="e.g. Ibrahim, Rizwan"
                  value={form.employeeName}
                  onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">Login PIN (4-6 digits)</label>
                <input
                  className="nexus-input"
                  type="password"
                  inputMode="numeric"
                  required
                  placeholder="e.g. 1234"
                  value={form.pin}
                  maxLength={6}
                  pattern="\d{4,6}"
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                />
                <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>The employee uses this PIN to log in — no email required.</p>
              </div>
              <button type="submit" className="nexus-btn nexus-btn-primary" disabled={registering}>
                <Key size={15} /> {registering ? 'Saving...' : 'Save Employee'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD CHANGE MODAL */}
      {passwordModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }} onClick={() => setPasswordModalOpen(false)}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Key size={20} color="#f59e0b" />
                <h3 style={{ margin: 0 }}>Change Password</h3>
              </div>
              <button type="button" className="nexus-btn nexus-btn-ghost" onClick={() => setPasswordModalOpen(false)} style={{ padding: 8 }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">New Password</label>
                <input className="nexus-input" type="password" required value={passwordForm.password} onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Confirm Password</label>
                <input className="nexus-input" type="password" required value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
              </div>
              <button type="submit" className="nexus-btn nexus-btn-primary" disabled={changingPassword}>
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
