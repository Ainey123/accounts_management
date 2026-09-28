"use client";

import React, { useState, useEffect } from 'react';
import {
  Users, Activity, UserPlus, Trash2, X, UserCheck, ShieldAlert,
  Settings, Mail, FileText, RefreshCw, Filter, Search,
  DollarSign, Globe, Phone, MapPin, Save, Eye, Key,
  TrendingUp, TrendingDown, Check, ClipboardCopy,
  CheckCircle, AlertCircle, XCircle, MessageSquare, Clock, Send,
  Award, Calendar, Download, Printer, Edit3, BarChart3,
  FileSpreadsheet, Receipt, ArrowRight
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import ReconciliationModule from '@/components/ReconciliationModule';

export default function AdminCommandCenter() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [employeeMatrix, setEmployeeMatrix] = useState([]);
  const [financials, setFinancials] = useState(null);
  const [reconStats, setReconStats] = useState(null);
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

  // User Comments State
  const [selectedUserForComments, setSelectedUserForComments] = useState(null);
  const [userComments, setUserComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [adminPostingName, setAdminPostingName] = useState('Fatma');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const loadUserComments = async (userId) => {
    if (!userId) {
      setUserComments([]);
      return;
    }
    setLoadingComments(true);
    try {
      const res = await apiFetch(`/api/comments?userId=${userId}`);
      setUserComments(res.comments || []);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'comments' && selectedUserForComments) {
      loadUserComments(selectedUserForComments);
    }
  }, [activeTab, selectedUserForComments]);

  useEffect(() => {
    if (activeTab === 'comments' && !selectedUserForComments && users.length > 0) {
      setSelectedUserForComments(users[0].id);
    }
  }, [activeTab, users, selectedUserForComments]);

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!selectedUserForComments || !newCommentText.trim()) return;
    setSubmittingComment(true);
    try {
      await apiFetch('/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedUserForComments,
          content: newCommentText.trim(),
          adminName: adminPostingName.trim() || 'Fatma',
        }),
      });
      setNewCommentText('');
      await loadUserComments(selectedUserForComments);
      setMessage('Comment posted successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // ── Employee Monthly Progress & PDF Audit State ──────────────────────────
  const DEFAULT_ALIASES = {
    'Rizwan Hussain': 'Ali Shehzad (Batch 1)',
    'Ali Shezad': 'Ali Shehzad (Batch 1)',
    'Ali Shehzad': 'Ali Shehzad (Batch 1)',
    'Ibrahim': 'Muhammad Ibrahim (Batch 2)',
    'Muhammad Ibrahim': 'Muhammad Ibrahim (Batch 2)',
    'Shahzaib': 'Shah Zaib (Batch 3)',
    'Shah Zaib': 'Shah Zaib (Batch 3)',
    'Sermad Islam': 'Sarmad Islam (Batch 4)',
    'Sarmad Islam': 'Sarmad Islam (Batch 4)',
  };

  const [progressTenureMode, setProgressTenureMode] = useState('month');
  const [progressMonth, setProgressMonth] = useState('2026-08');
  const [progressFromDate, setProgressFromDate] = useState('2026-08-01');
  const [progressToDate, setProgressToDate] = useState('2026-08-31');
  const [progressTickets, setProgressTickets] = useState([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressSearch, setProgressSearch] = useState('');
  const [progressSelectedBatch, setProgressSelectedBatch] = useState('all');
  const [progressExcludeIrrelevant, setProgressExcludeIrrelevant] = useState(true);
  const [employeeAliases, setEmployeeAliases] = useState(DEFAULT_ALIASES);
  const [aliasModalOpen, setAliasModalOpen] = useState(false);
  const [editingAliases, setEditingAliases] = useState({ ...DEFAULT_ALIASES });
  const [newAliasKey, setNewAliasKey] = useState('');
  const [newAliasVal, setNewAliasVal] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('nexus_employee_aliases');
        if (saved) {
          const parsed = JSON.parse(saved);
          setEmployeeAliases((prev) => ({ ...prev, ...parsed }));
          setEditingAliases((prev) => ({ ...prev, ...parsed }));
        }
      } catch (e) {}
    }
  }, []);

  const loadProgressData = async () => {
    setProgressLoading(true);
    try {
      let url = '/api/admin/employee-progress';
      if (progressTenureMode === 'month') {
        url += `?month=${encodeURIComponent(progressMonth)}`;
      } else {
        url += `?from=${encodeURIComponent(progressFromDate)}&to=${encodeURIComponent(progressToDate)}`;
      }
      const res = await apiFetch(url);
      setProgressTickets(res.tickets || []);
    } catch (err) {
      console.error('Error loading progress data:', err);
    } finally {
      setProgressLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'progress') {
      loadProgressData();
    }
  }, [activeTab, progressTenureMode, progressMonth, progressFromDate, progressToDate]);

  const getMappedBatch = (rawName) => {
    if (!rawName) return 'Unassigned / Auto-Ingested';
    if (employeeAliases[rawName]) return employeeAliases[rawName];
    const lower = rawName.toLowerCase().trim();
    for (const [key, val] of Object.entries(employeeAliases)) {
      if (key.toLowerCase().trim() === lower) return val;
      if (lower.includes('rizwan') && key.toLowerCase().includes('rizwan')) return val;
      if (lower.includes('ibrahim') && key.toLowerCase().includes('ibrahim')) return val;
      if ((lower.includes('shahzaib') || lower.includes('shah zaib')) && (key.toLowerCase().includes('shahzaib') || key.toLowerCase().includes('shah zaib'))) return val;
      if ((lower.includes('sermad') || lower.includes('sarmad')) && (key.toLowerCase().includes('sermad') || key.toLowerCase().includes('sarmad'))) return val;
    }
    return rawName;
  };

  const handleSaveAliases = () => {
    setEmployeeAliases({ ...editingAliases });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nexus_employee_aliases', JSON.stringify(editingAliases));
      } catch (e) {}
    }
    setAliasModalOpen(false);
    setMessage('Employee names & batches updated successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleResetAliases = () => {
    setEditingAliases({ ...DEFAULT_ALIASES });
    setEmployeeAliases({ ...DEFAULT_ALIASES });
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('nexus_employee_aliases');
      } catch (e) {}
    }
    setAliasModalOpen(false);
    setMessage('Employee aliases reset to defaults.');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleOpenPdfReport = (batchTarget = null) => {
    let reportUrl = '/api/admin/employee-progress/report';
    const params = new URLSearchParams();
    if (progressTenureMode === 'month') {
      params.set('month', progressMonth);
    } else {
      params.set('from', progressFromDate);
      params.set('to', progressToDate);
    }
    const targetBatch = batchTarget !== null ? batchTarget : progressSelectedBatch;
    if (targetBatch && targetBatch !== 'all') {
      params.set('batch', targetBatch);
    }
    params.set('excludeIrrelevant', progressExcludeIrrelevant ? 'true' : 'false');
    params.set('aliases', JSON.stringify(employeeAliases));
    window.open(`${reportUrl}?${params.toString()}`, '_blank');
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      await loadUserComments(selectedUserForComments);
    } catch (err) {
      alert(err.message || 'Failed to delete comment');
    }
  };

  const loadAll = async () => {
    try {
      const [userRes, statsRes, finRes] = await Promise.all([
        apiFetch('/api/users').catch(() => ({ users: [] })),
        apiFetch('/api/admin/stats').catch(() => ({ stats: null, employeeMatrix: [] })),
        apiFetch('/api/admin/financials').catch(() => ({ financials: null })),
      ]);
      setUsers(userRes.users || []);
      setStats(statsRes.stats);
      setEmployeeMatrix(statsRes.employeeMatrix || []);
      setFinancials(finRes.financials);

      const [ticketsRes, gmailRes, settingsRes, reconRes] = await Promise.all([
        apiFetch('/api/tickets').catch(() => ({ tickets: [] })),
        apiFetch('/api/gmail-account').catch(() => ({ accounts: [] })),
        apiFetch('/api/admin/settings').catch(() => ({ settings: null })),
        apiFetch('/api/admin/reconciliation/stats').catch(() => ({ stats: null })),
      ]);
      setTickets(ticketsRes.tickets || []);
      setGmailAccounts(gmailRes.accounts || []);
      if (settingsRes?.settings) setSettings(settingsRes.settings);
      if (reconRes?.stats) setReconStats(reconRes.stats);
    } catch (err) {
      console.error('Failed loading admin dashboard data:', err);
    }
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

  const handleConnectGmail = async () => {
    setMessage('Redirecting to Google for authentication...');
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { authUrl } = await apiFetch(`/api/gmail-oauth?origin=${encodeURIComponent(origin)}`);
      window.location.href = authUrl;
    } catch (err) {
      setMessage('Failed to start OAuth: ' + err.message);
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
        method: 'POST',
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

  const handleDeleteTicket = async (ticketId, serialNo) => {
    if (!confirm(`Delete ticket ${serialNo} and all its linked job data? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/admin/tickets?id=${ticketId}`, { method: 'DELETE' });
      setMessage(`Ticket ${serialNo} deleted.`);
      await loadAll();
    } catch (err) {
      setMessage('Delete failed: ' + err.message);
    }
  };

  const getTicketEntryPerson = (ticket) =>
    ticket.statusLastChangedBy ||
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

  // ── Employee Progress Batch Calculations ─────────────────────────────────
  const visibleProgressTickets = React.useMemo(() => {
    if (!progressTickets) return [];
    if (!progressExcludeIrrelevant) return progressTickets;
    return progressTickets.filter((t) => t.status !== 'IRRELEVANT');
  }, [progressTickets, progressExcludeIrrelevant]);

  const progressBatches = React.useMemo(() => {
    const batches = {};
    (visibleProgressTickets || []).forEach((t) => {
      const bName = getMappedBatch(t.entryPerson);
      if (!batches[bName]) {
        batches[bName] = [];
      }
      batches[bName].push(t);
    });
    return batches;
  }, [visibleProgressTickets, employeeAliases]);

  const sortedProgressBatchNames = React.useMemo(() => {
    return Object.keys(progressBatches).sort((a, b) => {
      if (a.includes('Batch 1')) return -1;
      if (b.includes('Batch 1')) return 1;
      if (a.includes('Batch 2')) return -1;
      if (b.includes('Batch 2')) return 1;
      if (a.includes('Batch 3')) return -1;
      if (b.includes('Batch 3')) return 1;
      if (a.includes('Batch 4')) return -1;
      if (b.includes('Batch 4')) return 1;
      if (a.includes('Unassigned')) return 1;
      if (b.includes('Unassigned')) return -1;
      return a.localeCompare(b);
    });
  }, [progressBatches]);

  const filteredProgressTickets = React.useMemo(() => {
    return (visibleProgressTickets || []).filter((t) => {
      const bName = getMappedBatch(t.entryPerson);
      if (progressSelectedBatch !== 'all' && bName !== progressSelectedBatch) {
        return false;
      }
      if (!progressSearch) return true;
      const q = progressSearch.toLowerCase();
      return (
        t.subject?.toLowerCase().includes(q) ||
        t.sender?.toLowerCase().includes(q) ||
        t.serialNo?.toLowerCase().includes(q) ||
        bName.toLowerCase().includes(q) ||
        (t.entryPerson || '').toLowerCase().includes(q) ||
        t.jobMetadata?.clientName?.toLowerCase().includes(q) ||
        t.jobMetadata?.branchName?.toLowerCase().includes(q)
      );
    });
  }, [visibleProgressTickets, progressSelectedBatch, progressSearch, employeeAliases]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'reconciliation', label: 'Expense Reconciliation', icon: FileSpreadsheet },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'progress', label: 'Monthly Progress & PDF', icon: Award },
    { id: 'comments', label: 'Comments', icon: MessageSquare },
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
             {/* EMPLOYEE EXPENSES & RECONCILIATION DASHBOARD CARD */}
             <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                   <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0, 242, 254, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <Receipt size={18} color="#00f2fe" />
                   </div>
                   <div>
                     <h3 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: '#f8fafc' }}>Employee Expenses &amp; Bank Reconciliation</h3>
                     <span style={{ fontSize: 11, color: '#94a3b8' }}>Live verification state of site claims &amp; company expenses against bank debits</span>
                   </div>
                 </div>
                 <button
                   type="button"
                   className="btn btn-secondary"
                   onClick={() => setActiveTab('reconciliation')}
                   style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px', borderColor: 'rgba(0,242,254,0.4)', color: '#00f2fe' }}
                 >
                   <span>Open Reconciliation Studio</span>
                   <ArrowRight size={14} />
                 </button>
               </div>

                <div className="financial-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
                  <div className="financial-tile" style={{ borderLeft: '3px solid #3b82f6', background: 'rgba(59,130,246,0.03)' }}>
                    <span className="field-label" style={{ color: '#94a3b8' }}>Total Claimed Expenses</span>
                    <div className="financial-value" style={{ color: '#3b82f6', fontSize: 20 }}>
                      Rs. {(reconStats?.totalClaimed || financials?.totalExpenses || 0).toLocaleString()}
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 'normal', marginTop: 4 }}>
                        ({reconStats?.claimedCount || 0} Total Records)
                      </div>
                    </div>
                  </div>

                  <div className="financial-tile" style={{ borderLeft: '3px solid #c4b5fd', background: 'rgba(167,139,250,0.03)' }}>
                    <span className="field-label" style={{ color: '#c4b5fd' }}>📝 Manually Attached</span>
                    <div className="financial-value" style={{ color: '#c4b5fd', fontSize: 20 }}>
                      Rs. {(reconStats?.totalClaimed ? (reconStats.totalClaimed - (reconStats.otherExpensesSum || 0)) : (financials?.totalExpenses || 0)).toLocaleString()}
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 'normal', marginTop: 4 }}>
                        Manual Bill Vouchers
                      </div>
                    </div>
                  </div>

                  <div className="financial-tile" style={{ borderLeft: '3px solid #38bdf8', background: 'rgba(56,189,248,0.03)' }}>
                    <span className="field-label" style={{ color: '#38bdf8' }}>🏦 Bank Receipts</span>
                    <div className="financial-value" style={{ color: '#38bdf8', fontSize: 20 }}>
                      Attached Proofs
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 'normal', marginTop: 4 }}>
                        Deposit Slips & TRX IDs
                      </div>
                    </div>
                  </div>

                  <div className="financial-tile" style={{ borderLeft: '3px solid #4ade80', background: 'rgba(34,197,94,0.03)' }}>
                    <span className="field-label" style={{ color: '#4ade80' }}>📁 Attached Bills</span>
                    <div className="financial-value" style={{ color: '#4ade80', fontSize: 20 }}>
                      Uploaded Bills
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 'normal', marginTop: 4 }}>
                        Camera & Doc Proofs
                      </div>
                    </div>
                  </div>

                  <div className="financial-tile" style={{ borderLeft: '3px solid #22c55e', background: 'rgba(34,197,94,0.03)' }}>
                    <span className="field-label" style={{ color: '#22c55e' }}>Amount Adjusted</span>
                    <div className="financial-value" style={{ color: '#22c55e', fontSize: 20 }}>
                      Rs. {(reconStats?.totalAdjusted || 0).toLocaleString()}
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 'normal', marginTop: 4 }}>
                        {reconStats?.totalClaimed ? Math.round(((reconStats.totalAdjusted || 0) / reconStats.totalClaimed) * 100) : 0}% Reconciled vs Bank
                      </div>
                    </div>
                  </div>

                  <div className="financial-tile" style={{ borderLeft: '3px solid #ef4444', background: 'rgba(239,68,68,0.03)' }}>
                    <span className="field-label" style={{ color: '#ef4444' }}>Unmatched Amount</span>
                    <div className="financial-value" style={{ color: '#ef4444', fontSize: 20 }}>
                      Rs. {(reconStats?.totalUnmatched || 0).toLocaleString()}
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 'normal', marginTop: 4 }}>
                        {(reconStats?.statusCounts?.UNMATCHED || 0) + (reconStats?.statusCounts?.REVIEW_REQUIRED || 0)} Pending Verification
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          </section>
        </>
      )}

      {/* RECONCILIATION TAB */}
      {activeTab === 'reconciliation' && (
        <ReconciliationModule
          users={users}
          employeeAliases={employeeAliases}
          adminPostingName={adminPostingName || 'Fatma'}
          onNavigateToTab={setActiveTab}
        />
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
                        <button
                          type="button"
                          className="nexus-btn nexus-btn-ghost"
                          onClick={() => { setSelectedUserForComments(u.id); setActiveTab('comments'); }}
                          style={{ padding: 6, color: '#a78bfa' }}
                          title="Manage Comments for User"
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button
                          type="button"
                          className="nexus-btn nexus-btn-ghost"
                          onClick={() => { setPasswordUserId(u.id); setPasswordForm({ password: '', confirmPassword: '' }); setPasswordModalOpen(true); }}
                          style={{ padding: 6, color: '#f59e0b' }}
                          title={u.role === 'ADMIN' ? 'Change Admin Password' : 'Reset Password'}
                        >
                          <Key size={14} />
                        </button>
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

      {/* EMPLOYEE MONTHLY PROGRESS & PDF AUDIT TAB */}
      {activeTab === 'progress' && (
        <section className="glass-card">
          {/* Header & Main Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: 10, borderRadius: 10 }}>
                <Award size={22} color="#f59e0b" />
              </div>
              <div>
                <h2 style={{ fontSize: 18, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Monthly Employee Progress &amp; Audit Studio
                </h2>
                <p style={{ color: '#94a3b8', fontSize: 13, margin: '2px 0 0' }}>
                  Track monthly complaints workload, intake conversions, and generate PDF audit reports per employee.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={() => {
                  setEditingAliases({ ...employeeAliases });
                  setAliasModalOpen(true);
                }}
                style={{ color: '#00f2fe', borderColor: 'rgba(0, 242, 254, 0.3)' }}
              >
                <Edit3 size={15} /> Set Employee Names &amp; Batches
              </button>

              {progressSelectedBatch !== 'all' ? (
                <>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-primary"
                    onClick={() => handleOpenPdfReport(progressSelectedBatch)}
                    style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)' }}
                  >
                    <Download size={15} /> 📄 Download {progressSelectedBatch.split('(')[0].trim()} PDF
                  </button>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    onClick={() => handleOpenPdfReport('all')}
                    style={{ color: '#a78bfa', borderColor: 'rgba(167, 139, 250, 0.3)' }}
                  >
                    <Download size={15} /> 📚 All Batches PDF
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="nexus-btn nexus-btn-primary"
                  onClick={() => handleOpenPdfReport('all')}
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)' }}
                >
                  <Download size={15} /> 📄 Download / Print PDF Report
                </button>
              )}
            </div>
          </div>

          {/* Tenure, Batch & Irrelevant Filter Toolbar */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: 16, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.06)', borderRadius: 8, padding: 3 }}>
                  <button
                    type="button"
                    onClick={() => setProgressTenureMode('month')}
                    style={{
                      background: progressTenureMode === 'month' ? '#4f46e5' : 'transparent',
                      color: progressTenureMode === 'month' ? '#fff' : '#94a3b8',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    📅 Monthly Selection
                  </button>
                  <button
                    type="button"
                    onClick={() => setProgressTenureMode('custom')}
                    style={{
                      background: progressTenureMode === 'custom' ? '#4f46e5' : 'transparent',
                      color: progressTenureMode === 'custom' ? '#fff' : '#94a3b8',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    🗓️ Custom Date Range
                  </button>
                </div>

                {progressTenureMode === 'month' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Select Month:</label>
                    <input
                      type="month"
                      className="nexus-input"
                      value={progressMonth}
                      onChange={(e) => setProgressMonth(e.target.value)}
                      style={{ padding: '6px 12px', fontSize: 13, width: 160 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['2026-08', '2026-07', '2026-09'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className="nexus-btn nexus-btn-ghost"
                          onClick={() => setProgressMonth(m)}
                          style={{
                            padding: '4px 8px',
                            fontSize: 11,
                            background: progressMonth === m ? 'rgba(79, 70, 229, 0.2)' : 'transparent',
                            color: progressMonth === m ? '#a78bfa' : '#64748b',
                          }}
                        >
                          {m === '2026-08' ? 'August 2026' : m === '2026-07' ? 'July 2026' : 'Sept 2026'}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>From:</label>
                    <input
                      type="date"
                      className="nexus-input"
                      value={progressFromDate}
                      onChange={(e) => setProgressFromDate(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: 13, width: 150 }}
                    />
                    <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>To:</label>
                    <input
                      type="date"
                      className="nexus-input"
                      value={progressToDate}
                      onChange={(e) => setProgressToDate(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: 13, width: 150 }}
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={loadProgressData}
                disabled={progressLoading}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                <RefreshCw size={14} className={progressLoading ? 'animate-spin' : ''} />
                {progressLoading ? 'Loading...' : 'Refresh Data'}
              </button>
            </div>

            {/* Quick Filters Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Batch / Person:</label>
                  <select
                    value={progressSelectedBatch}
                    onChange={(e) => setProgressSelectedBatch(e.target.value)}
                    className="nexus-select"
                    style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#fff',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  >
                    <option value="all">All Batches ({visibleProgressTickets.length})</option>
                    {sortedProgressBatchNames.map((bName) => (
                      <option key={bName} value={bName}>
                        {bName} ({progressBatches[bName]?.length || 0})
                      </option>
                    ))}
                  </select>
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    background: progressExcludeIrrelevant ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: progressExcludeIrrelevant ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
                    userSelect: 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={progressExcludeIrrelevant}
                    onChange={(e) => setProgressExcludeIrrelevant(e.target.checked)}
                    style={{ accentColor: '#22c55e', cursor: 'pointer', width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: progressExcludeIrrelevant ? '#4ade80' : '#94a3b8' }}>
                    ✨ Exclude Irrelevant Complaints (Show Valid Workload Only)
                  </span>
                </label>
              </div>

              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Total Filtered Complaints: <strong style={{ color: '#00f2fe' }}>{visibleProgressTickets.length}</strong>
              </div>
            </div>
          </div>

          {/* Performance Summary Grid per Batch */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, color: '#f8fafc', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Employee Batches Performance &mdash; {progressExcludeIrrelevant ? `${visibleProgressTickets.length} Valid Complaints` : `${progressTickets.length} Total Complaints`}
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
              {sortedProgressBatchNames.map((bName) => {
                const list = progressBatches[bName] || [];
                const intakeCount = list.filter((t) => t.jobMetadata).length;
                const irrelevantCount = list.filter((t) => t.status === 'IRRELEVANT').length;
                const cancelledCount = list.filter((t) => t.status === 'CANCELLED').length;
                const pendingCount = list.filter((t) => !t.jobMetadata && t.status === 'PENDING').length;
                const intakeRate = list.length > 0 ? Math.round((intakeCount / list.length) * 100) : 0;

                const isBatch1 = bName.includes('Batch 1');
                const isBatch2 = bName.includes('Batch 2');
                const isBatch3 = bName.includes('Batch 3');
                const isBatch4 = bName.includes('Batch 4');

                const accentColor = isBatch1 ? '#38bdf8' : isBatch2 ? '#34d399' : isBatch3 ? '#c084fc' : isBatch4 ? '#fbbf24' : '#94a3b8';
                const isSelected = progressSelectedBatch === bName;

                return (
                  <div
                    key={bName}
                    className="glass-card"
                    style={{
                      padding: 16,
                      border: isSelected ? `2px solid ${accentColor}` : `1px solid ${accentColor}33`,
                      background: isSelected ? 'rgba(15, 23, 42, 0.85)' : 'rgba(15, 23, 42, 0.5)',
                      position: 'relative',
                      boxShadow: isSelected ? `0 0 16px ${accentColor}33` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>
                        {bName}
                      </div>
                      <button
                        type="button"
                        onClick={() => setProgressSelectedBatch(isSelected ? 'all' : bName)}
                        style={{
                          background: isSelected ? accentColor : 'transparent',
                          color: isSelected ? '#000' : accentColor,
                          border: `1px solid ${accentColor}66`,
                          borderRadius: 4,
                          padding: '2px 6px',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected ? '✓ Selected' : 'Filter'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{list.length}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>valid complaints</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#cbd5e1', marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#22c55e' }}>✓ Intake Done:</span>
                        <strong>{intakeCount}</strong>
                      </div>
                      {!progressExcludeIrrelevant && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#f59e0b' }}>⚠️ Irrelevant:</span>
                          <strong>{irrelevantCount}</strong>
                        </div>
                      )}
                      {cancelledCount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#ef4444' }}>✕ Cancelled:</span>
                          <strong>{cancelledCount}</strong>
                        </div>
                      )}
                      {pendingCount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94a3b8' }}>⏳ Pending:</span>
                          <strong>{pendingCount}</strong>
                        </div>
                      )}
                    </div>

                    <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${intakeRate}%`, height: '100%', background: accentColor, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, textAlign: 'right' }}>
                      {intakeRate}% Intake Rate
                    </div>

                    <button
                      type="button"
                      className="nexus-btn nexus-btn-ghost"
                      onClick={() => handleOpenPdfReport(bName)}
                      style={{
                        width: '100%',
                        marginTop: 10,
                        padding: '6px 8px',
                        fontSize: 11,
                        color: accentColor,
                        borderColor: `${accentColor}44`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      title={`Download PDF Report for ${bName}`}
                    >
                      <Download size={12} /> Download PDF
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Complaints Table & Filter Bar */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <select
                  value={progressSelectedBatch}
                  onChange={(e) => setProgressSelectedBatch(e.target.value)}
                  className="nexus-select"
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  <option value="all">All Batches ({progressTickets.length})</option>
                  {sortedProgressBatchNames.map((bName) => (
                    <option key={bName} value={bName}>
                      {bName} ({progressBatches[bName]?.length || 0})
                    </option>
                  ))}
                </select>

                <div style={{ position: 'relative', width: 280 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    className="nexus-input"
                    placeholder="Search complaints in tenure..."
                    value={progressSearch}
                    onChange={(e) => setProgressSearch(e.target.value)}
                    style={{ paddingLeft: 32, fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Showing <strong style={{ color: '#fff' }}>{filteredProgressTickets.length}</strong> of {progressTickets.length} complaints
              </div>
            </div>

            {progressLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                Loading complaints for selected tenure...
              </div>
            ) : filteredProgressTickets.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 12, border: '1px dashed rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                No complaints found for the selected tenure or filters.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>Serial #</th>
                      <th style={{ width: 110 }}>Date &amp; Time</th>
                      <th style={{ width: 180 }}>Employee / Batch</th>
                      <th style={{ width: 200 }}>Client &amp; Branch / Nature</th>
                      <th style={{ width: 180 }}>Sender</th>
                      <th>Subject / Description</th>
                      <th style={{ width: 110, textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProgressTickets.map((t) => {
                      const bName = getMappedBatch(t.entryPerson);
                      const isBatch1 = bName.includes('Batch 1');
                      const isBatch2 = bName.includes('Batch 2');
                      const isBatch3 = bName.includes('Batch 3');
                      const isBatch4 = bName.includes('Batch 4');
                      const accentColor = isBatch1 ? '#38bdf8' : isBatch2 ? '#34d399' : isBatch3 ? '#c084fc' : isBatch4 ? '#fbbf24' : '#94a3b8';

                      return (
                        <tr key={t.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#00f2fe' }}>
                            {t.serialNo || t.id}
                          </td>
                          <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                            <div>{new Date(t.exactDate).toLocaleDateString()}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{t.time}</div>
                          </td>
                          <td>
                            <span style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>
                              {bName}
                            </span>
                            {t.entryPerson && t.entryPerson !== bName && (
                              <div style={{ fontSize: 10, color: '#64748b' }}>({t.entryPerson})</div>
                            )}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {t.jobMetadata ? (
                              <>
                                <div style={{ fontWeight: 600, color: '#f8fafc' }}>{t.jobMetadata.clientName}</div>
                                <div style={{ color: '#94a3b8', fontSize: 11 }}>{t.jobMetadata.branchName}</div>
                                {t.jobMetadata.workNature && (
                                  <span style={{ fontSize: 10, color: '#38bdf8', fontWeight: 600 }}>{t.jobMetadata.workNature}</span>
                                )}
                              </>
                            ) : (
                              <span style={{ color: '#64748b' }}>—</span>
                            )}
                          </td>
                          <td style={{ fontSize: 11, color: '#94a3b8', maxWidth: 180, wordBreak: 'break-word' }}>
                            {t.sender}
                          </td>
                          <td style={{ fontSize: 13, color: '#f8fafc' }}>
                            <div style={{ fontWeight: 500 }}>{t.subject}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {t.jobMetadata ? (
                              <span className="status-pill active" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                                Intake Done
                              </span>
                            ) : t.status === 'RELEVANT' ? (
                              <span className="status-pill active" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                                Relevant
                              </span>
                            ) : t.status === 'IRRELEVANT' ? (
                              <span className="status-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                                Irrelevant
                              </span>
                            ) : t.status === 'CANCELLED' ? (
                              <span className="status-pill" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                                Cancelled
                              </span>
                            ) : (
                              <span className="status-pill" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>
                                Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* COMMENTS TAB */}
      {activeTab === 'comments' && (
        <section className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <MessageSquare size={20} color="#a78bfa" />
              <h2 style={{ fontSize: 18, margin: 0 }}>Dedicated User Comments & Messages</h2>
            </div>

            {/* User Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Select Target User:</label>
              <select
                value={selectedUserForComments || ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSelectedUserForComments(val);
                }}
                className="nexus-select"
                style={{ background: 'rgba(15, 23, 42, 0.8)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '8px 14px', borderRadius: 8, fontSize: 13, minWidth: 220 }}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id} style={{ background: '#0f172a' }}>
                    {u.employeeName} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedUserForComments ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
              {/* Left Column: Chronological Comment History */}
              <div>
                <h3 style={{ fontSize: 15, color: '#00f2fe', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquare size={16} />
                  Comment Thread for {users.find((u) => u.id === selectedUserForComments)?.employeeName || 'User'}
                </h3>

                {loadingComments ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading comments...</div>
                ) : userComments.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 12, border: '1px dashed rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                    No comments left for this user yet. Use the form on the right to post a comment or message!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '520px', overflowY: 'auto', paddingRight: 6 }}>
                    {userComments.map((c) => {
                      const isEmployee = c.senderRole === 'EMPLOYEE';
                      return (
                        <div
                          key={c.id}
                          style={{
                            background: isEmployee ? 'rgba(16, 185, 129, 0.08)' : 'rgba(30, 41, 59, 0.6)',
                            borderRadius: 12,
                            padding: '16px 20px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderLeft: isEmployee ? '4px solid #10b981' : '4px solid #a78bfa',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Clock size={13} />
                              {new Date(c.createdAt).toLocaleString('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                              {isEmployee && (
                                <span className="status-pill active" style={{ fontSize: 10, background: 'rgba(16,185,129,0.2)', color: '#34d399', padding: '2px 8px' }}>
                                  User Reply
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(c.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                              title="Delete comment"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <p style={{ fontSize: 14, color: '#f1f5f9', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>
                            {c.content}
                          </p>
                          <div style={{ textAlign: 'right', marginTop: 10, fontSize: 13, fontWeight: 700, color: isEmployee ? '#34d399' : '#c084fc' }}>
                            By {c.senderName || c.adminName || (isEmployee ? 'Employee' : 'Fatma')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Post Admin Comment Form */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: 20, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)', height: 'fit-content' }}>
                <h3 style={{ fontSize: 15, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Send size={16} color="#00f2fe" /> Leave Comment / Message
                </h3>
                <form onSubmit={handlePostComment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                      Admin Name (Defaults to Fatma):
                    </label>
                    <input
                      type="text"
                      className="nexus-input"
                      placeholder="Fatma (or type custom name like Anie)"
                      value={adminPostingName}
                      onChange={(e) => setAdminPostingName(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: 13 }}
                    />
                    <small style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                      Pre-filled with Fatma. Edit if another admin (e.g. Anie) is posting.
                    </small>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                      Comment Message:
                    </label>
                    <textarea
                      rows={5}
                      className="nexus-input"
                      placeholder="Type comment or message for this specific user..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      required
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, resize: 'vertical' }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="nexus-btn nexus-btn-primary"
                    disabled={submittingComment || !newCommentText.trim()}
                    style={{ width: '100%', justifyContent: 'center', gap: 8, padding: '10px 16px' }}
                  >
                    <Send size={16} />
                    {submittingComment ? 'Posting...' : 'Post Comment'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
              Please select a user to view or post comments.
            </div>
          )}
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
                      <th>Action</th>
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
                      <td>
                        <button
                          type="button"
                          className="nexus-btn nexus-btn-ghost"
                          onClick={() => handleDeleteTicket(t.id, t.serialNo)}
                          style={{ color: '#ef4444', padding: 4 }}
                          title="Delete ticket"
                        >
                          <Trash2 size={14} />
                        </button>
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
              <button type="button" className="nexus-btn nexus-btn-ghost" onClick={handleConnectGmail} style={{ color: '#00f2fe' }}>
                <Mail size={16} /> + Connect / Reconnect Gmail
              </button>
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
              No Gmail accounts connected. Click &quot;+ Connect / Reconnect Gmail&quot; to connect one.
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
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="nexus-btn nexus-btn-ghost"
                          onClick={handleConnectGmail}
                          style={{ color: '#00f2fe', padding: '4px 8px', fontSize: 12 }}
                          title="Re-authenticate if password changed"
                        >
                          <RefreshCw size={13} /> Reconnect
                        </button>
                        <button
                          type="button"
                          className="nexus-btn nexus-btn-ghost"
                          onClick={() => handleDisconnectGmail(acc.id)}
                          style={{ color: '#ef4444', padding: '4px 8px', fontSize: 12 }}
                        >
                          <Trash2 size={13} /> Disconnect
                        </button>
                      </div>
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
                className="nexus-btn nexus-btn-primary"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', fontWeight: 700, padding: '10px 20px' }}
                onClick={() => {
                  const admin = users.find(u => u.email === currentEmail) || users.find(u => u.role === 'ADMIN');
                  if (admin) {
                    setPasswordUserId(admin.id);
                    setPasswordForm({ password: '', confirmPassword: '' });
                    setPasswordModalOpen(true);
                  } else {
                    setMessage('Could not find admin account. Please try from the Employees tab.');
                  }
                }}
              >
                <Key size={16} /> 🔐 Change My Password
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

      {/* EMPLOYEE NAMES & BATCHES CUSTOMIZER MODAL */}
      {aliasModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', padding: 16 }} onClick={() => setAliasModalOpen(false)}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: 'rgba(0, 242, 254, 0.15)', padding: 8, borderRadius: 8 }}>
                  <Edit3 size={20} color="#00f2fe" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#fff' }}>Employee Names &amp; Batch Settings</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Map raw employee names to custom display names &amp; batches</p>
                </div>
              </div>
              <button type="button" className="nexus-btn nexus-btn-ghost" onClick={() => setAliasModalOpen(false)} style={{ padding: 6 }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ overflowY: 'auto', padding: '16px 0', flex: 1 }}>
              <div style={{ background: 'rgba(79, 70, 229, 0.12)', border: '1px solid rgba(79, 70, 229, 0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                💡 <strong>Admin Note:</strong> These custom names and batch assignments will be used throughout the Monthly Progress dashboard and included directly in generated PDF reports (e.g. <em>Rizwan Hussain</em> &rarr; <em>Ali Shehzad (Batch 1)</em>).
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(editingAliases).map(([rawKey, mappedVal]) => (
                  <div key={rawKey} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 36px', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Original Name</span>
                      <input
                        type="text"
                        className="nexus-input"
                        value={rawKey}
                        disabled
                        style={{ fontSize: 12, padding: '6px 10px', background: 'rgba(0,0,0,0.3)', color: '#94a3b8' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: '#00f2fe', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Custom Display / Batch</span>
                      <input
                        type="text"
                        className="nexus-input"
                        value={mappedVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingAliases((prev) => ({ ...prev, [rawKey]: val }));
                        }}
                        style={{ fontSize: 12, padding: '6px 10px', color: '#fff', borderColor: 'rgba(0,242,254,0.3)' }}
                        placeholder="e.g. Ali Shehzad (Batch 1)"
                      />
                    </div>
                    <div style={{ paddingTop: 14 }}>
                      <button
                        type="button"
                        className="nexus-btn nexus-btn-ghost"
                        onClick={() => {
                          const next = { ...editingAliases };
                          delete next[rawKey];
                          setEditingAliases(next);
                        }}
                        style={{ padding: 6, color: '#ef4444' }}
                        title="Remove mapping"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Mapping Row */}
              <div style={{ marginTop: 16, padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 8 }}>+ Add Custom Name / Alias Mapping</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="nexus-input"
                    placeholder="System name (e.g. John)"
                    value={newAliasKey}
                    onChange={(e) => setNewAliasKey(e.target.value)}
                    style={{ fontSize: 12, padding: '6px 10px' }}
                  />
                  <input
                    type="text"
                    className="nexus-input"
                    placeholder="Display name (e.g. John Doe (Batch 5))"
                    value={newAliasVal}
                    onChange={(e) => setNewAliasVal(e.target.value)}
                    style={{ fontSize: 12, padding: '6px 10px' }}
                  />
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    onClick={() => {
                      if (!newAliasKey.trim() || !newAliasVal.trim()) return;
                      setEditingAliases((prev) => ({ ...prev, [newAliasKey.trim()]: newAliasVal.trim() }));
                      setNewAliasKey('');
                      setNewAliasVal('');
                    }}
                    style={{ color: '#00f2fe', borderColor: 'rgba(0,242,254,0.3)', fontSize: 12, padding: '6px 12px' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={handleResetAliases}
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', fontSize: 12 }}
              >
                Reset to Defaults
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="nexus-btn nexus-btn-ghost"
                  onClick={() => setAliasModalOpen(false)}
                  style={{ fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="nexus-btn nexus-btn-primary"
                  onClick={handleSaveAliases}
                  style={{ fontSize: 13 }}
                >
                  <Save size={15} /> Save &amp; Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
