"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText, Download, CheckSquare, Square, Search, Filter,
  Calendar, Users, AlertTriangle, Clock, DollarSign, RefreshCw,
  FileSpreadsheet, HelpCircle, Save, CheckCircle2, ChevronRight,
  ExternalLink, Printer, ShieldAlert, Award
} from 'lucide-react';
import Link from 'next/link';

export default function PendingChecklistPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedPendingType, setSelectedPendingType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Checklist checked items (saved in localStorage)
  const [checkedItems, setCheckedItems] = useState({});
  // Officer Audit Inquiries notes (saved in localStorage)
  const [officerNotes, setOfficerNotes] = useState({});
  const [activeTab, setActiveTab] = useState('checklist'); // 'checklist', 'inquiry', 'summary'
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Load localStorage on mount
  useEffect(() => {
    try {
      const savedChecks = localStorage.getItem('nexus_pending_checked_items');
      if (savedChecks) setCheckedItems(JSON.parse(savedChecks));

      const savedNotes = localStorage.getItem('nexus_pending_officer_notes');
      if (savedNotes) setOfficerNotes(JSON.parse(savedNotes));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, []);

  // Fetch checklist data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedMonth && selectedMonth !== 'all') params.set('month', selectedMonth);
      if (selectedEmployee && selectedEmployee !== 'all') params.set('employee', selectedEmployee);
      if (selectedPendingType && selectedPendingType !== 'all') params.set('pendingType', selectedPendingType);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/pending-checklist?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load checklist');
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedEmployee, selectedPendingType, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle checklist item
  const toggleCheck = (serialNo) => {
    setCheckedItems(prev => {
      const updated = { ...prev, [serialNo]: !prev[serialNo] };
      try {
        localStorage.setItem('nexus_pending_checked_items', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Save officer audit note
  const handleSaveNote = (monthKey, empName, field, value) => {
    const key = `${monthKey}_${empName}`;
    setOfficerNotes(prev => {
      const current = prev[key] || {};
      const updated = { ...prev, [key]: { ...current, [field]: value } };
      try {
        localStorage.setItem('nexus_pending_officer_notes', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    setSaveSuccessMsg(`Justification saved for ${empName} (${monthKey})`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  // Monthly summary stats for active view
  const currentSummary = useMemo(() => {
    if (!data) return null;
    if (selectedMonth === 'all') return data.globalSummary;
    return data.monthlySummaries?.[selectedMonth] || data.globalSummary;
  }, [data, selectedMonth]);

  // Employee breakdown for End-of-Month Audit Section
  const currentEmployees = useMemo(() => {
    if (!data?.monthlySummaries) return [];
    if (selectedMonth !== 'all') {
      const ms = data.monthlySummaries[selectedMonth];
      return ms ? Object.values(ms.employeeMap) : [];
    }
    // Aggregate across all months
    const aggregated = {};
    Object.values(data.monthlySummaries).forEach(ms => {
      Object.values(ms.employeeMap).forEach(emp => {
        if (!aggregated[emp.name]) {
          aggregated[emp.name] = {
            name: emp.name,
            jobsCount: 0,
            invoicesPending: 0,
            paymentsPending: 0,
            totalOutstanding: 0,
            sampleSerials: []
          };
        }
        const a = aggregated[emp.name];
        a.jobsCount += emp.jobsCount;
        a.invoicesPending += emp.invoicesPending;
        a.paymentsPending += emp.paymentsPending;
        a.totalOutstanding += emp.totalOutstanding;
        emp.sampleSerials.forEach(s => {
          if (!a.sampleSerials.includes(s) && a.sampleSerials.length < 6) a.sampleSerials.push(s);
        });
      });
    });
    return Object.values(aggregated);
  }, [data, selectedMonth]);

  const items = data?.items || [];

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '16px 20px 48px', color: '#f8fafc' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, background: '#4f46e5', color: '#fff', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.05em' }}>
              MONTHLY AUDIT & RECOVERY PORTAL
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              All Months: January 2026 – October 2026
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>
            Pending Payments &amp; Invoices Audit Checklist
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, marginBottom: 0 }}>
            Track unissued invoices, uncollected balances, and conduct end-of-month officer inquiry reviews.
          </p>
        </div>

        {/* ONE-CLICK DOWNLOAD BUTTONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <a
            href="/reports/All_Months_Pending_Payments_and_Invoices_Checklist.pdf"
            download
            className="download-btn-pdf"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#dc2626',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)'
            }}
          >
            <Download size={14} /> Download PDF Checklist
          </a>

          <a
            href="/reports/All_Months_Pending_Payments_and_Invoices_Checklist.xlsx"
            download
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#16a34a',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)'
            }}
          >
            <FileSpreadsheet size={14} /> Excel Workbook (.xlsx)
          </a>

          <a
            href="/reports/All_Months_Pending_Payments_and_Invoices_Checklist.csv"
            download
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#0284c7',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
            }}
          >
            <FileText size={14} /> CSV Format
          </a>

          <button
            onClick={fetchData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.08)',
              color: '#cbd5e1',
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', padding: '10px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          ✓ {saveSuccessMsg}
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px', borderTop: '3px solid #6366f1' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Total Complaints</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 4 }}>
            {currentSummary?.totalJobs || 0}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {selectedMonth === 'all' ? 'All 10 Months' : selectedMonth}
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px', borderTop: '3px solid #f59e0b' }}>
          <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase' }}>Invoices Pending</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
            {currentSummary?.invoicesPendingCount || 0}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Missing or unapproved</div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px', borderTop: '3px solid #ef4444' }}>
          <div style={{ fontSize: 11, color: '#f87171', fontWeight: 600, textTransform: 'uppercase' }}>Payments Pending</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>
            {currentSummary?.paymentsPendingCount || 0}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Awaiting client funds</div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px', borderTop: '3px solid #06b6d4' }}>
          <div style={{ fontSize: 11, color: '#22d3ee', fontWeight: 600, textTransform: 'uppercase' }}>Total Invoiced</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 4 }}>
            Rs. {Math.round(currentSummary?.totalInvoiced || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Billed across sites</div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px', borderTop: '3px solid #10b981' }}>
          <div style={{ fontSize: 11, color: '#34d399', fontWeight: 600, textTransform: 'uppercase' }}>Total Recovered</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
            Rs. {Math.round((currentSummary?.totalReceived || 0) + (currentSummary?.totalTaxDeducted || 0)).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Cash received + Tax</div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 10, padding: '12px 16px', borderTop: '3px solid #dc2626' }}>
          <div style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600, textTransform: 'uppercase' }}>Total Outstanding Due</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>
            Rs. {Math.round(currentSummary?.totalOutstanding || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#f87171', marginTop: 2 }}>Needs urgent recovery</div>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          
          {/* Month Selector */}
          <div style={{ minWidth: 160 }}>
            <label style={{ display: 'block', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                width: '100%',
                background: '#090a0f',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '7px 10px',
                borderRadius: 6,
                fontSize: 12
              }}
            >
              <option value="all">📅 All Months Combined</option>
              {data?.monthsList?.map(m => (
                <option key={m} value={m}>{data.monthlySummaries?.[m]?.monthName || m}</option>
              ))}
            </select>
          </div>

          {/* Pending Status Filter */}
          <div style={{ minWidth: 160 }}>
            <label style={{ display: 'block', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Pending Type</label>
            <select
              value={selectedPendingType}
              onChange={(e) => setSelectedPendingType(e.target.value)}
              style={{
                width: '100%',
                background: '#090a0f',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '7px 10px',
                borderRadius: 6,
                fontSize: 12
              }}
            >
              <option value="all">🔍 All Pending Categories</option>
              <option value="BOTH_PENDING">🔴 Both Pending (Inv &amp; Pay)</option>
              <option value="INVOICE_PENDING">⚠️ Invoice Pending Only</option>
              <option value="PAYMENT_PENDING">⏳ Payment Pending Only</option>
              <option value="CLEARED">✅ Cleared</option>
            </select>
          </div>

          {/* Assigned Officer Filter */}
          <div style={{ minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Assigned Officer</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              style={{
                width: '100%',
                background: '#090a0f',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '7px 10px',
                borderRadius: 6,
                fontSize: 12
              }}
            >
              <option value="all">👥 All Officers / Teams</option>
              {data?.employeeList?.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Search Complaint</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search Serial, Client, Branch, Nature, Officer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: '#090a0f',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  padding: '7px 10px 7px 32px',
                  borderRadius: 6,
                  fontSize: 12
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
            </div>
          </div>

        </div>

        {/* View Toggle Tabs */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setActiveTab('checklist')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'checklist' ? '#4f46e5' : 'rgba(255,255,255,0.05)',
              color: activeTab === 'checklist' ? '#fff' : '#94a3b8',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <CheckSquare size={14} /> Itemized Checklist ({items.length})
          </button>

          <button
            onClick={() => setActiveTab('inquiry')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'inquiry' ? '#b45309' : 'rgba(255,255,255,0.05)',
              color: activeTab === 'inquiry' ? '#fff' : '#f59e0b',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <HelpCircle size={14} /> End-of-Month Officer Inquiries ("Why Are These Pendings?")
          </button>
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px 16px', borderRadius: 8, marginBottom: 20 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: ITEMIZED CHECKLIST TABLE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'checklist' && (
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
          
          <div style={{ padding: '12px 16px', background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
              Showing {items.length} Complaints ({Object.keys(checkedItems).filter(k => checkedItems[k]).length} marked as reviewed)
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Click checkbox to toggle review state
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#0a0d16', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px', width: 36, textAlign: 'center' }}>✓</th>
                  <th style={{ padding: '10px 12px', width: 90 }}>Serial #</th>
                  <th style={{ padding: '10px 12px', width: 85 }}>Date</th>
                  <th style={{ padding: '10px 12px' }}>Client &amp; Branch</th>
                  <th style={{ padding: '10px 12px', width: 100 }}>Nature</th>
                  <th style={{ padding: '10px 12px', width: 140 }}>Assigned Officer</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: 95 }}>Quotation</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: 95 }}>Invoice</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: 95 }}>Recovered</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: 105 }}>Outstanding</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: 110 }}>Issue Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                      Loading checklist items...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isChecked = !!checkedItems[item.serialNo];
                    const isBoth = item.pendingCategory === 'BOTH_PENDING';
                    const isInv = item.pendingCategory === 'INVOICE_PENDING';
                    const isPay = item.pendingCategory === 'PAYMENT_PENDING';

                    let badgeBg = '#065f46';
                    let badgeColor = '#6ee7b7';
                    if (isBoth) { badgeBg = 'rgba(239, 68, 68, 0.2)'; badgeColor = '#f87171'; }
                    else if (isInv) { badgeBg = 'rgba(245, 158, 11, 0.2)'; badgeColor = '#fbbf24'; }
                    else if (isPay) { badgeBg = 'rgba(59, 130, 246, 0.2)'; badgeColor = '#60a5fa'; }

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: isChecked ? 'rgba(16, 185, 129, 0.05)' : isBoth ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                          opacity: isChecked ? 0.65 : 1
                        }}
                      >
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => toggleCheck(item.serialNo)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isChecked ? '#10b981' : '#64748b', padding: 0 }}
                          >
                            {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                          {item.serialNo}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 11 }}>
                          {item.exactDate}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{item.clientName}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{item.branchName}</div>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: '#cbd5e1' }}>
                          {item.workNature}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#e2e8f0', fontWeight: 500 }}>
                          {item.assignedTo}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#cbd5e1' }}>
                          {item.quotationAmount > 0 ? `Rs. ${item.quotationAmount.toLocaleString()}` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: item.invoiceAmount > 0 ? '#fff' : '#64748b' }}>
                          {item.invoiceAmount > 0 ? `Rs. ${item.invoiceAmount.toLocaleString()}` : 'Not Issued'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#34d399' }}>
                          {item.grossReceived > 0 ? `Rs. ${item.grossReceived.toLocaleString()}` : 'Rs. 0'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: item.outstandingBalance > 0 ? '#ef4444' : '#10b981' }}>
                          Rs. {item.outstandingBalance.toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, background: badgeBg, color: badgeColor, padding: '3px 7px', borderRadius: 4 }}>
                            {item.pendingLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: END-OF-MONTH OFFICER INQUIRIES ("Why Are These Pendings?") */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'inquiry' && (
        <div style={{ background: '#0e111a', border: '2px solid #b45309', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <AlertTriangle size={22} color="#f59e0b" />
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', margin: 0, textTransform: 'uppercase' }}>
              Monthly Audit Inquiry Protocol &bull; "Why Are These Pendings?"
            </h2>
          </div>
          
          <p style={{ fontSize: 13, color: '#fde68a', lineHeight: 1.5, marginBottom: 20 }}>
            Mandatory interrogation framework for unresolved jobs in <strong>{selectedMonth === 'all' ? 'All Months' : (data?.monthlySummaries?.[selectedMonth]?.monthName || selectedMonth)}</strong>. 
            Cross-examine assigned officers on missing invoices, client payment bottlenecks, and record commitments directly into the system.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
            {currentEmployees.map(emp => {
              const noteKey = `${selectedMonth}_${emp.name}`;
              const noteData = officerNotes[noteKey] || {};

              return (
                <div key={emp.name} style={{ background: '#141824', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 10, padding: 18 }}>
                  
                  {/* Officer Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{emp.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>Total Complaints: <strong>{emp.jobsCount}</strong></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444' }}>
                        Rs. {Math.round(emp.totalOutstanding).toLocaleString()} Due
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>Outstanding Exposure</div>
                    </div>
                  </div>

                  {/* Pending Metric Badges */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '3px 8px', borderRadius: 4 }}>
                      ⚠️ {emp.invoicesPending} Invoices Pending
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '3px 8px', borderRadius: 4 }}>
                      ⏳ {emp.paymentsPending} Payments Pending
                    </span>
                  </div>

                  {/* Mandatory Questions */}
                  <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 6, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#fef3c7' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, color: '#f59e0b' }}>Mandatory Audit Questions for {emp.name}:</div>
                    <ol style={{ paddingLeft: 18, margin: 0, lineHeight: 1.5 }}>
                      <li>Why are {emp.invoicesPending} invoices not generated/approved for completed works?</li>
                      <li>Why has client finance not cleared Rs. {Math.round(emp.totalOutstanding).toLocaleString()}? Did the branch manager dispute rates or completion?</li>
                      <li>When was the last written or physical follow-up with the bank?</li>
                    </ol>
                    {emp.sampleSerials.length > 0 && (
                      <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 6 }}>
                        Sample Complaints: {emp.sampleSerials.join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Interactive Justification Input Form */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                        Officer Justification &amp; Operational Obstacle
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Work completed; branch manager stamp delayed; sent revised line items..."
                        value={noteData.reason || ''}
                        onChange={(e) => handleSaveNote(selectedMonth, emp.name, 'reason', e.target.value)}
                        style={{
                          width: '100%',
                          background: '#090a0f',
                          color: '#fff',
                          border: '1px solid rgba(255,255,255,0.15)',
                          padding: '6px 8px',
                          borderRadius: 6,
                          fontSize: 12,
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                          Client Contact &amp; Follow-up
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Spoke with Tariq (Branch Mgr)"
                          value={noteData.clientContact || ''}
                          onChange={(e) => handleSaveNote(selectedMonth, emp.name, 'clientContact', e.target.value)}
                          style={{
                            width: '100%',
                            background: '#090a0f',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.15)',
                            padding: '6px 8px',
                            borderRadius: 6,
                            fontSize: 12
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                          Committed Clearance Date
                        </label>
                        <input
                          type="date"
                          value={noteData.committedDate || ''}
                          onChange={(e) => handleSaveNote(selectedMonth, emp.name, 'committedDate', e.target.value)}
                          style={{
                            width: '100%',
                            background: '#090a0f',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.15)',
                            padding: '6px 8px',
                            borderRadius: 6,
                            fontSize: 12
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={12} /> Auto-saved
                      </span>
                    </div>

                  </div>

                </div>
              );
            })}
          </div>

          {/* 6-Point Management Recovery Verification Checklist */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', marginBottom: 10 }}>
              Management Recovery Verification Steps:
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
              {[
                '1. Verify signed work completion certificates for completed sites.',
                '2. Dispatch missing tax invoices to client zonal offices within 48 hours.',
                '3. Issue formal written payment demand notices for balances older than 30 days.',
                '4. Collect CPR withholding tax certificates from client accounts.',
                '5. Escalate line-item or rate disputes to GM Operations / Lead Engineer.',
                '6. Internal Auditor & Managing Director final sign-off.'
              ].map((step, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#141824', padding: '8px 12px', borderRadius: 6, fontSize: 12, color: '#f1f5f9' }}>
                  <CheckSquare size={16} color="#10b981" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
