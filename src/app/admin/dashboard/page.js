"use client";

import React, { useState, useEffect } from 'react';
import {
  Users, Activity, UserPlus, Trash2, X, UserCheck, ShieldAlert,
  Settings, Mail, FileText, RefreshCw, Filter, Search,
  DollarSign, Globe, Phone, MapPin, Save, Eye, Key,
  TrendingUp, TrendingDown, Check
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function AdminCommandCenter() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [gmailAccounts, setGmailAccounts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ employeeName: '', email: '', password: '', role: 'EMPLOYEE' });
  const [message, setMessage] = useState('');
  const [registering, setRegistering] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [ticketFilter, setTicketFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
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
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({ employeeName: '', email: '', password: '', role: 'EMPLOYEE' });
      setIsModalOpen(false);
      setMessage('User registered successfully.');
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
    if (!confirm('This will delete tickets with invalid serial numbers (not #XXX format) and renumber all tickets. Continue?')) return;
    try {
      const result = await apiFetch('/api/admin/fix-duplicates', { method: 'DELETE' });
      setMessage(`Cleaned ${result.deleted} invalid tickets.`);
      await loadAll();
    } catch (err) {
      setMessage('Clean failed: ' + err.message);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (ticketFilter === 'pending') return !t.jobMetadata;
    if (ticketFilter === 'intake') return !!t.jobMetadata;
    return true;
  }).filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.subject?.toLowerCase().includes(q) ||
      t.sender?.toLowerCase().includes(q) ||
      t.serialNo?.toLowerCase().includes(q)
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
                <th>Email</th>
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
                    <td>{u.email}</td>
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
                <Trash2 size={16} /> Clean Invalid Serials
              </button>
              <select className="nexus-select" value={ticketFilter} onChange={(e) => setTicketFilter(e.target.value)} style={{ width: 'auto' }}>
                <option value="all">All</option>
                <option value="pending">Pending Only</option>
                <option value="intake">Intake Only</option>
              </select>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
                <input
                  className="nexus-input"
                  style={{ paddingLeft: 32, width: 220 }}
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Serial</th>
                <th>Date</th>
                <th>Time</th>
                <th>Sender</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((t) => {
                const isManual = t.sender === 'Manual Entry' || t.gmailMessageId?.startsWith('manual-');
                const creatorInfo = t.createdBy ? `${t.createdBy.employeeName}` : (isManual ? 'Unknown' : t.gmailAccount?.gmailEmail || '—');
                return (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 600 }}>{t.serialNo}</td>
                    <td>{new Date(t.exactDate).toLocaleDateString()}</td>
                    <td>{t.time}</td>
                    <td>{t.sender}</td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</td>
                    <td>
                      <span className={`status-pill ${t.jobMetadata ? 'active' : ''}`} style={!t.jobMetadata ? { background: 'rgba(248,113,113,0.2)', color: '#f87171' } : {}}>
                        {t.jobMetadata ? 'Intake Done' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#a78bfa' }}>{creatorInfo}</td>
                  </tr>
                );
              })}
              {filteredTickets.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No tickets found.</td></tr>
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
                <Trash2 size={16} /> Clean Invalid Serials
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
          <div className="glass-card" style={{ width: '100%', maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <UserCheck size={20} color="#00f2fe" />
                <h3 style={{ margin: 0 }}>Create User Account</h3>
              </div>
              <button type="button" className="nexus-btn nexus-btn-ghost" onClick={() => setIsModalOpen(false)} style={{ padding: 8 }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Full Name</label>
                <input className="nexus-input" required value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Email (Login ID)</label>
                <input className="nexus-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Password</label>
                <input className="nexus-input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Role</label>
                <select className="nexus-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <button type="submit" className="nexus-btn nexus-btn-primary" disabled={registering}>
                {registering ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD CHANGE MODAL */}
      {passwordModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }} onClick={() => setPasswordModalOpen(false)}>
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
