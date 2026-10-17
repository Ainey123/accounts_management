"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Award, Calendar, Download, RefreshCw, Search, Filter,
  Check, CheckCircle2, AlertCircle, AlertTriangle, Clock,
  DollarSign, Send, Share2, MessageSquare, Phone, User, Users,
  FileText, Edit3, ExternalLink, Copy, X, ChevronDown, ChevronUp,
  Receipt, Hammer, Landmark, Briefcase, Eye, Sparkles
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

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

export default function PersonProgressSummary({ onNavigateTab }) {
  // ── Tenure & Filter States ────────────────────────────────────────────────
  const [tenureMode, setTenureMode] = useState('month'); // 'month' or 'custom'
  const [selectedMonth, setSelectedMonth] = useState('2026-08');
  const [fromDate, setFromDate] = useState('2026-08-01');
  const [toDate, setToDate] = useState('2026-08-31');
  const [excludeIrrelevant, setExcludeIrrelevant] = useState(true);
  const [dateField, setDateField] = useState('exactDate'); // 'exactDate' or 'createdAt'

  // ── Data States ───────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [overallStats, setOverallStats] = useState(null);
  const [personsSummary, setPersonsSummary] = useState([]);
  const [rawTickets, setRawTickets] = useState([]);
  const [tenureLabel, setTenureLabel] = useState('');

  // ── Selection & Filter States ─────────────────────────────────────────────
  const [selectedPerson, setSelectedPerson] = useState('all');
  const [pendingFilter, setPendingFilter] = useState('all'); // 'all', 'hasPending', 'intake', 'survey', 'quotation', 'bankApproval', 'workCompletion', 'invoice', 'payment', 'cleared'
  const [searchQuery, setSearchQuery] = useState('');

  // ── WhatsApp Modal State ──────────────────────────────────────────────────
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [targetPersonForWhatsapp, setTargetPersonForWhatsapp] = useState(null);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // ── Employee Phone Numbers in localStorage ────────────────────────────────
  const [phoneDirectory, setPhoneDirectory] = useState({});

  // ── Aliases Configuration Modal ───────────────────────────────────────────
  const [employeeAliases, setEmployeeAliases] = useState(DEFAULT_ALIASES);
  const [aliasModalOpen, setAliasModalOpen] = useState(false);
  const [editingAliases, setEditingAliases] = useState({ ...DEFAULT_ALIASES });
  const [newAliasKey, setNewAliasKey] = useState('');
  const [newAliasVal, setNewAliasVal] = useState('');

  // ── Initialize Saved Aliases & Phone Directory ────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedAliases = localStorage.getItem('nexus_employee_aliases');
        if (savedAliases) {
          const parsed = JSON.parse(savedAliases);
          setEmployeeAliases((prev) => ({ ...prev, ...parsed }));
          setEditingAliases((prev) => ({ ...prev, ...parsed }));
        }
        const savedPhones = localStorage.getItem('nexus_employee_phones');
        if (savedPhones) {
          setPhoneDirectory(JSON.parse(savedPhones));
        }
      } catch (e) {
        console.error('Error loading localStorage settings:', e);
      }
    }
  }, []);

  // Show Toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // ── Fetch Progress & Pending Summary ──────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let url = '/api/admin/employee-progress';
      const params = new URLSearchParams();

      if (tenureMode === 'month') {
        params.set('month', selectedMonth);
      } else {
        params.set('from', fromDate);
        params.set('to', toDate);
      }

      params.set('excludeIrrelevant', excludeIrrelevant ? 'true' : 'false');
      params.set('dateField', dateField);
      params.set('aliases', JSON.stringify(employeeAliases));

      const res = await apiFetch(`${url}?${params.toString()}`);
      if (res.error) throw new Error(res.error);

      setOverallStats(res.overallStats || null);
      setPersonsSummary(res.personsSummary || []);
      setRawTickets(res.tickets || []);
      setTenureLabel(res.tenureLabel || 'Selected Tenure');
    } catch (err) {
      console.error('Failed to load employee progress summary:', err);
      setError(err.message || 'Failed to fetch progress summary');
    } finally {
      setLoading(false);
    }
  }, [tenureMode, selectedMonth, fromDate, toDate, excludeIrrelevant, dateField, employeeAliases]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Save Phone Number for Person ──────────────────────────────────────────
  const handleSavePhone = (personName, phone) => {
    const updated = { ...phoneDirectory, [personName]: phone };
    setPhoneDirectory(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nexus_employee_phones', JSON.stringify(updated));
      } catch {}
    }
  };

  // ── Format Clean WhatsApp Phone Number ────────────────────────────────────
  const cleanPhoneForWhatsApp = (rawPhone) => {
    if (!rawPhone) return '';
    let cleaned = rawPhone.replace(/[^\d]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '92' + cleaned.slice(1);
    }
    return cleaned;
  };

  // ── WhatsApp Actions ──────────────────────────────────────────────────────
  const openWhatsAppModal = (personObj) => {
    setTargetPersonForWhatsapp(personObj);
    const existingPhone = phoneDirectory[personObj.personName] || phoneDirectory[personObj.batchName] || '';
    setRecipientPhone(existingPhone);
    setCustomNote('');
    setWhatsappModalOpen(true);
  };

  const constructFullWhatsAppMessage = (personObj, note) => {
    if (!personObj) return '';
    let msg = personObj.whatsappMessage || '';
    if (note && note.trim()) {
      msg += `\n💬 *Admin Special Note:*\n${note.trim()}\n`;
    }
    return msg;
  };

  const handleSendWhatsApp = () => {
    if (!targetPersonForWhatsapp) return;
    const cleanPhone = cleanPhoneForWhatsApp(recipientPhone);
    if (recipientPhone.trim()) {
      handleSavePhone(targetPersonForWhatsapp.personName, recipientPhone.trim());
    }

    const message = constructFullWhatsAppMessage(targetPersonForWhatsapp, customNote);
    let waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    if (cleanPhone) {
      waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    }

    window.open(waUrl, '_blank');
    setWhatsappModalOpen(false);
    showToast(`WhatsApp opened for ${targetPersonForWhatsapp.personName}!`);
  };

  const handleCopyWhatsAppText = async (personObj, note = '') => {
    const message = constructFullWhatsAppMessage(personObj, note);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(message);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = message;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      showToast(`📋 Copied WhatsApp progress report for ${personObj.personName}!`);
    } catch (err) {
      alert('Failed to copy to clipboard: ' + err.message);
    }
  };

  // ── Save / Reset Aliases ──────────────────────────────────────────────────
  const handleSaveAliases = () => {
    setEmployeeAliases({ ...editingAliases });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nexus_employee_aliases', JSON.stringify(editingAliases));
      } catch {}
    }
    setAliasModalOpen(false);
    showToast('Employee name mapping saved successfully!');
    loadData();
  };

  const handleResetAliases = () => {
    setEditingAliases({ ...DEFAULT_ALIASES });
    setEmployeeAliases({ ...DEFAULT_ALIASES });
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('nexus_employee_aliases');
      } catch {}
    }
    setAliasModalOpen(false);
    showToast('Employee aliases reset to defaults.');
    loadData();
  };

  // ── Open PDF Report ───────────────────────────────────────────────────────
  const handleOpenPdfReport = (batchTarget = 'all') => {
    let reportUrl = '/api/admin/employee-progress/report';
    const params = new URLSearchParams();
    if (tenureMode === 'month') {
      params.set('month', selectedMonth);
    } else {
      params.set('from', fromDate);
      params.set('to', toDate);
    }
    if (batchTarget && batchTarget !== 'all') {
      params.set('batch', batchTarget);
    }
    params.set('excludeIrrelevant', excludeIrrelevant ? 'true' : 'false');
    params.set('aliases', JSON.stringify(employeeAliases));
    window.open(`${reportUrl}?${params.toString()}`, '_blank');
  };

  // ── Filtered Complaints List for Table ────────────────────────────────────
  const filteredComplaints = useMemo(() => {
    let list = rawTickets;

    // Filter by excludeIrrelevant
    if (excludeIrrelevant) {
      list = list.filter((t) => t.status !== 'IRRELEVANT');
    }

    // Filter by Person / Batch
    if (selectedPerson !== 'all') {
      list = list.filter((t) => t.batchName === selectedPerson || t.entryPerson === selectedPerson);
    }

    // Filter by Pending Type
    if (pendingFilter === 'hasPending') {
      list = list.filter((t) => t.pendingSummary?.hasPending);
    } else if (pendingFilter === 'intake') {
      list = list.filter((t) => t.intakePending);
    } else if (pendingFilter === 'survey') {
      list = list.filter((t) => t.surveyPending);
    } else if (pendingFilter === 'quotation') {
      list = list.filter((t) => t.quotationPending);
    } else if (pendingFilter === 'bankApproval') {
      list = list.filter((t) => t.bankApprovalPending);
    } else if (pendingFilter === 'workCompletion') {
      list = list.filter((t) => t.workCompletionPending);
    } else if (pendingFilter === 'invoice') {
      list = list.filter((t) => t.invoicePending && t.jobIntakeDone);
    } else if (pendingFilter === 'payment') {
      list = list.filter((t) => t.paymentPending);
    } else if (pendingFilter === 'cleared') {
      list = list.filter((t) => !t.pendingSummary?.hasPending);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((t) => {
        return (
          t.serialNo?.toLowerCase().includes(q) ||
          t.subject?.toLowerCase().includes(q) ||
          t.sender?.toLowerCase().includes(q) ||
          t.batchName?.toLowerCase().includes(q) ||
          t.entryPerson?.toLowerCase().includes(q) ||
          t.jobMetadata?.clientName?.toLowerCase().includes(q) ||
          t.jobMetadata?.branchName?.toLowerCase().includes(q) ||
          t.jobMetadata?.workNature?.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [rawTickets, excludeIrrelevant, selectedPerson, pendingFilter, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 10,
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Studio Header */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          borderLeft: '4px solid #10b981',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              padding: 12,
              borderRadius: 12,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
            }}
          >
            <Award size={26} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 20, margin: 0, fontWeight: 800, color: '#f8fafc' }}>
                Staff Progress Summary &amp; WhatsApp Dispatch Studio
              </h2>
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                LIVE TENURE SYNC
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>
              Track intakes, payments received vs pending, and every pending task per complaint &mdash; then dispatch direct to WhatsApp in 1-click.
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

          <button
            type="button"
            className="nexus-btn nexus-btn-ghost"
            onClick={() => handleOpenPdfReport(selectedPerson !== 'all' ? selectedPerson : 'all')}
            style={{ color: '#a78bfa', borderColor: 'rgba(167, 139, 250, 0.3)' }}
          >
            <Download size={15} /> 📄 Download PDF Audit Report
          </button>
        </div>
      </div>

      {/* ── Tenure & Filtering Command Bar ───────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          {/* Left: Mode Picker & Inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.06)', borderRadius: 8, padding: 3 }}>
              <button
                type="button"
                onClick={() => setTenureMode('month')}
                style={{
                  background: tenureMode === 'month' ? '#10b981' : 'transparent',
                  color: tenureMode === 'month' ? '#fff' : '#94a3b8',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Calendar size={14} /> Monthly Selection
              </button>
              <button
                type="button"
                onClick={() => setTenureMode('custom')}
                style={{
                  background: tenureMode === 'custom' ? '#10b981' : 'transparent',
                  color: tenureMode === 'custom' ? '#fff' : '#94a3b8',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Clock size={14} /> Custom Date Range
              </button>
            </div>

            {tenureMode === 'month' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Tenure Month:</label>
                <input
                  type="month"
                  className="nexus-input"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{ padding: '6px 12px', fontSize: 13, width: 160 }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { val: '2026-08', label: 'August 2026' },
                    { val: '2026-07', label: 'July 2026' },
                    { val: '2026-09', label: 'Sept 2026' },
                    { val: '2026-10', label: 'Oct 2026' },
                  ].map((m) => (
                    <button
                      key={m.val}
                      type="button"
                      className="nexus-btn nexus-btn-ghost"
                      onClick={() => setSelectedMonth(m.val)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        background: selectedMonth === m.val ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                        color: selectedMonth === m.val ? '#34d399' : '#64748b',
                        borderColor: selectedMonth === m.val ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      {m.label}
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
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 13, width: 145 }}
                />
                <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>To:</label>
                <input
                  type="date"
                  className="nexus-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 13, width: 145 }}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    onClick={() => {
                      const now = new Date();
                      const y = now.getFullYear();
                      const m = String(now.getMonth() + 1).padStart(2, '0');
                      setFromDate(`${y}-${m}-01`);
                      setToDate(`${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate()}`);
                    }}
                    style={{ padding: '4px 8px', fontSize: 10 }}
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    onClick={() => {
                      setFromDate('2026-08-01');
                      setToDate('2026-08-31');
                    }}
                    style={{ padding: '4px 8px', fontSize: 10 }}
                  >
                    August 2026
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Refresh & Date Field Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value)}
              className="nexus-select"
              title="Filter by Complaint Date or Entry Date"
              style={{ padding: '6px 10px', fontSize: 12, background: 'rgba(15,23,42,0.8)' }}
            >
              <option value="exactDate">📅 Filter by Complaint Date</option>
              <option value="createdAt">🕒 Filter by Entry Created At</option>
            </select>

            <button
              type="button"
              className="nexus-btn nexus-btn-primary"
              onClick={loadData}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                padding: '7px 14px',
                fontSize: 12,
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Refreshing...' : 'Apply Tenure'}
            </button>
          </div>
        </div>

        {/* Bottom Sub-filters: Irrelevant Toggle & Active Tenure Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            paddingTop: 10,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                background: excludeIrrelevant ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                padding: '6px 12px',
                borderRadius: 8,
                border: excludeIrrelevant ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={excludeIrrelevant}
                onChange={(e) => setExcludeIrrelevant(e.target.checked)}
                style={{ accentColor: '#22c55e', cursor: 'pointer', width: 15, height: 15 }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: excludeIrrelevant ? '#4ade80' : '#94a3b8' }}>
                ✨ Exclude Irrelevant Complaints (Show Valid Workload Only)
              </span>
            </label>
          </div>

          <div style={{ fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Active Tenure:</span>
            <span style={{ color: '#00f2fe', fontWeight: 700, background: 'rgba(0, 242, 254, 0.1)', padding: '2px 8px', borderRadius: 4 }}>
              {tenureLabel}
            </span>
          </div>
        </div>
      </div>

      {/* ── High-Level Overall KPI Ribbon ─────────────────────────────────── */}
      {overallStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {/* Total Complaints */}
          <div
            className="glass-card"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #38bdf8',
              background: 'rgba(15, 23, 42, 0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Complaints
              </span>
              <FileText size={18} color="#38bdf8" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginTop: 6 }}>
              {overallStats.totalTickets}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Across {personsSummary.length} employees / batches
            </div>
          </div>

          {/* Job Intakes Done */}
          <div
            className="glass-card"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #10b981',
              background: 'rgba(15, 23, 42, 0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Job Intakes Done
              </span>
              <CheckCircle2 size={18} color="#10b981" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#34d399' }}>
                {overallStats.totalIntakesDone}
              </span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                ({overallStats.overallIntakeRate}%)
              </span>
            </div>
            <div style={{ fontSize: 11, color: overallStats.totalIntakesPending > 0 ? '#f59e0b' : '#64748b', marginTop: 2 }}>
              {overallStats.totalIntakesPending} intakes pending
            </div>
          </div>

          {/* Payments Received */}
          <div
            className="glass-card"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #22c55e',
              background: 'rgba(15, 23, 42, 0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Payments Received
              </span>
              <DollarSign size={18} color="#22c55e" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#4ade80', marginTop: 6 }}>
              Rs. {overallStats.totalPaymentsReceived?.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Cleared across this tenure
            </div>
          </div>

          {/* Payments Pending */}
          <div
            className="glass-card"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #f59e0b',
              background: 'rgba(15, 23, 42, 0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Payments Pending
              </span>
              <Clock size={18} color="#f59e0b" />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24', marginTop: 6 }}>
              Rs. {overallStats.totalPaymentsPending?.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>
              Awaiting invoice / collection
            </div>
          </div>

          {/* Complaints with Pending Action */}
          <div
            className="glass-card"
            style={{
              padding: '16px 20px',
              borderLeft: '4px solid #ec4899',
              background: 'rgba(15, 23, 42, 0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Complaints Needing Action
              </span>
              <AlertTriangle size={18} color="#ec4899" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#f472b6', marginTop: 6 }}>
              {overallStats.totalPendingComplaints}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Have 1 or more pending tasks
            </div>
          </div>
        </div>
      )}

      {/* ── Summary of Each Person (Grid of Cards) ───────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={18} color="#00f2fe" />
            <h3 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Each Staff Member&apos;s Progress &amp; Pending Checklist &mdash; {tenureLabel}
            </h3>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {selectedPerson !== 'all' && (
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={() => setSelectedPerson('all')}
                style={{ padding: '4px 10px', fontSize: 12, color: '#00f2fe' }}
              >
                ✕ Clear Person Filter ({selectedPerson})
              </button>
            )}
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              Click any card to filter complaint table below.
            </span>
          </div>
        </div>

        {loading ? (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 12px', color: '#10b981' }} />
            Computing staff progress and pending checklists for {tenureLabel}...
          </div>
        ) : personsSummary.length === 0 ? (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            No complaints or progress records found for the selected tenure.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {personsSummary.map((p) => {
              const isBatch1 = p.batchName.includes('Batch 1');
              const isBatch2 = p.batchName.includes('Batch 2');
              const isBatch3 = p.batchName.includes('Batch 3');
              const isBatch4 = p.batchName.includes('Batch 4');
              const accentColor = isBatch1 ? '#38bdf8' : isBatch2 ? '#34d399' : isBatch3 ? '#c084fc' : isBatch4 ? '#fbbf24' : '#94a3b8';
              const isSelected = selectedPerson === p.batchName;
              const savedPhone = phoneDirectory[p.personName] || phoneDirectory[p.batchName] || '';

              return (
                <div
                  key={p.batchName}
                  className="glass-card"
                  style={{
                    padding: 18,
                    border: isSelected ? `2px solid ${accentColor}` : `1px solid ${accentColor}33`,
                    background: isSelected ? 'rgba(15, 23, 42, 0.9)' : 'rgba(15, 23, 42, 0.55)',
                    boxShadow: isSelected ? `0 0 20px ${accentColor}33` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                  }}
                >
                  {/* Top Bar: Name, Batch & Selection button */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                          {p.personName}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, marginTop: 2 }}>
                          {p.batchName}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedPerson(isSelected ? 'all' : p.batchName)}
                        style={{
                          background: isSelected ? accentColor : 'transparent',
                          color: isSelected ? '#000' : accentColor,
                          border: `1px solid ${accentColor}66`,
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected ? '✓ Viewing' : 'Filter Table'}
                      </button>
                    </div>

                    {/* Progress Bar & Intake Ratio */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Job Intakes Done:</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                          <strong style={{ color: '#22c55e' }}>{p.metrics.intakesDone}</strong> / {p.metrics.totalComplaints}
                          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>({p.metrics.intakeRate}%)</span>
                        </span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${p.metrics.intakeRate}%`, height: '100%', background: accentColor, borderRadius: 3 }} />
                      </div>
                    </div>

                    {/* Financials Row: Received vs Pending */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 10,
                        background: 'rgba(0, 0, 0, 0.25)',
                        padding: 10,
                        borderRadius: 8,
                        marginBottom: 12,
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                          💰 Received
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#4ade80', marginTop: 2 }}>
                          Rs. {p.metrics.paymentsReceivedTotal?.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          {p.metrics.paymentsReceivedCount} payments
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                          ⏳ Pending
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>
                          Rs. {p.metrics.paymentsPendingTotal?.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 10, color: '#f59e0b' }}>
                          {p.metrics.paymentsPendingCount} jobs pending
                        </div>
                      </div>
                    </div>

                    {/* Pending Action Items Micro-Grid */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>
                        Pending Tasks Breakdown ({p.metrics.totalPendingThingsCount} total):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {p.metrics.intakesPending > 0 && (
                          <span style={{ fontSize: 11, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 6px', borderRadius: 4 }}>
                            🚨 {p.metrics.intakesPending} Intakes
                          </span>
                        )}
                        {p.metrics.surveysPendingCount > 0 && (
                          <span style={{ fontSize: 11, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 6px', borderRadius: 4 }}>
                            📋 {p.metrics.surveysPendingCount} Surveys
                          </span>
                        )}
                        {p.metrics.quotationsPendingCount > 0 && (
                          <span style={{ fontSize: 11, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 6px', borderRadius: 4 }}>
                            💼 {p.metrics.quotationsPendingCount} Quotes
                          </span>
                        )}
                        {p.metrics.bankApprovalsPendingCount > 0 && (
                          <span style={{ fontSize: 11, background: 'rgba(167, 139, 250, 0.15)', color: '#c084fc', border: '1px solid rgba(167, 139, 250, 0.3)', padding: '2px 6px', borderRadius: 4 }}>
                            🏛️ {p.metrics.bankApprovalsPendingCount} Approvals
                          </span>
                        )}
                        {p.metrics.workCompletionsPendingCount > 0 && (
                          <span style={{ fontSize: 11, background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)', padding: '2px 6px', borderRadius: 4 }}>
                            🔨 {p.metrics.workCompletionsPendingCount} Completions
                          </span>
                        )}
                        {p.metrics.invoicesPendingCount > 0 && (
                          <span style={{ fontSize: 11, background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.3)', padding: '2px 6px', borderRadius: 4 }}>
                            🧾 {p.metrics.invoicesPendingCount} Invoices
                          </span>
                        )}
                        {p.metrics.totalPendingThingsCount === 0 && (
                          <span style={{ fontSize: 11, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '2px 6px', borderRadius: 4 }}>
                            ✅ All Completed &amp; Cleared!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Send via WhatsApp & Copy Report */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => openWhatsAppModal(p)}
                        style={{
                          background: 'linear-gradient(135deg, #25D366, #128C7E)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: '0 4px 10px rgba(37, 211, 102, 0.3)',
                        }}
                      >
                        <MessageSquare size={14} /> Send WhatsApp
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyWhatsAppText(p)}
                        className="nexus-btn nexus-btn-ghost"
                        style={{
                          padding: '8px 10px',
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          color: '#cbd5e1',
                        }}
                        title="Copy WhatsApp Formatted Summary"
                      >
                        <Copy size={14} /> Copy Text
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: '#64748b' }}>
                        {savedPhone ? `📱 Phone: ${savedPhone}` : 'No phone saved'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenPdfReport(p.batchName)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: accentColor,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Download size={11} /> PDF Audit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detailed Complaint-by-Complaint Pending Table ─────────────────── */}
      <div className="glass-card" style={{ marginTop: 10 }}>
        {/* Table Header & Multi-Filter Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h3 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Receipt size={18} color="#10b981" />
              Complaints Pending Checklist
              {selectedPerson !== 'all' && (
                <span style={{ fontSize: 13, color: '#38bdf8', fontWeight: 600 }}>
                  &mdash; Filtered for {selectedPerson}
                </span>
              )}
            </h3>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '2px 0 0' }}>
              Shows each complaint and every pending item (intake, survey, quotation, bank approval, work completion, invoice, payment).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Person Filter Dropdown */}
            <select
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              className="nexus-select"
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                minWidth: 180,
              }}
            >
              <option value="all">All Staff Members ({rawTickets.length})</option>
              {personsSummary.map((p) => (
                <option key={p.batchName} value={p.batchName}>
                  {p.batchName} ({p.metrics.totalComplaints})
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div style={{ position: 'relative', width: 260 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                className="nexus-input"
                placeholder="Search serial, client, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 32, fontSize: 12 }}
              />
            </div>
          </div>
        </div>

        {/* Pending Stage Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          {[
            { id: 'all', label: `All Complaints (${rawTickets.length})` },
            { id: 'hasPending', label: '⚠️ Any Pending' },
            { id: 'intake', label: '🚨 Intake Pending' },
            { id: 'survey', label: '📋 Survey Pending' },
            { id: 'quotation', label: '💼 Quotation Pending' },
            { id: 'bankApproval', label: '🏛️ Approval Pending' },
            { id: 'workCompletion', label: '🔨 Work Pending' },
            { id: 'invoice', label: '🧾 Invoice Pending' },
            { id: 'payment', label: '💰 Payment Pending' },
            { id: 'cleared', label: '✅ Fully Cleared' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPendingFilter(f.id)}
              style={{
                background: pendingFilter === f.id ? '#10b981' : 'rgba(255, 255, 255, 0.04)',
                color: pendingFilter === f.id ? '#fff' : '#94a3b8',
                border: pendingFilter === f.id ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Complaints Table */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#10b981' }} />
            Loading complaints...
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 12, border: '1px dashed rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
            No complaints found matching the selected filter criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Serial #</th>
                  <th style={{ width: 110 }}>Date &amp; Time</th>
                  <th style={{ width: 160 }}>Staff Member</th>
                  <th style={{ width: 200 }}>Client &amp; Branch</th>
                  <th style={{ width: 180 }}>Subject / Nature</th>
                  <th>Pending Actions Required</th>
                  <th style={{ width: 130 }}>Financial Status</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((t) => {
                  const bName = t.batchName;
                  const isBatch1 = bName.includes('Batch 1');
                  const isBatch2 = bName.includes('Batch 2');
                  const isBatch3 = bName.includes('Batch 3');
                  const isBatch4 = bName.includes('Batch 4');
                  const accentColor = isBatch1 ? '#38bdf8' : isBatch2 ? '#34d399' : isBatch3 ? '#c084fc' : isBatch4 ? '#fbbf24' : '#94a3b8';
                  const pendingItems = t.pendingSummary?.pendingItems || [];

                  return (
                    <tr key={t.id}>
                      {/* Serial Number */}
                      <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#00f2fe' }}>
                        {t.serialNo || t.id}
                      </td>

                      {/* Date & Time */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div>{new Date(t.exactDate).toLocaleDateString()}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>{t.time || ''}</div>
                      </td>

                      {/* Staff Member */}
                      <td>
                        <span style={{ fontWeight: 700, color: accentColor }}>
                          {bName}
                        </span>
                        {t.entryPerson && t.entryPerson !== bName && (
                          <div style={{ fontSize: 10, color: '#64748b' }}>({t.entryPerson})</div>
                        )}
                      </td>

                      {/* Client & Branch */}
                      <td>
                        {t.jobMetadata ? (
                          <>
                            <div style={{ fontWeight: 700, color: '#f8fafc' }}>{t.jobMetadata.clientName}</div>
                            <div style={{ color: '#94a3b8', fontSize: 11 }}>{t.jobMetadata.branchName}</div>
                          </>
                        ) : (
                          <span style={{ color: '#ef4444', fontSize: 11 }}>
                            ⚠️ Intake Not Created
                          </span>
                        )}
                      </td>

                      {/* Subject / Nature */}
                      <td>
                        <div style={{ color: '#f8fafc', fontWeight: 500 }}>{t.subject}</div>
                        {t.jobMetadata?.workNature && (
                          <span style={{ fontSize: 10, color: '#38bdf8', fontWeight: 600 }}>
                            {t.jobMetadata.workNature}
                          </span>
                        )}
                      </td>

                      {/* Pending Actions Checklist */}
                      <td>
                        {pendingItems.length === 0 ? (
                          <span
                            style={{
                              background: 'rgba(34, 197, 94, 0.15)',
                              color: '#4ade80',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Check size={12} /> All Completed &amp; Cleared
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {pendingItems.map((pItem, idx) => (
                              <span
                                key={idx}
                                style={{
                                  background: `${pItem.color}22`,
                                  color: pItem.color,
                                  border: `1px solid ${pItem.color}44`,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontSize: 10,
                                  fontWeight: 700,
                                }}
                                title={pItem.desc}
                              >
                                {pItem.badge}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Financial Status */}
                      <td>
                        {t.jobMetadata ? (
                          <div style={{ fontSize: 11 }}>
                            <div style={{ color: '#4ade80', fontWeight: 600 }}>
                              Recv: Rs. {(t.receivedAmount || 0).toLocaleString()}
                            </div>
                            <div style={{ color: t.pendingPaymentAmount > 0 ? '#fbbf24' : '#64748b' }}>
                              Pend: Rs. {(t.pendingPaymentAmount || 0).toLocaleString()}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: 10 }}>—</span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td style={{ textAlign: 'center' }}>
                        {t.intakePending ? (
                          <a
                            href="/intake"
                            className="nexus-btn nexus-btn-ghost"
                            style={{ padding: '3px 8px', fontSize: 10, color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
                          >
                            Go Intake
                          </a>
                        ) : t.surveyPending ? (
                          <a
                            href="/survey"
                            className="nexus-btn nexus-btn-ghost"
                            style={{ padding: '3px 8px', fontSize: 10, color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)' }}
                          >
                            Survey
                          </a>
                        ) : t.quotationPending ? (
                          <a
                            href="/quotation"
                            className="nexus-btn nexus-btn-ghost"
                            style={{ padding: '3px 8px', fontSize: 10, color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)' }}
                          >
                            Quote
                          </a>
                        ) : t.paymentPending ? (
                          <a
                            href="/pending-payments"
                            className="nexus-btn nexus-btn-ghost"
                            style={{ padding: '3px 8px', fontSize: 10, color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)' }}
                          >
                            Clear Pay
                          </a>
                        ) : (
                          <span style={{ color: '#4ade80', fontSize: 10 }}>✓ OK</span>
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

      {/* ── WhatsApp Dispatch Modal ──────────────────────────────────────── */}
      {whatsappModalOpen && targetPersonForWhatsapp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: 620,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#0b1320',
              border: '1px solid rgba(37, 211, 102, 0.4)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              padding: 24,
              borderRadius: 16,
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: '#25D366', padding: 10, borderRadius: 10 }}>
                  <MessageSquare size={22} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, margin: 0, color: '#fff', fontWeight: 800 }}>
                    Dispatch Report to WhatsApp
                  </h3>
                  <div style={{ fontSize: 13, color: '#34d399', fontWeight: 600, marginTop: 2 }}>
                    Recipient: {targetPersonForWhatsapp.personName} ({targetPersonForWhatsapp.batchName})
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setWhatsappModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Recipient Phone Input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Phone size={13} color="#25D366" />
                WhatsApp Phone Number (with Country Code):
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="nexus-input"
                  placeholder="e.g. 923001234567 or 03001234567"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button
                  type="button"
                  className="nexus-btn nexus-btn-ghost"
                  onClick={() => {
                    handleSavePhone(targetPersonForWhatsapp.personName, recipientPhone);
                    showToast(`Phone number saved for ${targetPersonForWhatsapp.personName}!`);
                  }}
                  style={{ fontSize: 12, padding: '6px 12px', color: '#34d399', borderColor: 'rgba(52,211,153,0.3)' }}
                >
                  Save Default
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                If left empty, WhatsApp will prompt you to select any contact directly.
              </div>
            </div>

            {/* Optional Custom Note */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 6, display: 'block' }}>
                Optional Instructions / Admin Note to Append:
              </label>
              <textarea
                className="nexus-input"
                placeholder="e.g. Kindly submit all site surveys and work completion photos by tomorrow morning."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={2}
                style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
              />
            </div>

            {/* Live Message Preview */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 6, display: 'block' }}>
                Formatted Message Preview:
              </label>
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  padding: 14,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 220,
                  overflowY: 'auto',
                  color: '#e2e8f0',
                  lineHeight: 1.5,
                }}
              >
                {constructFullWhatsAppMessage(targetPersonForWhatsapp, customNote)}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={() => setWhatsappModalOpen(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={() => handleCopyWhatsAppText(targetPersonForWhatsapp, customNote)}
                style={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)' }}
              >
                <Copy size={15} /> Copy Text Only
              </button>

              <button
                type="button"
                onClick={handleSendWhatsApp}
                style={{
                  background: 'linear-gradient(135deg, #25D366, #128C7E)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(37, 211, 102, 0.4)',
                }}
              >
                <Send size={15} /> Launch WhatsApp Web / App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Employee Names & Batches Configuration Modal ─────────────────── */}
      {aliasModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: 580,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#0f172a',
              border: '1px solid rgba(0, 242, 254, 0.3)',
              padding: 24,
              borderRadius: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, margin: 0, color: '#00f2fe', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} /> Configure Employee Names &amp; Batches
              </h3>
              <button
                type="button"
                onClick={() => setAliasModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 16 }}>
              Map raw entered names (e.g., from tickets or assigned employees) to formal Batch and Employee names.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto', marginBottom: 16, paddingRight: 4 }}>
              {Object.entries(editingAliases).map(([raw, mapped]) => (
                <div key={raw} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    disabled
                    value={raw}
                    className="nexus-input"
                    style={{ flex: 1, fontSize: 12, opacity: 0.8 }}
                  />
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>➔</span>
                  <input
                    type="text"
                    value={mapped}
                    onChange={(e) => setEditingAliases({ ...editingAliases, [raw]: e.target.value })}
                    className="nexus-input"
                    style={{ flex: 1, fontSize: 12 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...editingAliases };
                      delete next[raw];
                      setEditingAliases(next);
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Mapping */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
              <input
                type="text"
                placeholder="Raw Name (e.g. Asad)"
                value={newAliasKey}
                onChange={(e) => setNewAliasKey(e.target.value)}
                className="nexus-input"
                style={{ flex: 1, fontSize: 12 }}
              />
              <span style={{ color: '#94a3b8', fontSize: 12 }}>➔</span>
              <input
                type="text"
                placeholder="Target Batch (e.g. Asad Ali (Batch 5))"
                value={newAliasVal}
                onChange={(e) => setNewAliasVal(e.target.value)}
                className="nexus-input"
                style={{ flex: 1, fontSize: 12 }}
              />
              <button
                type="button"
                className="nexus-btn nexus-btn-primary"
                onClick={() => {
                  if (!newAliasKey.trim() || !newAliasVal.trim()) return;
                  setEditingAliases({ ...editingAliases, [newAliasKey.trim()]: newAliasVal.trim() });
                  setNewAliasKey('');
                  setNewAliasVal('');
                }}
                style={{ fontSize: 12, padding: '8px 12px' }}
              >
                Add
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  style={{ fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="nexus-btn nexus-btn-primary"
                  onClick={handleSaveAliases}
                  style={{ fontSize: 12, background: '#10b981' }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
