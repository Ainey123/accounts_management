"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DollarSign, UploadCloud, RefreshCw, Filter, Search, Plus, Trash2,
  CheckCircle, AlertCircle, XCircle, Clock, Eye, Download, FileText,
  Building, Check, X, ShieldCheck, ArrowUpRight, ArrowDownLeft,
  ChevronRight, Calendar, User, Tag, HelpCircle, Layers, FileSpreadsheet
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function ReconciliationModule({
  users = [],
  employeeAliases = {},
  adminPostingName = 'Fatma',
  onNavigateToTab,
}) {
  // ── Tab state within module ──────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState('grid'); // 'grid' | 'other' | 'statements' | 'audits'

  // ── Global KPI stats ─────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // ── Expenses & Grid state ────────────────────────────────────────────────
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);

  // ── Other Expenses state ─────────────────────────────────────────────────
  const [otherExpenses, setOtherExpenses] = useState([]);
  const [loadingOtherExpenses, setLoadingOtherExpenses] = useState(false);

  // ── Statements & Transactions state ──────────────────────────────────────
  const [statements, setStatements] = useState([]);
  const [loadingStatements, setLoadingStatements] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // ── Filter Controls State ────────────────────────────────────────────────
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [filterTenureMode, setFilterTenureMode] = useState('month'); // 'month' | 'custom'
  const [filterMonth, setFilterMonth] = useState('2026-08');
  const [filterStartDate, setFilterStartDate] = useState('2026-08-01');
  const [filterEndDate, setFilterEndDate] = useState('2026-08-31');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStatement, setFilterStatement] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Modals State ─────────────────────────────────────────────────────────
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadBankName, setUploadBankName] = useState('Meezan Bank');
  const [uploading, setUploading] = useState(false);

  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedExpenseForAdjust, setSelectedExpenseForAdjust] = useState(null);
  const [adjustAmountInput, setAdjustAmountInput] = useState('');
  const [adjustCommentInput, setAdjustCommentInput] = useState('');
  const [selectedTxIdForMatch, setSelectedTxIdForMatch] = useState('');
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const [otherExpenseModalOpen, setOtherExpenseModalOpen] = useState(false);
  const [otherExpenseForm, setOtherExpenseForm] = useState({
    expenseDate: new Date().toISOString().slice(0, 10),
    category: 'Office & Operations',
    amount: '',
    paidTo: '',
    bankName: 'Meezan Bank',
    paymentMethod: 'Bank Transfer',
    description: '',
    referenceNo: '',
    attachmentUrl: '',
    adminNotes: '',
  });
  const [savingOtherExpense, setSavingOtherExpense] = useState(false);

  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [notification, setNotification] = useState({ message: '', type: 'success' });
  const [autoMatching, setAutoMatching] = useState(false);

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification({ message: '', type: 'success' }), 4000);
  };

  // ── Batch mapping helper ─────────────────────────────────────────────────
  const getMappedEmployeeName = (rawName) => {
    if (!rawName) return 'Unassigned';
    return employeeAliases[rawName] || rawName;
  };

  // ── Data Fetching ────────────────────────────────────────────────────────
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      let url = `/api/admin/reconciliation/stats?`;
      if (filterTenureMode === 'month' && filterMonth) {
        url += `month=${filterMonth}&`;
      } else if (filterTenureMode === 'custom') {
        if (filterStartDate) url += `startDate=${filterStartDate}&`;
        if (filterEndDate) url += `endDate=${filterEndDate}&`;
      }
      if (selectedEmployee !== 'all') url += `employeeId=${selectedEmployee}&`;

      const res = await apiFetch(url);
      if (res.success) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Error fetching reconciliation stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchExpenses = async () => {
    setLoadingExpenses(true);
    try {
      let url = `/api/admin/reconciliation/expenses?`;
      if (filterTenureMode === 'month' && filterMonth) {
        url += `month=${filterMonth}&`;
      } else if (filterTenureMode === 'custom') {
        if (filterStartDate) url += `startDate=${filterStartDate}&`;
        if (filterEndDate) url += `endDate=${filterEndDate}&`;
      }
      if (selectedEmployee !== 'all') url += `employeeId=${selectedEmployee}&`;
      if (filterStatus !== 'all') url += `status=${filterStatus}&`;
      if (filterCategory !== 'all') url += `category=${filterCategory}&`;
      if (filterStatement !== 'all') url += `statementId=${filterStatement}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;

      const res = await apiFetch(url);
      if (res.success) {
        setExpenses(res.expenses || []);
      }
    } catch (err) {
      console.error('Error fetching reconciliation expenses:', err);
    } finally {
      setLoadingExpenses(false);
    }
  };

  const fetchOtherExpenses = async () => {
    setLoadingOtherExpenses(true);
    try {
      let url = `/api/admin/reconciliation/other-expenses?`;
      if (filterTenureMode === 'month' && filterMonth) {
        url += `month=${filterMonth}&`;
      } else if (filterTenureMode === 'custom') {
        if (filterStartDate) url += `startDate=${filterStartDate}&`;
        if (filterEndDate) url += `endDate=${filterEndDate}&`;
      }
      if (filterCategory !== 'all') url += `category=${filterCategory}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;

      const res = await apiFetch(url);
      if (res.success) {
        setOtherExpenses(res.otherExpenses || []);
      }
    } catch (err) {
      console.error('Error fetching other expenses:', err);
    } finally {
      setLoadingOtherExpenses(false);
    }
  };

  const fetchStatements = async () => {
    setLoadingStatements(true);
    try {
      const res = await apiFetch('/api/admin/reconciliation/statements');
      if (res.success) {
        setStatements(res.statements || []);
      }
    } catch (err) {
      console.error('Error fetching statements:', err);
    } finally {
      setLoadingStatements(false);
    }
  };

  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const res = await apiFetch('/api/admin/reconciliation/transactions?debitsOnly=true');
      if (res.success) {
        setTransactions(res.transactions || []);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const reloadAll = async () => {
    await Promise.all([
      fetchStats(),
      fetchExpenses(),
      fetchOtherExpenses(),
      fetchStatements(),
      fetchTransactions(),
    ]);
  };

  useEffect(() => {
    reloadAll();
  }, [filterTenureMode, filterMonth, filterStartDate, filterEndDate, selectedEmployee, filterStatus, filterCategory, filterStatement]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExpenses();
      fetchOtherExpenses();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Auto-Reconciliation Handler ──────────────────────────────────────────
  const handleRunAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const res = await apiFetch('/api/admin/reconciliation/match', {
        method: 'POST',
        body: JSON.stringify({
          action: 'auto',
          adminName: adminPostingName,
        }),
      });
      if (res.success) {
        showNotification(res.message, 'success');
        await reloadAll();
      } else {
        showNotification(res.error || 'Auto-matching failed', 'error');
      }
    } catch (err) {
      showNotification(err.message || 'Auto-matching failed', 'error');
    } finally {
      setAutoMatching(false);
    }
  };

  // ── Statement Upload Handler ─────────────────────────────────────────────
  const handleStatementUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please select a bank statement file (PDF, CSV, Excel, Image)');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('bankName', uploadBankName);
      formData.append('adminName', adminPostingName);

      const res = await fetch('/api/admin/reconciliation/statements', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload statement');
      }

      showNotification(data.message || 'Statement uploaded & parsed successfully!', 'success');
      setUploadModalOpen(false);
      setUploadFile(null);
      await reloadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Delete Statement Handler ─────────────────────────────────────────────
  const handleDeleteStatement = async (id, fileName) => {
    if (!confirm(`Are you sure you want to delete statement "${fileName}"? Any matched expenses will be reset to Unmatched.`)) {
      return;
    }
    try {
      const res = await apiFetch(`/api/admin/reconciliation/statements?id=${id}&adminName=${encodeURIComponent(adminPostingName)}`, {
        method: 'DELETE',
      });
      if (res.success) {
        showNotification(res.message, 'success');
        await reloadAll();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Open Manual Adjust Modal ─────────────────────────────────────────────
  const handleOpenAdjustModal = (expense) => {
    setSelectedExpenseForAdjust(expense);
    setAdjustAmountInput(expense.adjustedAmount > 0 ? String(expense.adjustedAmount) : String(expense.amount));
    setAdjustCommentInput('');
    setSelectedTxIdForMatch(expense.bankTransactionId ? String(expense.bankTransactionId) : '');
    setTxSearchQuery('');
    setAdjustModalOpen(true);
  };

  // ── Save Manual Adjustment ───────────────────────────────────────────────
  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedExpenseForAdjust) return;

    setAdjusting(true);
    try {
      const res = await apiFetch('/api/admin/reconciliation/match', {
        method: 'POST',
        body: JSON.stringify({
          action: 'manual',
          expenseId: selectedExpenseForAdjust.id,
          bankTransactionId: selectedTxIdForMatch || null,
          adjustedAmount: parseFloat(adjustAmountInput) || 0,
          comment: adjustCommentInput,
          adminName: adminPostingName,
        }),
      });

      if (res.success) {
        showNotification(res.message, 'success');
        setAdjustModalOpen(false);
        setSelectedExpenseForAdjust(null);
        await reloadAll();
      } else {
        alert(res.error || 'Adjustment failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setAdjusting(false);
    }
  };

  // ── Unmatch Expense Handler ──────────────────────────────────────────────
  const handleUnmatchExpense = async (expenseId) => {
    if (!confirm(`Reset Expense #${expenseId} to Unmatched and release the bank transaction link?`)) return;
    try {
      const res = await apiFetch('/api/admin/reconciliation/match', {
        method: 'POST',
        body: JSON.stringify({
          action: 'unmatch',
          expenseId,
          adminName: adminPostingName,
        }),
      });

      if (res.success) {
        showNotification(res.message, 'success');
        await reloadAll();
      } else {
        alert(res.error || 'Unmatch failed');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Other Expense Handlers ───────────────────────────────────────────────
  const handleSaveOtherExpense = async (e) => {
    e.preventDefault();
    if (!otherExpenseForm.amount || !otherExpenseForm.description) {
      alert('Please fill all required fields');
      return;
    }

    setSavingOtherExpense(true);
    try {
      const res = await apiFetch('/api/admin/reconciliation/other-expenses', {
        method: 'POST',
        body: JSON.stringify({
          ...otherExpenseForm,
          adminName: adminPostingName,
        }),
      });

      if (res.success) {
        showNotification(res.message, 'success');
        setOtherExpenseModalOpen(false);
        setOtherExpenseForm({
          expenseDate: new Date().toISOString().slice(0, 10),
          category: 'Office & Operations',
          amount: '',
          paidTo: '',
          bankName: 'Meezan Bank',
          paymentMethod: 'Bank Transfer',
          description: '',
          referenceNo: '',
          attachmentUrl: '',
          adminNotes: '',
        });
        await reloadAll();
      } else {
        alert(res.error || 'Failed to save expense');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingOtherExpense(false);
    }
  };

  const handleDeleteOtherExpense = async (id) => {
    if (!confirm(`Delete this other expense record #${id}?`)) return;
    try {
      const res = await apiFetch(`/api/admin/reconciliation/other-expenses?id=${id}&adminName=${encodeURIComponent(adminPostingName)}`, {
        method: 'DELETE',
      });
      if (res.success) {
        showNotification(res.message, 'success');
        await reloadAll();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // ── CSV Export Handler ───────────────────────────────────────────────────
  const handleExportCSV = () => {
    let url = `/api/admin/reconciliation/export?format=csv&`;
    if (filterTenureMode === 'month' && filterMonth) {
      url += `month=${filterMonth}&`;
    } else if (filterTenureMode === 'custom') {
      if (filterStartDate) url += `startDate=${filterStartDate}&`;
      if (filterEndDate) url += `endDate=${filterEndDate}&`;
    }
    if (selectedEmployee !== 'all') url += `employeeId=${selectedEmployee}&`;
    if (filterStatus !== 'all') url += `status=${filterStatus}&`;

    window.open(url, '_blank');
  };

  // ── Client-side PDF Generation Handler ───────────────────────────────────
  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      // Document Header
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 842, 65, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('NEXUS OPERATIONS — EMPLOYEE EXPENSE RECONCILIATION REPORT', 30, 32);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      const tenureText = filterTenureMode === 'month' ? `Month: ${filterMonth}` : `Period: ${filterStartDate} to ${filterEndDate}`;
      doc.text(`${tenureText} | Generated on ${new Date().toLocaleString()} by ${adminPostingName}`, 30, 48);

      // KPI Metric Cards Box
      doc.setFillColor(248, 250, 252);
      doc.rect(30, 80, 782, 45, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(30, 80, 782, 45, 'S');

      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');

      const colW = 782 / 4;
      doc.text(`Total Claimed: Rs. ${(stats?.totalClaimed || 0).toLocaleString()}`, 45, 107);
      doc.text(`Total Adjusted: Rs. ${(stats?.totalAdjusted || 0).toLocaleString()}`, 45 + colW, 107);
      doc.text(`Total Unmatched: Rs. ${(stats?.totalUnmatched || 0).toLocaleString()}`, 45 + colW * 2, 107);
      doc.text(`Other Expenses: Rs. ${(stats?.totalOtherExpenses || 0).toLocaleString()}`, 45 + colW * 3, 107);

      // Table Header
      let y = 145;
      doc.setFillColor(241, 245, 249);
      doc.rect(30, y, 782, 22, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.line(30, y + 22, 812, y + 22);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);

      doc.text('DATE', 35, y + 14);
      doc.text('EMPLOYEE', 100, y + 14);
      doc.text('COMPLAINT / REF', 210, y + 14);
      doc.text('CATEGORY / SUMMARY', 320, y + 14);
      doc.text('CLAIMED (RS.)', 480, y + 14);
      doc.text('ADJUSTED (RS.)', 560, y + 14);
      doc.text('STATUS', 645, y + 14);
      doc.text('BANK NARRATION / REF', 715, y + 14);

      y += 24;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      expenses.slice(0, 30).forEach((e, idx) => {
        if (y > 540) {
          doc.addPage();
          y = 40;
        }

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(30, y - 2, 782, 18, 'F');
        }

        const dateStr = new Date(e.expenseDate || e.createdAt).toLocaleDateString();
        const empName = getMappedEmployeeName(e.createdBy?.employeeName || e.jobMetadata?.assignedEmployee?.employeeName || 'N/A');
        const serial = `${e.jobMetadata?.ticket?.serialNo || '—'} (${(e.jobMetadata?.clientName || 'Site').slice(0, 12)})`;
        const summary = (e.summaryNotes || e.category || 'Site Expense').slice(0, 28);
        const claimed = `Rs. ${(e.amount || 0).toLocaleString()}`;
        const adjusted = `Rs. ${(e.adjustedAmount || 0).toLocaleString()}`;
        const status = e.status || 'UNMATCHED';
        const bankInfo = (e.bankTransaction?.description || e.bankTransaction?.statement?.bankName || '—').slice(0, 18);

        doc.setTextColor(15, 23, 42);
        doc.text(dateStr, 35, y + 10);
        doc.text(empName.slice(0, 18), 100, y + 10);
        doc.text(serial, 210, y + 10);
        doc.text(summary, 320, y + 10);
        doc.text(claimed, 480, y + 10);

        doc.setTextColor(e.adjustedAmount > 0 ? 22 : 100, e.adjustedAmount > 0 ? 197 : 100, e.adjustedAmount > 0 ? 94 : 100);
        doc.text(adjusted, 560, y + 10);

        doc.setTextColor(15, 23, 42);
        doc.text(status, 645, y + 10);
        doc.text(bankInfo, 715, y + 10);

        y += 18;
      });

      // Signature & Stamp footer
      if (y > 500) {
        doc.addPage();
        y = 50;
      }
      y += 30;
      doc.setDrawColor(148, 163, 184);
      doc.line(100, y + 30, 250, y + 30);
      doc.text('Prepared By: Accounts Officer', 100, y + 45);

      doc.line(550, y + 30, 700, y + 30);
      doc.text('Authorized Signature / Management Stamp', 550, y + 45);

      doc.save(`Expense_Reconciliation_Report_${filterMonth || 'Period'}.pdf`);
      showNotification('PDF report exported successfully!', 'success');
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF: ' + err.message);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'MATCHED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
            <CheckCircle size={13} /> MATCHED
          </span>
        );
      case 'PARTIALLY_MATCHED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
            <Clock size={13} /> PARTIAL
          </span>
        );
      case 'REVIEW_REQUIRED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
            <AlertCircle size={13} /> REVIEW REQ
          </span>
        );
      case 'MANUALLY_ADJUSTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,242,254,0.15)', color: '#00f2fe', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
            <ShieldCheck size={13} /> ADJUSTED
          </span>
        );
      case 'UNMATCHED':
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
            <XCircle size={13} /> UNMATCHED
          </span>
        );
    }
  };

  // Filtered transactions for Manual Match modal
  const filteredModalTransactions = useMemo(() => {
    if (!transactions) return [];
    if (!txSearchQuery) return transactions.slice(0, 30);
    const q = txSearchQuery.toLowerCase();
    return transactions.filter((t) => {
      return (
        t.description?.toLowerCase().includes(q) ||
        t.referenceNo?.toLowerCase().includes(q) ||
        t.statement?.bankName?.toLowerCase().includes(q) ||
        String(t.debit).includes(q)
      );
    }).slice(0, 50);
  }, [transactions, txSearchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Toast Notification */}
      {notification.message && (
        <div style={{
          background: notification.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
          border: `1px solid ${notification.type === 'error' ? '#ef4444' : '#22c55e'}`,
          color: notification.type === 'error' ? '#f87171' : '#4ade80',
          padding: '12px 18px',
          borderRadius: 10,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
        }}>
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ── TOP ACTION & TITLE BAR ────────────────────────────────────────── */}
      <section className="glass-card" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}>
              <FileSpreadsheet size={26} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: 20, margin: 0, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.3px' }}>
                Employee Expense Reconciliation & Bank Statement Verification
              </h2>
              <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0 0' }}>
                Reconcile site complaints & company expenses against uploaded bank statement debits
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setUploadModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #0284c7, #0369a1)', borderColor: '#38bdf8' }}
            >
              <UploadCloud size={16} />
              <span>+ Upload Statement</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setOtherExpenseModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', borderColor: '#a78bfa' }}
            >
              <Plus size={16} />
              <span>+ Other Expense</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              disabled={autoMatching}
              onClick={handleRunAutoMatch}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #10b981, #047857)', borderColor: '#34d399' }}
            >
              <RefreshCw size={16} className={autoMatching ? 'spin' : ''} />
              <span>{autoMatching ? 'Matching...' : 'Run Auto-Match'}</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportPDF}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Download size={15} />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <FileSpreadsheet size={15} />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── 4 KPI SUMMARY CARDS ────────────────────────────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {/* Card 1: Total Claimed */}
        <div className="glass-card" style={{ padding: '22px 20px', border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.04)', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Claimed Expenses</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} color="#3b82f6" />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#3b82f6', lineHeight: 1.1 }}>
            Rs. {(stats?.totalClaimed || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
            {stats?.claimedCount || 0} Total Site Expense Claims
          </div>
        </div>

        {/* Card 2: Total Adjusted */}
        <div className="glass-card" style={{ padding: '22px 20px', border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.04)', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Adjusted</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={18} color="#22c55e" />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#22c55e', lineHeight: 1.1 }}>
            Rs. {(stats?.totalAdjusted || 0).toLocaleString()}
          </div>
          <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.round(((stats?.totalAdjusted || 0) / Math.max(1, stats?.totalClaimed || 1)) * 100))}%`,
              background: 'linear-gradient(90deg, #22c55e, #4ade80)'
            }} />
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
            {stats?.totalClaimed ? Math.round(((stats.totalAdjusted || 0) / stats.totalClaimed) * 100) : 0}% Reconciled vs Bank
          </div>
        </div>

        {/* Card 3: Total Unmatched */}
        <div className="glass-card" style={{ padding: '22px 20px', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Unmatched</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={18} color="#ef4444" />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#ef4444', lineHeight: 1.1 }}>
            Rs. {(stats?.totalUnmatched || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
            {(stats?.statusCounts?.UNMATCHED || 0) + (stats?.statusCounts?.REVIEW_REQUIRED || 0)} Pending Verification
          </div>
        </div>

        {/* Card 4: Other Expenses */}
        <div className="glass-card" style={{ padding: '22px 20px', border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.04)', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Other Company Expenses</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={18} color="#a78bfa" />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#a78bfa', lineHeight: 1.1 }}>
            Rs. {(stats?.totalOtherExpenses || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
            {stats?.otherExpensesCount || 0} Non-Complaint Records
          </div>
        </div>
      </section>

      {/* ── FILTER CONTROLS & SUB-TABS ────────────────────────────────────── */}
      <section className="glass-card" style={{ padding: '20px 24px' }}>
        {/* Sub-tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'grid', label: `Reconciliation Grid (${expenses.length})`, icon: Layers },
              { id: 'other', label: `Other Expenses (${otherExpenses.length})`, icon: Building },
              { id: 'statements', label: `Bank Statements (${statements.length})`, icon: FileSpreadsheet },
            ].map((st) => {
              const Icon = st.icon;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setActiveSubTab(st.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: activeSubTab === st.id ? 'rgba(0,242,254,0.15)' : 'rgba(255,255,255,0.03)',
                    color: activeSubTab === st.id ? '#00f2fe' : '#94a3b8',
                    border: `1px solid ${activeSubTab === st.id ? 'rgba(0,242,254,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <Icon size={15} />
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Refresh */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={reloadAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
          >
            <RefreshCw size={14} className={loadingExpenses ? 'spin' : ''} />
            <span>Refresh Grid</span>
          </button>
        </div>

        {/* Filters Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, alignItems: 'center' }}>
          {/* Employee Filter */}
          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Employee</label>
            <select
              className="form-control"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              style={{ fontSize: 13, background: 'rgba(0,0,0,0.3)' }}
            >
              <option value="all">All Employees</option>
              {users.filter(u => u.role === 'EMPLOYEE').map((u) => (
                <option key={u.id} value={u.id}>
                  {getMappedEmployeeName(u.employeeName)}
                </option>
              ))}
            </select>
          </div>

          {/* Tenure Mode Toggle & Month / Range */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Tenure</label>
              <button
                type="button"
                onClick={() => setFilterTenureMode(m => m === 'month' ? 'custom' : 'month')}
                style={{ background: 'none', border: 'none', color: '#00f2fe', fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {filterTenureMode === 'month' ? 'Custom Range' : 'By Month'}
              </button>
            </div>
            {filterTenureMode === 'month' ? (
              <input
                type="month"
                className="form-control"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                style={{ fontSize: 13, background: 'rgba(0,0,0,0.3)' }}
              />
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="date"
                  className="form-control"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  style={{ fontSize: 11, padding: '6px 8px', background: 'rgba(0,0,0,0.3)' }}
                />
                <input
                  type="date"
                  className="form-control"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  style={{ fontSize: 11, padding: '6px 8px', background: 'rgba(0,0,0,0.3)' }}
                />
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Match Status</label>
            <select
              className="form-control"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ fontSize: 13, background: 'rgba(0,0,0,0.3)' }}
            >
              <option value="all">All Statuses</option>
              <option value="MATCHED">Matched</option>
              <option value="PARTIALLY_MATCHED">Partially Matched</option>
              <option value="UNMATCHED">Unmatched</option>
              <option value="REVIEW_REQUIRED">Review Required</option>
              <option value="MANUALLY_ADJUSTED">Manually Adjusted</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Category</label>
            <select
              className="form-control"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ fontSize: 13, background: 'rgba(0,0,0,0.3)' }}
            >
              <option value="all">All Categories</option>
              <option value="Site Expense">Site Expense</option>
              <option value="Fuel">Fuel & Travel</option>
              <option value="Spare Parts">Spare Parts</option>
              <option value="Hardware">Hardware / Material</option>
              <option value="Office & Operations">Office & Operations</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>

          {/* Statement Session Filter */}
          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Statement Session</label>
            <select
              className="form-control"
              value={filterStatement}
              onChange={(e) => setFilterStatement(e.target.value)}
              style={{ fontSize: 13, background: 'rgba(0,0,0,0.3)' }}
            >
              <option value="all">All Statements</option>
              {statements.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id} - {s.bankName} ({new Date(s.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>Live Search</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search employee, complaint serial, client, bank narration, amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 34, fontSize: 13, background: 'rgba(0,0,0,0.3)' }}
              />
              <Search size={16} color="#64748b" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── SUB-TAB 1: RECONCILIATION DATA GRID ─────────────────────────────── */}
      {activeSubTab === 'grid' && (
        <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} color="#00f2fe" />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc' }}>
                Employee Expense Reconciliation Matrix ({expenses.length} Records)
              </span>
            </div>
          </div>

          {loadingExpenses ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
              <div>Loading reconciliation data...</div>
            </div>
          ) : expenses.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
              <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div style={{ fontSize: 15, fontWeight: 600 }}>No expense records found matching current filters.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Try clearing search or switching month / employee filters.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ margin: 0, width: '100%' }}>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Employee</th>
                    <th>Complaint / Job Ref</th>
                    <th>Category & Notes</th>
                    <th style={{ textAlign: 'right' }}>Claimed (Rs.)</th>
                    <th style={{ textAlign: 'right' }}>Adjusted (Rs.)</th>
                    <th style={{ textAlign: 'right' }}>Remaining (Rs.)</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>Bank Transaction Verification</th>
                    <th style={{ textAlign: 'center' }}>Receipt</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => {
                    const empName = getMappedEmployeeName(e.createdBy?.employeeName || e.jobMetadata?.assignedEmployee?.employeeName);
                    const ticketSerial = e.jobMetadata?.ticket?.serialNo;
                    const clientName = e.jobMetadata?.clientName;
                    const branchName = e.jobMetadata?.branchName;
                    const dateStr = new Date(e.expenseDate || e.createdAt).toLocaleDateString();
                    const timeStr = new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const remaining = e.remainingAmount !== null && e.remainingAmount !== undefined ? e.remainingAmount : Math.max(0, e.amount - (e.adjustedAmount || 0));

                    return (
                      <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {/* Date */}
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#f8fafc' }}>{dateStr}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{timeStr}</div>
                        </td>

                        {/* Employee */}
                        <td>
                          <div style={{ fontWeight: 700, color: '#00f2fe', fontSize: 13 }}>{empName}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>ID #{e.id}</div>
                        </td>

                        {/* Complaint / Job Ref */}
                        <td>
                          {ticketSerial ? (
                            <div>
                              <div style={{ display: 'inline-block', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                                #{ticketSerial}
                              </div>
                              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{clientName} — {branchName}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: 11 }}>Direct Expense</span>
                          )}
                        </td>

                        {/* Category & Notes */}
                        <td style={{ maxWidth: 220 }}>
                          <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4, fontSize: 10, color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 600 }}>
                            {e.category || 'Site Expense'}
                          </span>
                          <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.summaryNotes}>
                            {e.summaryNotes || '—'}
                          </div>
                        </td>

                        {/* Claimed Amount */}
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#f8fafc', fontSize: 13 }}>
                          Rs. {e.amount.toLocaleString()}
                        </td>

                        {/* Adjusted Amount */}
                        <td style={{ textAlign: 'right', fontWeight: 700, color: e.adjustedAmount > 0 ? '#22c55e' : '#64748b', fontSize: 13 }}>
                          Rs. {(e.adjustedAmount || 0).toLocaleString()}
                        </td>

                        {/* Remaining Amount */}
                        <td style={{ textAlign: 'right', fontWeight: 700, color: remaining > 0 ? '#ef4444' : '#22c55e', fontSize: 13 }}>
                          Rs. {remaining.toLocaleString()}
                        </td>

                        {/* Status Badge */}
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {renderStatusBadge(e.status)}
                        </td>

                        {/* Bank Transaction Verification Details */}
                        <td style={{ maxWidth: 240 }}>
                          {e.bankTransaction ? (
                            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', padding: '6px 10px', borderRadius: 6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#34d399' }}>
                                <span>{e.bankTransaction.statement?.bankName || 'Bank Debit'}</span>
                                <span>Rs. {e.bankTransaction.debit.toLocaleString()}</span>
                              </div>
                              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.bankTransaction.description}>
                                {e.bankTransaction.description}
                              </div>
                              <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>
                                {new Date(e.bankTransaction.transactionDate).toLocaleDateString()} {e.bankTransaction.referenceNo ? `| Ref: ${e.bankTransaction.referenceNo}` : ''}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>No bank transaction linked</span>
                          )}
                        </td>

                        {/* Receipt Thumbnail */}
                        <td style={{ textAlign: 'center' }}>
                          {e.imageUrl ? (
                            <button
                              type="button"
                              onClick={() => setImagePreviewUrl(e.imageUrl)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              title="Click to view receipt"
                            >
                              <img
                                src={e.imageUrl}
                                alt="Receipt"
                                style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)' }}
                              />
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: '#64748b' }}>—</span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleOpenAdjustModal(e)}
                              style={{ padding: '4px 10px', fontSize: 11, borderColor: '#38bdf8', color: '#38bdf8' }}
                              title="Adjust or match against bank statement"
                            >
                              Match / Adjust
                            </button>

                            {e.status !== 'UNMATCHED' && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleUnmatchExpense(e.id)}
                                style={{ padding: '4px 8px', fontSize: 11, borderColor: '#ef4444', color: '#f87171' }}
                                title="Unlink and reset to Unmatched"
                              >
                                <X size={13} />
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
      )}

      {/* ── SUB-TAB 2: OTHER EXPENSES ───────────────────────────────────────── */}
      {activeSubTab === 'other' && (
        <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building size={18} color="#a78bfa" />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc' }}>
                Other Company Expenses (Non-Complaint Records)
              </span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setOtherExpenseModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
            >
              <Plus size={14} />
              <span>Record Other Expense</span>
            </button>
          </div>

          {loadingOtherExpenses ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
              <div>Loading company expenses...</div>
            </div>
          ) : otherExpenses.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
              <Building size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div style={{ fontSize: 15, fontWeight: 600 }}>No other expense records found.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Click "+ Other Expense" to log office rent, salaries, utilities, etc.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ margin: 0, width: '100%' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Paid To / Vendor</th>
                    <th>Description / Purpose</th>
                    <th>Payment Method / Bank</th>
                    <th style={{ textAlign: 'right' }}>Amount (Rs.)</th>
                    <th>Reference / Chq No</th>
                    <th>Admin Notes</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {otherExpenses.map((o) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ fontWeight: 600, fontSize: 13, color: '#f8fafc', whiteSpace: 'nowrap' }}>
                        {new Date(o.expenseDate).toLocaleDateString()}
                      </td>
                      <td>
                        <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                          {o.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#00f2fe', fontSize: 13 }}>
                        {o.paidTo}
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <div style={{ fontSize: 12, color: '#cbd5e1' }}>{o.description}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{o.paymentMethod || 'Bank Transfer'}</div>
                        {o.bankName && <div style={{ fontSize: 10, color: '#64748b' }}>{o.bankName}</div>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#f8fafc', fontSize: 14 }}>
                        Rs. {o.amount.toLocaleString()}
                      </td>
                      <td style={{ fontSize: 11, color: '#94a3b8' }}>
                        {o.referenceNo || '—'}
                      </td>
                      <td style={{ fontSize: 11, color: '#64748b', maxWidth: 180 }}>
                        {o.adminNotes || '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteOtherExpense(o.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                          title="Delete other expense"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── SUB-TAB 3: BANK STATEMENTS & TRANSACTIONS ────────────────────────── */}
      {activeSubTab === 'statements' && (
        <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSpreadsheet size={18} color="#10b981" />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc' }}>
                Uploaded Bank Statements ({statements.length} Files)
              </span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setUploadModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px', background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}
            >
              <UploadCloud size={14} />
              <span>Upload New Statement</span>
            </button>
          </div>

          {loadingStatements ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
              <div>Loading statements...</div>
            </div>
          ) : statements.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
              <FileSpreadsheet size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div style={{ fontSize: 15, fontWeight: 600 }}>No bank statements uploaded yet.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Upload your bank statement PDF, CSV, or Excel file to begin automatic verification.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ margin: 0, width: '100%' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Bank Name</th>
                    <th>File Name</th>
                    <th>Statement Period</th>
                    <th style={{ textAlign: 'center' }}>Transactions</th>
                    <th style={{ textAlign: 'right' }}>Total Debits (Rs.)</th>
                    <th style={{ textAlign: 'right' }}>Total Credits (Rs.)</th>
                    <th>Uploaded At</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {statements.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ fontWeight: 700, color: '#94a3b8' }}>#{s.id}</td>
                      <td style={{ fontWeight: 700, color: '#34d399', fontSize: 13 }}>
                        {s.bankName}
                      </td>
                      <td style={{ color: '#f8fafc', fontSize: 12 }}>
                        {s.fileName}
                        <span style={{ marginLeft: 6, fontSize: 10, color: '#64748b' }}>({s.fileType})</span>
                      </td>
                      <td style={{ fontSize: 12, color: '#cbd5e1' }}>
                        {s.statementPeriod || '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 12 }}>
                          {s.transactionCount || s._count?.transactions || 0}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444', fontSize: 13 }}>
                        Rs. {(s.totalDebits || 0).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#22c55e', fontSize: 13 }}>
                        Rs. {(s.totalCredits || 0).toLocaleString()}
                      </td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>
                        {new Date(s.createdAt).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteStatement(s.id, s.fileName)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                          title="Delete statement and reset linked transactions"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── MODAL 1: UPLOAD BANK STATEMENT ─────────────────────────────────── */}
      {uploadModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UploadCloud size={22} color="#00f2fe" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Upload Bank Statement</h3>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleStatementUpload}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="field-label" style={{ marginBottom: 6 }}>Bank Institution</label>
                  <select
                    className="form-control"
                    value={uploadBankName}
                    onChange={(e) => setUploadBankName(e.target.value)}
                    required
                  >
                    <option value="Meezan Bank">Meezan Bank</option>
                    <option value="HBL">Habib Bank Limited (HBL)</option>
                    <option value="UBL">United Bank Limited (UBL)</option>
                    <option value="MCB Bank">MCB Bank</option>
                    <option value="Allied Bank">Allied Bank (ABL)</option>
                    <option value="Faysal Bank">Faysal Bank</option>
                    <option value="Bank Alfalah">Bank Alfalah</option>
                    <option value="Standard Chartered">Standard Chartered</option>
                    <option value="Askari Bank">Askari Bank</option>
                    <option value="Dubai Islamic Bank">Dubai Islamic Bank</option>
                    <option value="JS Bank">JS Bank</option>
                    <option value="Other / Auto-Detect">Other / Auto-Detect</option>
                  </select>
                </div>

                <div>
                  <label className="field-label" style={{ marginBottom: 6 }}>Select File (PDF, CSV, XLSX, XLS, Image)</label>
                  <div style={{
                    border: '2px dashed rgba(0,242,254,0.3)',
                    borderRadius: 12,
                    padding: '24px 16px',
                    textAlign: 'center',
                    background: 'rgba(0,0,0,0.2)',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="file"
                      accept=".pdf,.csv,.xlsx,.xls,.txt,.tsv,.jpg,.jpeg,.png"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      style={{ display: 'block', margin: '0 auto', fontSize: 12, color: '#94a3b8' }}
                      required
                    />
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                      Supports all major bank statements with automated Debit & Credit parsing
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(0,242,254,0.05)', border: '1px solid rgba(0,242,254,0.2)', borderRadius: 8, padding: 12, fontSize: 12, color: '#94a3b8' }}>
                  <div style={{ fontWeight: 700, color: '#00f2fe', marginBottom: 2 }}>Automatic Deduplication Protection</div>
                  SHA-256 fingerprinting ensures duplicate files and repeated transactions are never inserted twice.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setUploadModalOpen(false)}
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={uploading}
                    style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <UploadCloud size={16} className={uploading ? 'spin' : ''} />
                    <span>{uploading ? 'Parsing Statement...' : 'Upload & Parse'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: MANUAL ADJUSTMENT & MATCHING ──────────────────────────── */}
      {adjustModalOpen && selectedExpenseForAdjust && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={22} color="#00f2fe" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Manual Match & Adjustment — Expense #{selectedExpenseForAdjust.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAdjustModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Expense Details Banner */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 12 }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Employee:</span>
                      <div style={{ fontWeight: 700, color: '#00f2fe' }}>
                        {getMappedEmployeeName(selectedExpenseForAdjust.createdBy?.employeeName || selectedExpenseForAdjust.jobMetadata?.assignedEmployee?.employeeName)}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Claimed Amount:</span>
                      <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: 14 }}>
                        Rs. {selectedExpenseForAdjust.amount.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Complaint Serial:</span>
                      <div style={{ fontWeight: 700, color: '#a78bfa' }}>
                        {selectedExpenseForAdjust.jobMetadata?.ticket?.serialNo || 'Direct Entry'}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
                    Notes: {selectedExpenseForAdjust.summaryNotes}
                  </div>
                </div>

                {/* Adjusted Amount Input */}
                <div>
                  <label className="field-label" style={{ marginBottom: 6 }}>Reconciled / Adjusted Amount (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={adjustAmountInput}
                    onChange={(e) => setAdjustAmountInput(e.target.value)}
                    required
                    style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}
                  />
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Remaining balance: Rs. {Math.max(0, selectedExpenseForAdjust.amount - (parseFloat(adjustAmountInput) || 0)).toLocaleString()}
                  </div>
                </div>

                {/* Link to Bank Transaction Selection */}
                <div>
                  <label className="field-label" style={{ marginBottom: 6 }}>Link to Bank Transaction (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search bank transactions by narration or amount..."
                    value={txSearchQuery}
                    onChange={(e) => setTxSearchQuery(e.target.value)}
                    style={{ fontSize: 12, marginBottom: 8 }}
                  />
                  <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>
                    <div
                      onClick={() => setSelectedTxIdForMatch('')}
                      style={{
                        padding: '8px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        background: selectedTxIdForMatch === '' ? 'rgba(0,242,254,0.1)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        color: selectedTxIdForMatch === '' ? '#00f2fe' : '#94a3b8',
                      }}
                    >
                      (None / Direct Cash or Non-Statement Adjustment)
                    </div>
                    {filteredModalTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        onClick={() => {
                          setSelectedTxIdForMatch(String(tx.id));
                          if (!adjustAmountInput || parseFloat(adjustAmountInput) === 0) {
                            setAdjustAmountInput(String(Math.min(selectedExpenseForAdjust.amount, tx.debit)));
                          }
                        }}
                        style={{
                          padding: '8px 12px',
                          fontSize: 12,
                          cursor: 'pointer',
                          background: selectedTxIdForMatch === String(tx.id) ? 'rgba(0,242,254,0.15)' : 'transparent',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                            {tx.statement?.bankName || 'Bank'} — {tx.description}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>
                            {new Date(tx.transactionDate).toLocaleDateString()} {tx.referenceNo ? `| Ref: ${tx.referenceNo}` : ''}
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, color: '#ef4444', textAlign: 'right' }}>
                          Rs. {tx.debit.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Permanent Admin Comment */}
                <div>
                  <label className="field-label" style={{ marginBottom: 6 }}>Admin Audit Comment / Justification</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Enter reason for adjustment or bank transaction notes..."
                    value={adjustCommentInput}
                    onChange={(e) => setAdjustCommentInput(e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setAdjustModalOpen(false)}
                    disabled={adjusting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={adjusting}
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Check size={16} className={adjusting ? 'spin' : ''} />
                    <span>{adjusting ? 'Saving Adjustment...' : 'Confirm Adjustment'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: + OTHER EXPENSE CREATION ──────────────────────────────── */}
      {otherExpenseModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building size={22} color="#a78bfa" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Record Other Company Expense</h3>
              </div>
              <button
                type="button"
                onClick={() => setOtherExpenseModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveOtherExpense}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="field-label" style={{ marginBottom: 4 }}>Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={otherExpenseForm.expenseDate}
                      onChange={(e) => setOtherExpenseForm({ ...otherExpenseForm, expenseDate: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="field-label" style={{ marginBottom: 4 }}>Expense Category *</label>
                    <select
                      className="form-control"
                      value={otherExpenseForm.category}
                      onChange={(e) => setOtherExpenseForm({ ...otherExpenseForm, category: e.target.value })}
                      required
                    >
                      <option value="Office & Operations">Office & Operations</option>
                      <option value="Rent">Office Rent</option>
                      <option value="Utilities">Utilities & Electricity</option>
                      <option value="Fuel & Travel">Fuel & Travel</option>
                      <option value="Salaries & Wages">Salaries & Wages</option>
                      <option value="Vendor Payment">Vendor Payment</option>
                      <option value="Hardware / Tools">Hardware / Tools</option>
                      <option value="Miscellaneous">Miscellaneous</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="field-label" style={{ marginBottom: 4 }}>Amount (Rs.) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="e.g. 15000"
                      value={otherExpenseForm.amount}
                      onChange={(e) => setOtherExpenseForm({ ...otherExpenseForm, amount: e.target.value })}
                      required
                      style={{ fontWeight: 700, color: '#f8fafc' }}
                    />
                  </div>
                  <div>
                    <label className="field-label" style={{ marginBottom: 4 }}>Paid To / Vendor Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Person or Company name"
                      value={otherExpenseForm.paidTo}
                      onChange={(e) => setOtherExpenseForm({ ...otherExpenseForm, paidTo: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="field-label" style={{ marginBottom: 4 }}>Payment Method</label>
                    <select
                      className="form-control"
                      value={otherExpenseForm.paymentMethod}
                      onChange={(e) => setOtherExpenseForm({ ...otherExpenseForm, paymentMethod: e.target.value })}
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Online / Card">Online / Card</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label" style={{ marginBottom: 4 }}>Bank / Account</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Meezan Bank"
                      value={otherExpenseForm.bankName}
                      onChange={(e) => setOtherExpenseForm({ ...otherExpenseForm, bankName: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Description / Purpose *</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Enter detailed description of expense..."
                    value={otherExpenseForm.description}
                    onChange={(e) => setOtherExpenseForm({ ...otherExpenseForm, description: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="field-label" style={{ marginBottom: 4 }}>Reference / Transaction ID</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. TRX-99214 or Chq #0012"
                      value={otherExpenseForm.referenceNo}
                      onChange={(e) => setOtherExpenseForm({ ...otherExpenseForm, referenceNo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="field-label" style={{ marginBottom: 4 }}>Receipt / Attachment URL</label>
                    <input
                      type="url"
                      className="form-control"
                      placeholder="https://..."
                      value={otherExpenseForm.attachmentUrl}
                      onChange={(e) => setOtherExpenseForm({ ...otherExpenseForm, attachmentUrl: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Admin Audit Notes</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Permanent admin notes..."
                    value={otherExpenseForm.adminNotes}
                    onChange={(e) => setOtherExpenseForm({ ...otherExpenseForm, adminNotes: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setOtherExpenseModalOpen(false)}
                    disabled={savingOtherExpense}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingOtherExpense}
                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Check size={16} className={savingOtherExpense ? 'spin' : ''} />
                    <span>{savingOtherExpense ? 'Saving Expense...' : 'Record Expense'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: RECEIPT IMAGE PREVIEW ─────────────────────────────────── */}
      {imagePreviewUrl && (
        <div className="modal-backdrop" onClick={() => setImagePreviewUrl(null)}>
          <div className="modal-card" style={{ maxWidth: 700, padding: 16, background: '#090d16' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc' }}>Receipt / Bill Proof Preview</span>
              <button
                type="button"
                onClick={() => setImagePreviewUrl(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ textAlign: 'center', maxHeight: '75vh', overflow: 'auto', background: '#000', borderRadius: 8, padding: 8 }}>
              <img
                src={imagePreviewUrl}
                alt="Receipt Full Preview"
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <a
                href={imagePreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                <Eye size={14} /> Open Full Size in New Tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
