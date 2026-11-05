"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign, Clock, AlertTriangle, CheckCircle2, AlertCircle,
  Calendar, Search, Filter, ChevronLeft, ChevronRight, Download,
  Printer, RefreshCw, FileText, Check, X, ShieldAlert, Users,
  Receipt, Eye, Plus, Sparkles, ExternalLink, ArrowUpRight
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PendingPaymentsPage() {
  const { user, isHydrated } = useAuth();
  const router = useRouter();
  const isAuthorized = user?.role === 'ADMIN' || user?.role === 'SUB_ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const isSubAdmin = user?.role === 'SUB_ADMIN';

  useEffect(() => {
    if (isHydrated && user && !isAuthorized) {
      router.push('/dashboard');
    }
  }, [user, isHydrated, router, isAuthorized]);

  // Current calendar month default
  const today = new Date();
  const defaultYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState(defaultYearMonth);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'overdue', 'pending', 'cleared'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState('all'); // 'all', 'subject', 'ticket', 'serial', 'client'
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // Settlement / Clear Modal State
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedItemForSettle, setSelectedItemForSettle] = useState(null);
  const [settleForm, setSettleForm] = useState({
    settlementDate: defaultYearMonth + '-15',
    amountPaid: '',
    paymentMethod: 'Bank Transfer',
    notes: '',
    imageUrl: '',
    isFullClearance: true,
  });
  const [settling, setSettling] = useState(false);

  // Load Data
  const loadPendingPayments = useCallback(async (monthToLoad, queryToSearch, fieldToSearch) => {
    setLoading(true);
    try {
      const month = monthToLoad !== undefined ? monthToLoad : selectedMonth;
      const params = new URLSearchParams({ month });
      if (employeeFilter && employeeFilter !== 'all') {
        params.set('employeeId', employeeFilter);
      }
      const q = queryToSearch !== undefined ? queryToSearch : searchQuery;
      const f = fieldToSearch !== undefined ? fieldToSearch : searchField;
      if (q) {
        params.set('search', q);
        if (f && f !== 'all') {
          params.set('searchField', f);
        }
      }
      const res = await apiFetch(`/api/pending-payments?${params.toString()}`);
      setData(res);
      setIsError(false);
    } catch (err) {
      console.error('Failed to load pending payments:', err);
      setMessage(err.message || 'Failed to load pending payments');
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, employeeFilter, searchQuery, searchField]);

  // Debounced load when search query, field, month, or employee filter changes
  useEffect(() => {
    if (!isAuthorized) return;
    const timer = setTimeout(() => {
      loadPendingPayments(selectedMonth, searchQuery, searchField);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, searchField, selectedMonth, employeeFilter, isAuthorized, loadPendingPayments]);

  // Synchronize year with selected month
  useEffect(() => {
    if (selectedMonth && selectedMonth !== 'all' && selectedMonth.includes('-')) {
      const [y] = selectedMonth.split('-');
      setSelectedYear(parseInt(y, 10));
    }
  }, [selectedMonth]);

  // Handle Month Navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 'all') {
      setSelectedMonth(defaultYearMonth);
      return;
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    let newY = y;
    let newM = m - 1;
    if (newM < 1) {
      newM = 12;
      newY -= 1;
    }
    const newMonth = `${newY}-${String(newM).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 'all') {
      setSelectedMonth(defaultYearMonth);
      return;
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    let newY = y;
    let newM = m + 1;
    if (newM > 12) {
      newM = 1;
      newY += 1;
    }
    const newMonth = `${newY}-${String(newM).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const handleSelectMonthNumber = (monthIndex) => {
    const mNum = String(monthIndex + 1).padStart(2, '0');
    const newMonth = `${selectedYear}-${mNum}`;
    setSelectedMonth(newMonth);
  };

  // Open Settle Modal
  const openSettleModal = (item) => {
    setSelectedItemForSettle(item);
    setSettleForm({
      settlementDate: selectedMonth && selectedMonth !== 'all' ? `${selectedMonth}-15` : new Date().toISOString().slice(0, 10),
      amountPaid: item.pendingAmount || item.totalAmount || '',
      paymentMethod: 'Bank Transfer',
      notes: `Settlement for invoice ${item.invoiceRef} (${item.clientName})`,
      imageUrl: '',
      isFullClearance: true,
    });
    setSettleModalOpen(true);
  };

  // Submit Settlement
  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItemForSettle) return;
    setSettling(true);
    try {
      await apiFetch('/api/pending-payments/clear', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: selectedItemForSettle.invoiceId,
          jobId: selectedItemForSettle.jobId,
          settlementDate: settleForm.settlementDate,
          amountPaid: Number(settleForm.amountPaid) || selectedItemForSettle.pendingAmount,
          paymentMethod: settleForm.paymentMethod,
          notes: settleForm.notes,
          imageUrl: settleForm.imageUrl,
          isFullClearance: settleForm.isFullClearance,
        }),
      });
      setSettleModalOpen(false);
      setMessage(`Payment settled successfully for ${selectedItemForSettle.invoiceRef}!`);
      setTimeout(() => setMessage(''), 4000);
      await loadPendingPayments(selectedMonth);
    } catch (err) {
      alert(err.message || 'Failed to settle payment');
    } finally {
      setSettling(false);
    }
  };

  // Quick Reopen (mark back to Pending)
  const handleReopen = async (item) => {
    if (!confirm(`Mark invoice ${item.invoiceRef} back as UNPAID / PENDING?`)) return;
    try {
      await apiFetch('/api/pending-payments/clear', {
        method: 'PATCH',
        body: JSON.stringify({
          invoiceId: item.invoiceId,
          jobId: item.jobId,
          action: 'reopen',
        }),
      });
      setMessage(`Invoice ${item.invoiceRef} reopened as Pending.`);
      setTimeout(() => setMessage(''), 4000);
      await loadPendingPayments(selectedMonth);
    } catch (err) {
      alert(err.message || 'Failed to update payment status');
    }
  };

  // Print Monthly Sheet
  const handlePrint = () => {
    window.print();
  };

  // Instant client-side search matcher for Subject, Ticket #, Serial #, Client, PO
  const matchesSearch = useCallback((item, query, field) => {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    const cleanNum = q.replace(/^(ticket\s*#?|#|sr\s*#?|serial\s*#?|inv\s*#?|i)/i, '').trim();

    const subjectStr = (item.subject || '').toLowerCase();
    const serialStr = (item.serialNo || '').toLowerCase();
    const ticketIdStr = item.ticketId != null ? String(item.ticketId) : '';
    const refStr = (item.invoiceRef || '').toLowerCase();
    const clientStr = (item.clientName || '').toLowerCase();
    const branchStr = (item.branchName || '').toLowerCase();
    const employeeStr = (item.assignedEmployee?.name || '').toLowerCase();
    const poStr = (item.poNumber || '').toLowerCase();
    const workStr = (item.workNature || '').toLowerCase();

    // 1. Subject match
    const matchSubject = subjectStr.includes(q);

    // 2. Ticket ID match (supports "123", "Ticket #123", "#123", etc.)
    const matchTicket = Boolean(
      ticketIdStr && (
        ticketIdStr === q ||
        ticketIdStr.includes(q) ||
        (cleanNum && ticketIdStr === cleanNum) ||
        `ticket #${ticketIdStr}`.toLowerCase().includes(q) ||
        `ticket ${ticketIdStr}`.toLowerCase().includes(q) ||
        `#${ticketIdStr}`.toLowerCase().includes(q)
      )
    );

    // 3. Serial Number match (supports exact or partial serial / invoiceRef)
    const matchSerial = Boolean(
      serialStr.includes(q) ||
      (cleanNum && serialStr.includes(cleanNum)) ||
      refStr.includes(q) ||
      (cleanNum && refStr.includes(cleanNum))
    );

    // 4. Client / Branch / Employee / PO / Work Nature match
    const matchClient = clientStr.includes(q) || branchStr.includes(q);
    const matchOther = employeeStr.includes(q) || poStr.includes(q) || workStr.includes(q);

    if (field === 'subject') return matchSubject;
    if (field === 'ticket') return matchTicket;
    if (field === 'serial') return matchSerial;
    if (field === 'client') return matchClient;

    return matchSubject || matchTicket || matchSerial || matchClient || matchOther;
  }, []);

  // Filtered Current Month Invoices
  const displayCurrentMonthInvoices = useMemo(() => {
    if (!data?.currentMonthInvoices) return [];
    let list = data.currentMonthInvoices;
    if (statusFilter === 'pending') {
      list = list.filter(i => i.pendingAmount > 0);
    } else if (statusFilter === 'cleared') {
      list = list.filter(i => i.isCleared);
    } else if (statusFilter === 'overdue') {
      return []; // Current month is not overdue carryover
    }
    if (searchQuery) {
      list = list.filter(i => matchesSearch(i, searchQuery, searchField));
    }
    return list;
  }, [data?.currentMonthInvoices, statusFilter, searchQuery, searchField, matchesSearch]);

  // Filtered Overdue Carryover Invoices
  const displayOverdueInvoices = useMemo(() => {
    if (!data?.overdueCarryoverInvoices) return [];
    if (statusFilter === 'cleared') return [];
    let list = data.overdueCarryoverInvoices;
    if (searchQuery) {
      list = list.filter(i => matchesSearch(i, searchQuery, searchField));
    }
    return list;
  }, [data?.overdueCarryoverInvoices, statusFilter, searchQuery, searchField, matchesSearch]);

  const stats = data?.stats || {};
  const currentStats = stats.currentMonth || {};
  const carryoverStats = stats.carryover || {};
  const hasStrictNotice = carryoverStats.hasStrictNotice && carryoverStats.totalOverdueInvoices > 0;

  if (!isHydrated || !user || !isAuthorized) {
    return null;
  }

  return (
    <div className="pending-payments-container">
      {/* HEADER SECTION */}
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              background: 'linear-gradient(135deg, #0ea5e9, #00f2fe)',
              padding: 8,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0,242,254,0.3)'
            }}>
              <DollarSign size={24} color="#06070a" />
            </div>
            <div>
              <h1 style={{ fontSize: 24, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {data?.selectedMonthName || 'Monthly'} Pending Payments Sheet
              </h1>
              <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
                {isAdmin ? '🛡️ Admin Command View • Multi-Month Carryover Ledger' : isSubAdmin ? '🛡️ Sub Admin Supervisor View • Multi-Month Carryover Ledger' : `👤 Employee View • ${user?.employeeName || 'Staff'} Work Orders`}
              </p>
            </div>
          </div>
        </div>

        {/* TOP ACTIONS */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="nexus-btn nexus-btn-ghost"
            onClick={() => loadPendingPayments(selectedMonth)}
            title="Refresh Ledger"
            disabled={loading}
            style={{ fontSize: 13, padding: '8px 14px' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          
          <button
            type="button"
            className="nexus-btn nexus-btn-ghost"
            onClick={handlePrint}
            title="Print Monthly Sheet"
            style={{ fontSize: 13, padding: '8px 14px' }}
          >
            <Printer size={15} />
            <span>Print Sheet</span>
          </button>

          <Link href="/invoice" className="nexus-btn nexus-btn-primary" style={{ fontSize: 13, padding: '8px 16px', textDecoration: 'none' }}>
            <Plus size={15} />
            <span>Create Invoice</span>
          </Link>
        </div>
      </header>

      {/* FEEDBACK ALERTS */}
      {message && (
        <div className={isError ? 'alert-error' : 'alert-success'} style={{ marginBottom: 20 }}>
          {message}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* 🔍 SEARCH & FILTER BAR (SUBJECT, TICKET #, SERIAL #, CLIENT, PO) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <section className="glass-card" style={{
        marginBottom: 20,
        padding: '16px 20px',
        border: '1px solid rgba(0, 242, 254, 0.28)',
        background: 'rgba(10, 15, 29, 0.85)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          {/* Search Input Box */}
          <div style={{ flex: '1 1 340px', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, color: '#00f2fe', pointerEvents: 'none' }} />
            <input
              type="text"
              className="nexus-input"
              placeholder="Search by Subject, Ticket #, Serial #, Client, PO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: 38,
                paddingRight: searchQuery ? 38 : 14,
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 13,
                background: 'rgba(0,0,0,0.45)',
                border: searchQuery ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                color: '#fff',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 12,
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Search Field Scope Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Filter By:</span>
            {[
              { id: 'all', label: 'All Fields' },
              { id: 'subject', label: 'Subject' },
              { id: 'ticket', label: 'Ticket #' },
              { id: 'serial', label: 'Serial #' },
              { id: 'client', label: 'Client / Branch' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSearchField(f.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: searchField === f.id ? 700 : 500,
                  border: searchField === f.id ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.08)',
                  background: searchField === f.id ? 'rgba(0, 242, 254, 0.18)' : 'rgba(255,255,255,0.03)',
                  color: searchField === f.id ? '#00f2fe' : '#94a3b8',
                  transition: 'all 0.15s ease',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Employee Filter Dropdown */}
          {(isAdmin || isSubAdmin) && data?.employees && data.employees.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={14} color="#a78bfa" />
              <select
                className="nexus-select"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                style={{ padding: '7px 12px', fontSize: 12, minWidth: 160 }}
              >
                <option value="all">All Employees</option>
                {data.employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.employeeName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Active Search Results Indicator */}
        {searchQuery && (
          <div style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            flexWrap: 'wrap',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: '#00f2fe', fontWeight: 600 }}>
                Found {displayOverdueInvoices.length + displayCurrentMonthInvoices.length} matching pending payment(s)
              </span>
              <span style={{ color: '#94a3b8' }}>
                for &quot;<strong style={{ color: '#f8fafc' }}>{searchQuery}</strong>&quot; in {searchField === 'all' ? 'All Fields' : searchField.toUpperCase()}
              </span>
              {selectedMonth !== 'all' && (
                <span style={{ color: '#64748b' }}>
                  (in {data?.selectedMonthName || selectedMonth})
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {selectedMonth !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedMonth('all')}
                  className="nexus-btn"
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    background: 'rgba(0,242,254,0.12)',
                    color: '#00f2fe',
                    border: '1px solid rgba(0,242,254,0.35)',
                    fontWeight: 600,
                  }}
                >
                  🌐 Search in All Months
                </button>
              )}
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="nexus-btn nexus-btn-ghost"
                style={{ padding: '4px 10px', fontSize: 11 }}
              >
                Reset Search
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* MONTH NAVIGATOR & DYNAMIC MONTH SHEET TABS BAR */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <section className="glass-card" style={{ marginBottom: 24, padding: '16px 20px', background: 'rgba(15, 17, 26, 0.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 12 }}>
          {/* Previous / Next Month Arrows */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="nexus-btn nexus-btn-ghost"
              onClick={handlePrevMonth}
              style={{ padding: '6px 12px' }}
              title="Previous Month"
            >
              <ChevronLeft size={18} />
            </button>

            <div style={{
              background: 'linear-gradient(135deg, rgba(0,242,254,0.12), rgba(14,165,233,0.06))',
              border: '1px solid rgba(0,242,254,0.3)',
              borderRadius: 8,
              padding: '6px 16px',
              textAlign: 'center',
              minWidth: 180,
            }}>
              <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block' }}>Active Sheet</span>
              <strong style={{ fontSize: 16, color: '#00f2fe', letterSpacing: '0.02em' }}>
                {data?.selectedMonthName || selectedMonth}
              </strong>
            </div>

            <button
              type="button"
              className="nexus-btn nexus-btn-ghost"
              onClick={handleNextMonth}
              style={{ padding: '6px 12px' }}
              title="Next Month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Year Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Year:</span>
            {[2025, 2026, 2027].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  setSelectedYear(yr);
                  const m = selectedMonth === 'all' ? '01' : (selectedMonth.split('-')[1] || '01');
                  setSelectedMonth(`${yr}-${m}`);
                }}
                className={`nexus-btn ${selectedYear === yr && selectedMonth !== 'all' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Month Tabs Bar + ⭐ All Months Tab */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, paddingTop: 4 }}>
          <button
            type="button"
            onClick={() => setSelectedMonth('all')}
            style={{
              flex: '1 0 auto',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: selectedMonth === 'all' ? 700 : 500,
              cursor: 'pointer',
              border: selectedMonth === 'all'
                ? '1px solid #00f2fe'
                : '1px solid rgba(255, 255, 255, 0.08)',
              background: selectedMonth === 'all'
                ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.25), rgba(14, 165, 233, 0.15))'
                : 'rgba(0, 0, 0, 0.3)',
              color: selectedMonth === 'all' ? '#00f2fe' : '#94a3b8',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <span>⭐ All Months</span>
          </button>
          {MONTH_NAMES.map((mName, idx) => {
            const mKey = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
            const isCurrentActive = selectedMonth === mKey;
            return (
              <button
                key={mName}
                type="button"
                onClick={() => handleSelectMonthNumber(idx)}
                style={{
                  flex: '1 0 auto',
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: isCurrentActive ? 700 : 500,
                  cursor: 'pointer',
                  border: isCurrentActive
                    ? '1px solid #00f2fe'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  background: isCurrentActive
                    ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.22), rgba(14, 165, 233, 0.12))'
                    : 'rgba(0, 0, 0, 0.25)',
                  color: isCurrentActive ? '#00f2fe' : '#94a3b8',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                }}
              >
                <span>{mName.slice(0, 3)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* 4 SUMMARY METRIC CARDS (EXACT USER REQUIREMENT) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* CARD 1: TOTAL PAYMENTS OF CURRENT MONTH */}
        <div className="glass-card" style={{ padding: '20px 22px', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="field-label" style={{ color: '#93c5fd', margin: 0 }}>
              Total Billed ({data?.selectedMonthName?.split(' ')[0] || 'Month'})
            </span>
            <Receipt size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Rs. {(currentStats.totalBilled || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Across <strong>{currentStats.totalInvoices || 0}</strong> invoices generated this month
          </div>
        </div>

        {/* CARD 2: TOTAL PENDINGS OF CURRENT MONTH (OUT OF TOTAL PAYMENTS) - EXACT PROMPT SPEC */}
        <div className="glass-card" style={{ padding: '20px 22px', border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="field-label" style={{ color: '#fcd34d', margin: 0 }}>
              {data?.selectedMonthName?.split(' ')[0] || 'Month'} Pending Payments
            </span>
            <Clock size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Rs. {(currentStats.totalPending || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: '#fcd34d' }}>
            out of <strong>Rs. {(currentStats.totalBilled || 0).toLocaleString()}</strong> total ({currentStats.pendingInvoices || 0} of {currentStats.totalInvoices || 0} pending)
          </div>
          {/* Progress bar */}
          <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
            <div
              style={{
                width: `${currentStats.clearancePercent || 0}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10b981, #34d399)',
                borderRadius: 3,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            {currentStats.clearancePercent || 0}% cleared for this month
          </div>
        </div>

        {/* CARD 3: TOTAL CLEARED / RECEIVED THIS MONTH */}
        <div className="glass-card" style={{ padding: '20px 22px', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="field-label" style={{ color: '#6ee7b7', margin: 0 }}>
              Cleared / Paid ({data?.selectedMonthName?.split(' ')[0] || 'Month'})
            </span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Rs. {(currentStats.totalReceived || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            <strong>{currentStats.clearedInvoices || 0}</strong> invoices fully settled
          </div>
        </div>

        {/* CARD 4: OVERDUE CARRYOVER FROM PRIOR MONTHS (e.g. DECEMBER) - EXACT PROMPT SPEC */}
        <div
          className="glass-card"
          style={{
            padding: '20px 22px',
            border: hasStrictNotice ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
            background: hasStrictNotice ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.02)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {hasStrictNotice && (
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: '#ef4444',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 10px',
              borderBottomLeftRadius: 8,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              Strict Notice
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="field-label" style={{ color: hasStrictNotice ? '#f87171' : '#94a3b8', margin: 0 }}>
              Prior Month(s) Overdue Carryover
            </span>
            <AlertTriangle size={18} color={hasStrictNotice ? '#ef4444' : '#64748b'} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: hasStrictNotice ? '#ef4444' : '#94a3b8', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Rs. {(carryoverStats.totalOverduePending || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: hasStrictNotice ? '#fca5a5' : '#64748b' }}>
            {hasStrictNotice ? (
              <span>
                <strong>{carryoverStats.totalOverdueInvoices}</strong> invoice(s) carried over unsettled!
              </span>
            ) : (
              <span>All prior months cleared cleanly! 🎉</span>
            )}
          </div>

          {/* Breakdown for prior months (e.g., December) */}
          {carryoverStats.priorMonthsBreakdown && carryoverStats.priorMonthsBreakdown.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(239,68,68,0.2)' }}>
              {carryoverStats.priorMonthsBreakdown.map((pm) => (
                <div key={pm.month} style={{ fontSize: 11, color: '#f87171', display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <span>{pm.monthName}:</span>
                  <strong>Rs. {pm.totalPendingCarried.toLocaleString()} ({pm.pendingCountCarried}/{pm.totalInvoices} inv)</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* 🚨 STRICT NOTICE RED BANNER (EXACT PROMPT SPECIFICATION) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {hasStrictNotice && (
        <section
          style={{
            background: 'linear-gradient(90deg, rgba(239,68,68,0.18), rgba(185,28,28,0.1))',
            border: '2px solid #ef4444',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            boxShadow: '0 0 25px rgba(239,68,68,0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(239,68,68,0.6)',
              flexShrink: 0,
            }}>
              <AlertTriangle size={24} color="#ffffff" />
            </div>
            <div>
              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: 15, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🚨 STRICT NOTICE: UNRESOLVED OVERDUE PAYMENTS CARRIED FORWARD</span>
                <span style={{ background: '#7f1d1d', color: '#fca5a5', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
                  {carryoverStats.totalOverdueInvoices} Overdue Invoices
                </span>
              </div>
              <p style={{ color: '#fca5a5', fontSize: 13, margin: '4px 0 0 0' }}>
                Payments originating in previous month(s) (including{' '}
                <strong>
                  {carryoverStats.priorMonthsBreakdown?.map(p => p.monthName).join(', ') || 'prior period'}
                </strong>
                ) were NOT cleared and have automatically rolled forward into this {data?.selectedMonthName} sheet with high alert.
                Immediate payment collection or settlement is required!
              </p>
            </div>
          </div>
          <div>
            <button
              type="button"
              className="nexus-btn"
              onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
              style={{
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                padding: '8px 16px',
                fontSize: 12,
              }}
            >
              {statusFilter === 'overdue' ? 'Show All Payments' : 'View Overdue Items Only'}
            </button>
          </div>
        </section>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* FILTER TABS */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'all', label: 'All Invoices' },
            { id: 'overdue', label: `🔴 Overdue Strict (${carryoverStats.totalOverdueInvoices || 0})` },
            { id: 'pending', label: `⏳ Month Pending (${currentStats.pendingInvoices || 0})` },
            { id: 'cleared', label: `✅ Settled (${currentStats.clearedInvoices || 0})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`nexus-btn ${statusFilter === tab.id ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
              style={{ fontSize: 12, padding: '6px 14px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          Showing <strong>{displayOverdueInvoices.length + displayCurrentMonthInvoices.length}</strong> items in sheet
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 1: 🔴 OVERDUE CARRY-FORWARD PAYMENTS (RED HIGHLIGHTED TABLE) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {displayOverdueInvoices.length > 0 && (
        <section className="glass-card" style={{
          marginBottom: 28,
          border: '2px solid rgba(239,68,68,0.7)',
          background: 'rgba(239,68,68,0.03)',
          boxShadow: '0 8px 30px rgba(239,68,68,0.15)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                background: '#ef4444',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                🔴 Strictly Overdue Carry-Over
              </div>
              <h2 style={{ fontSize: 17, margin: 0, color: '#f87171' }}>
                Unsettled Invoices Carried Forward from Prior Months
              </h2>
            </div>
            <span style={{ fontSize: 12, color: '#fca5a5', fontWeight: 600 }}>
              Total Overdue: Rs. {(carryoverStats.totalOverduePending || 0).toLocaleString()}
            </span>
          </div>

          <p style={{ color: '#fca5a5', fontSize: 12, marginBottom: 16 }}>
            These invoices originated before {data?.selectedMonthName} and were NOT cleared. They will continue to shift to each subsequent month highlighted in red until marked cleared!
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ color: '#fca5a5' }}>Notice</th>
                  <th style={{ color: '#fca5a5' }}>Origin Month</th>
                  <th style={{ color: '#fca5a5' }}>Ticket & Serial #</th>
                  <th style={{ color: '#fca5a5' }}>Subject</th>
                  <th style={{ color: '#fca5a5' }}>Invoice #</th>
                  <th style={{ color: '#fca5a5' }}>Client & Branch</th>
                  <th style={{ color: '#fca5a5' }}>Assigned Staff</th>
                  <th style={{ color: '#fca5a5' }}>Billed Amount</th>
                  <th style={{ color: '#fca5a5' }}>Received</th>
                  <th style={{ color: '#ef4444', fontWeight: 800 }}>Pending Balance</th>
                  <th style={{ color: '#fca5a5' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayOverdueInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
                    }}
                  >
                    <td>
                      <span style={{
                        background: '#ef4444',
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 4,
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                        display: 'inline-block',
                      }}>
                        STRICT NOTICE
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: 13 }}>
                        {inv.originMonthName}
                      </div>
                      <div style={{ fontSize: 10, color: '#ef4444' }}>
                        {inv.monthsOverdue ? `${inv.monthsOverdue} month(s) overdue` : 'Overdue'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {inv.ticketId ? (
                          <span style={{
                            fontFamily: 'monospace',
                            background: 'rgba(239, 68, 68, 0.22)',
                            color: '#fca5a5',
                            border: '1px solid rgba(239, 68, 68, 0.45)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            width: 'fit-content',
                            whiteSpace: 'nowrap',
                          }}>
                            Ticket #{inv.ticketId}
                          </span>
                        ) : null}
                        {inv.serialNo ? (
                          <span style={{
                            fontFamily: 'monospace',
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: '#cbd5e1',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            width: 'fit-content',
                            whiteSpace: 'nowrap',
                          }}>
                            Sr #{inv.serialNo}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div style={{ minWidth: 160, maxWidth: 260 }}>
                        <div style={{
                          fontWeight: 600,
                          color: '#f8fafc',
                          fontSize: 12.5,
                          lineHeight: 1.35,
                          wordBreak: 'break-word',
                        }}>
                          {inv.subject || 'Work Order'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', color: '#f87171', fontWeight: 700 }}>
                        {inv.invoiceRef}
                      </span>
                      {inv.poNumber && (
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>PO: {inv.poNumber}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{inv.clientName}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{inv.branchName} • {inv.workNature}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: '#a78bfa' }}>
                        {inv.assignedEmployee?.name || 'Unassigned'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                        Rs. {inv.totalAmount.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#34d399', fontWeight: 600 }}>
                        Rs. {inv.totalReceived.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <div style={{ color: '#ef4444', fontWeight: 900, fontSize: 15 }}>
                        Rs. {inv.pendingAmount.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 10, color: '#fca5a5' }}>
                        {inv.paymentProgress || 0}% paid
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => openSettleModal(inv)}
                        className="nexus-btn"
                        style={{
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#fff',
                          padding: '6px 12px',
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 6,
                          border: 'none',
                        }}
                      >
                        <Check size={13} /> Settle / Clear
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 2: 📋 CURRENT MONTH INVOICES & PAYMENTS */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <section className="glass-card" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'rgba(0,242,254,0.15)',
              padding: '4px 10px',
              borderRadius: 6,
              color: '#00f2fe',
              fontWeight: 700,
              fontSize: 12,
            }}>
              {data?.selectedMonthName}
            </div>
            <h2 style={{ fontSize: 18, margin: 0 }}>
              Current Month Invoices & Payment Status
            </h2>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Pending: <strong style={{ color: '#f59e0b' }}>Rs. {(currentStats.totalPending || 0).toLocaleString()}</strong>
            {' '} | Cleared: <strong style={{ color: '#10b981' }}>Rs. {(currentStats.totalReceived || 0).toLocaleString()}</strong>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <div className="animate-spin" style={{ display: 'inline-block', marginBottom: 8 }}>🌀</div>
            <div>Loading sheet data for {data?.selectedMonthName || selectedMonth}...</div>
          </div>
        ) : displayCurrentMonthInvoices.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
            <Receipt size={36} color="#334155" style={{ marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: 15, color: '#94a3b8' }}>
              {searchQuery
                ? `No pending payments match "${searchQuery}" in ${data?.selectedMonthName || selectedMonth}.`
                : `No invoices generated in ${data?.selectedMonthName || selectedMonth}.`}
            </p>
            {searchQuery && selectedMonth !== 'all' ? (
              <button
                type="button"
                onClick={() => setSelectedMonth('all')}
                className="nexus-btn nexus-btn-primary"
                style={{ marginTop: 14, fontSize: 12, padding: '8px 16px' }}
              >
                🌐 Search for &quot;{searchQuery}&quot; Across All Months
              </button>
            ) : (
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Click &quot;Create Invoice&quot; to generate an official invoice for any completed job order.
              </p>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Ticket & Serial #</th>
                  <th>Subject</th>
                  <th>Invoice Ref</th>
                  <th>Client & Branch</th>
                  <th>Work Nature</th>
                  <th>Assigned Employee</th>
                  <th>Billed Amount</th>
                  <th>Paid</th>
                  <th>Pending Balance</th>
                  <th>Progress</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayCurrentMonthInvoices.map((inv) => {
                  const isCleared = inv.isCleared;
                  return (
                    <tr
                      key={inv.id}
                      style={{
                        background: isCleared ? 'rgba(16,185,129,0.02)' : 'transparent',
                      }}
                    >
                      <td>
                        {isCleared ? (
                          <span style={{
                            background: 'rgba(16,185,129,0.15)',
                            color: '#10b981',
                            border: '1px solid rgba(16,185,129,0.3)',
                            padding: '3px 8px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}>
                            <Check size={11} /> Cleared
                          </span>
                        ) : inv.totalReceived > 0 ? (
                          <span style={{
                            background: 'rgba(245,158,11,0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,0.3)',
                            padding: '3px 8px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                          }}>
                            Partial
                          </span>
                        ) : (
                          <span style={{
                            background: 'rgba(239,68,68,0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239,68,68,0.3)',
                            padding: '3px 8px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                          }}>
                            Pending
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {inv.ticketId ? (
                            <span style={{
                              fontFamily: 'monospace',
                              background: 'rgba(167, 139, 250, 0.15)',
                              color: '#c4b5fd',
                              border: '1px solid rgba(167, 139, 250, 0.35)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              width: 'fit-content',
                              whiteSpace: 'nowrap',
                            }}>
                              Ticket #{inv.ticketId}
                            </span>
                          ) : null}
                          {inv.serialNo ? (
                            <span style={{
                              fontFamily: 'monospace',
                              background: 'rgba(0, 242, 254, 0.1)',
                              color: '#00f2fe',
                              border: '1px solid rgba(0, 242, 254, 0.25)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              width: 'fit-content',
                              whiteSpace: 'nowrap',
                            }}>
                              Sr #{inv.serialNo}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div style={{ minWidth: 160, maxWidth: 260 }}>
                          <div style={{
                            fontWeight: 600,
                            color: '#f8fafc',
                            fontSize: 12.5,
                            lineHeight: 1.35,
                            wordBreak: 'break-word',
                          }}>
                            {inv.subject || 'Work Order'}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 600 }}>
                          {inv.invoiceRef}
                        </span>
                        {inv.poNumber && <div style={{ fontSize: 10, color: '#64748b' }}>PO: {inv.poNumber}</div>}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{inv.clientName}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{inv.branchName}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{inv.workNature}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: '#a78bfa' }}>
                          {inv.assignedEmployee?.name || 'Unassigned'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                          Rs. {inv.totalAmount.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>
                          Rs. {inv.totalReceived.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          color: inv.pendingAmount > 0 ? '#f59e0b' : '#10b981',
                          fontWeight: 700,
                        }}>
                          Rs. {inv.pendingAmount.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ minWidth: 100 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${inv.paymentProgress || 0}%`,
                                height: '100%',
                                background: isCleared ? '#10b981' : (inv.paymentProgress > 0 ? '#f59e0b' : '#64748b'),
                                borderRadius: 3,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 28 }}>
                            {inv.paymentProgress || 0}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {!isCleared ? (
                            <button
                              type="button"
                              onClick={() => openSettleModal(inv)}
                              className="nexus-btn nexus-btn-primary"
                              style={{ padding: '4px 10px', fontSize: 11 }}
                            >
                              Settle / Clear
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReopen(inv)}
                              className="nexus-btn nexus-btn-ghost"
                              style={{ padding: '4px 10px', fontSize: 11, color: '#94a3b8' }}
                              title="Mark back to pending"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* SETTLEMENT / CLEAR MODAL */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {settleModalOpen && selectedItemForSettle && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20,
        }}>
          <div className="glass-card" style={{ maxWidth: 520, width: '100%', border: '1px solid rgba(0,242,254,0.3)', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={22} color="#10b981" />
                <h3 style={{ fontSize: 18, margin: 0 }}>
                  Clear & Settle Payment: {selectedItemForSettle.invoiceRef}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSettleModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.4)',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 20,
              fontSize: 13,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#94a3b8' }}>Client:</span>
                <strong style={{ color: '#fff' }}>{selectedItemForSettle.clientName} ({selectedItemForSettle.branchName})</strong>
              </div>
              {selectedItemForSettle.subject && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#94a3b8' }}>Subject:</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedItemForSettle.subject}</span>
                </div>
              )}
              {(selectedItemForSettle.ticketId || selectedItemForSettle.serialNo) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#94a3b8' }}>Ticket / Serial #:</span>
                  <span style={{ color: '#00f2fe', fontFamily: 'monospace' }}>
                    {selectedItemForSettle.ticketId ? `Ticket #${selectedItemForSettle.ticketId} ` : ''}
                    {selectedItemForSettle.serialNo ? `• Sr #${selectedItemForSettle.serialNo}` : ''}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#94a3b8' }}>Billed Month:</span>
                <span style={{ color: '#a78bfa' }}>{selectedItemForSettle.originMonthName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#94a3b8' }}>Total Invoice Amount:</span>
                <strong style={{ color: '#38bdf8' }}>Rs. {selectedItemForSettle.totalAmount.toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Outstanding Pending:</span>
                <strong style={{ color: '#ef4444' }}>Rs. {selectedItemForSettle.pendingAmount.toLocaleString()}</strong>
              </div>
            </div>

            <form onSubmit={handleSettleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Settlement Date (Determines Clearing Month)</label>
                <input
                  type="date"
                  className="nexus-input"
                  required
                  value={settleForm.settlementDate}
                  onChange={(e) => setSettleForm({ ...settleForm, settlementDate: e.target.value })}
                />
                <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 4 }}>
                  e.g. If cleared in February, pick a February date so this invoice settles in February and no longer appears overdue!
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="field-label">Amount Paid (Rs)</label>
                  <input
                    type="number"
                    min="1"
                    className="nexus-input"
                    required
                    value={settleForm.amountPaid}
                    onChange={(e) => setSettleForm({ ...settleForm, amountPaid: e.target.value })}
                  />
                </div>

                <div>
                  <label className="field-label">Payment Method</label>
                  <select
                    className="nexus-select"
                    value={settleForm.paymentMethod}
                    onChange={(e) => setSettleForm({ ...settleForm, paymentMethod: e.target.value })}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online Banking</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Settlement Notes / Transaction Ref</label>
                <input
                  type="text"
                  className="nexus-input"
                  placeholder="e.g. Bank Alfalah slip ref #12345, received by accounts"
                  value={settleForm.notes}
                  onChange={(e) => setSettleForm({ ...settleForm, notes: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#e2e8f0' }}>
                  <input
                    type="checkbox"
                    checked={settleForm.isFullClearance}
                    onChange={(e) => setSettleForm({ ...settleForm, isFullClearance: e.target.checked })}
                  />
                  <span>Mark as 100% Fully Cleared & Settled</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="nexus-btn nexus-btn-ghost"
                  onClick={() => setSettleModalOpen(false)}
                  disabled={settling}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="nexus-btn nexus-btn-primary"
                  disabled={settling}
                >
                  {settling ? 'Settling...' : 'Confirm Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
