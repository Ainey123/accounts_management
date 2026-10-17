"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, Download, Filter, Calendar, AlertTriangle, Clock,
  DollarSign, RefreshCw, FileSpreadsheet, HelpCircle, Save,
  CheckCircle2, ChevronRight, ShieldAlert, Layers, ArrowUpRight,
  Printer
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function PendingChecklistCardsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tenure & Batch Search Filters
  const [selectedTenure, setSelectedTenure] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Justification notes for each batch (persisted in localStorage)
  const [batchNotes, setBatchNotes] = useState({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nexus_pending_batch_notes');
      if (saved) setBatchNotes(JSON.parse(saved));
    } catch (e) {}
  }, []);

  const fetchCardsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedTenure && selectedTenure !== 'all') params.set('tenure', selectedTenure);
      if (selectedBatch && selectedBatch !== 'all') params.set('batch', selectedBatch);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const json = await apiFetch(`/api/pending-checklist?${params.toString()}`);
      if (!json.success) throw new Error(json.error || 'Failed to load cards summary');
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedTenure, selectedBatch, fromDate, toDate]);

  useEffect(() => {
    fetchCardsData();
  }, [fetchCardsData]);

  const handleSaveNote = (batchName, text) => {
    const key = `${selectedTenure}_${batchName}`;
    setBatchNotes(prev => {
      const updated = { ...prev, [key]: text };
      try {
        localStorage.setItem('nexus_pending_batch_notes', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    setSaveSuccessMsg(`Justification saved for ${batchName}!`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const overall = data?.overallCards || {
    totalJobs: 0,
    invoicesSent: { count: 0, amount: 0 },
    invoicesPending: { count: 0, amount: 0 },
    paymentsSent: { count: 0, amount: 0 },
    paymentsPending: { count: 0, amount: 0 },
    recoveryRate: '0.0%'
  };

  const batches = data?.batchCards || [];
  const tenureCards = data?.tenureCards || [];

  return (
    <div style={{ maxWidth: 1380, margin: '0 auto', padding: '16px 20px 48px', color: '#f8fafc' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, background: '#4f46e5', color: '#fff', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.05em' }}>
              EXECUTIVE AUDIT CARDS
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Tenure-Wise Search &bull; Grouped by Batch Names
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>
            Pending Invoices &amp; Payments Cards Summary
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, marginBottom: 0 }}>
            Executive cards showing total invoices sent, total pendings, total payments sent, and total pendings across tenures.
          </p>
        </div>

        {/* ONE-CLICK DOWNLOAD BUTTONS (CARDS ONLY FORMAT) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <a
            href="/reports/Cards_Summary_Pending_Audit.pdf"
            download
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#dc2626',
              color: '#fff',
              padding: '9px 15px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)'
            }}
          >
            <Download size={14} /> Download Cards PDF
          </a>

          <a
            href="/reports/Cards_Summary_Pending_Audit.xlsx"
            download
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#16a34a',
              color: '#fff',
              padding: '9px 15px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)'
            }}
          >
            <FileSpreadsheet size={14} /> Download Cards Excel
          </a>

          <a
            href="/reports/Cards_Summary_Pending_Audit.csv"
            download
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#0284c7',
              color: '#fff',
              padding: '9px 15px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
            }}
          >
            <FileText size={14} /> Download Cards CSV
          </a>

          <button
            onClick={fetchCardsData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.08)',
              color: '#cbd5e1',
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '9px 13px',
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

      {/* TENURE-WISE SEARCH & FILTER CONTROL BAR */}
      <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px', marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
          
          {/* Tenure Dropdown */}
          <div style={{ minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              📅 Tenure Selection
            </label>
            <select
              value={selectedTenure}
              onChange={(e) => {
                setSelectedTenure(e.target.value);
                setFromDate('');
                setToDate('');
              }}
              style={{
                width: '100%',
                background: '#090a0f',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600
              }}
            >
              <option value="all">🌐 All Tenures (Full 2026)</option>
              {data?.tenureOptions?.map(t => (
                <option key={t.key} value={t.key}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Batch Filter (BATCH NAMES ONLY - NO EMPLOYEE NAMES) */}
          <div style={{ minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              👥 Batch Name Selection
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              style={{
                width: '100%',
                background: '#090a0f',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600
              }}
            >
              <option value="all">🏢 All Batches</option>
              {data?.batchOptions?.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Custom Date Range from Date */}
          <div style={{ minWidth: 150 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              From Date (Optional)
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setSelectedTenure('custom');
              }}
              style={{
                width: '100%',
                background: '#090a0f',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13
              }}
            />
          </div>

          {/* Custom Date Range to Date */}
          <div style={{ minWidth: 150 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              To Date (Optional)
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setSelectedTenure('custom');
              }}
              style={{
                width: '100%',
                background: '#090a0f',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13
              }}
            />
          </div>

          {/* Reset button */}
          {(selectedTenure !== 'all' || selectedBatch !== 'all' || fromDate || toDate) && (
            <button
              onClick={() => {
                setSelectedTenure('all');
                setSelectedBatch('all');
                setFromDate('');
                setToDate('');
              }}
              style={{
                padding: '9px 14px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              Reset Filters
            </button>
          )}

        </div>

        {/* Quick Month Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center', marginRight: 4, fontWeight: 600 }}>Quick Tenures:</span>
          {['all', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map(tKey => {
            const label = tKey === 'all' ? 'All Months' : (data?.tenureOptions?.find(o => o.key === tKey)?.name?.replace(' 2026', '') || tKey);
            const isActive = selectedTenure === tKey;
            return (
              <button
                key={tKey}
                onClick={() => {
                  setSelectedTenure(tKey);
                  setFromDate('');
                  setToDate('');
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive ? '1px solid #4f46e5' : '1px solid rgba(255,255,255,0.1)',
                  background: isActive ? '#4f46e5' : 'rgba(255,255,255,0.04)',
                  color: isActive ? '#fff' : '#cbd5e1'
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px 16px', borderRadius: 8, marginBottom: 20 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ============================================================= */}
      {/* SECTION 1: THE 4 MAIN EXECUTIVE OVERVIEW CARDS */}
      {/* ============================================================= */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          🎯 Executive Overview Cards &bull; {selectedTenure === 'all' ? 'Full Tenure (Jan – Oct 2026)' : selectedTenure} &bull; {selectedBatch === 'all' ? 'All Batches' : selectedBatch}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          
          {/* CARD 1: TOTAL INVOICES SENT */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15), rgba(15, 23, 42, 0.9))',
            border: '1.5px solid rgba(2, 132, 199, 0.4)',
            borderRadius: 14,
            padding: '20px 22px',
            borderTop: '4px solid #0284c7',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#7dd3fc', letterSpacing: '0.05em' }}>
                Total Invoices Sent
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(2, 132, 199, 0.25)', color: '#38bdf8', padding: '3px 8px', borderRadius: 6 }}>
                Dispatched
              </span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', fontFamily: 'monospace', lineHeight: 1.1 }}>
              {overall.invoicesSent.count} <span style={{ fontSize: 16, fontWeight: 600, color: '#7dd3fc' }}>Invoices</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8', marginTop: 8 }}>
              Rs. {overall.invoicesSent.amount.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              Total billed volume dispatched to clients
            </div>
          </div>

          {/* CARD 2: TOTAL INVOICES PENDING */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(15, 23, 42, 0.9))',
            border: '1.5px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 14,
            padding: '20px 22px',
            borderTop: '4px solid #f59e0b',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#fde68a', letterSpacing: '0.05em' }}>
                Total Invoices Pending
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', padding: '3px 8px', borderRadius: 6 }}>
                Action Required
              </span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace', lineHeight: 1.1 }}>
              {overall.invoicesPending.count} <span style={{ fontSize: 16, fontWeight: 600, color: '#fde68a' }}>Complaints</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fbbf24', marginTop: 8 }}>
              Awaiting Invoice Creation / Approval
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              Completed sites missing signed bill submissions
            </div>
          </div>

          {/* CARD 3: TOTAL PAYMENTS SENT / RECEIVED */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(15, 23, 42, 0.9))',
            border: '1.5px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 14,
            padding: '20px 22px',
            borderTop: '4px solid #10b981',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#a7f3d0', letterSpacing: '0.05em' }}>
                Total Payments Received
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', padding: '3px 8px', borderRadius: 6 }}>
                Collected ({overall.recoveryRate})
              </span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#10b981', fontFamily: 'monospace', lineHeight: 1.1 }}>
              Rs. {overall.paymentsSent.amount.toLocaleString()}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#6ee7b7', marginTop: 8 }}>
              {overall.paymentsSent.count} Successful Collections
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              Net bank credits + withholding tax certificates
            </div>
          </div>

          {/* CARD 4: TOTAL PAYMENTS PENDING */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(15, 23, 42, 0.95))',
            border: '1.5px solid rgba(239, 68, 68, 0.5)',
            borderRadius: 14,
            padding: '20px 22px',
            borderTop: '4px solid #dc2626',
            boxShadow: '0 8px 24px rgba(220, 38, 38, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#fca5a5', letterSpacing: '0.05em' }}>
                Total Payments Pending
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '3px 8px', borderRadius: 6 }}>
                Overdue Due
              </span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#ef4444', fontFamily: 'monospace', lineHeight: 1.1 }}>
              Rs. {overall.paymentsPending.amount.toLocaleString()}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fca5a5', marginTop: 8 }}>
              {overall.paymentsPending.count} Complaints Pending Recovery
            </div>
            <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
              Uncollected funds awaiting client finance release
            </div>
          </div>

        </div>
      </div>

      {/* ============================================================= */}
      {/* SECTION 2: BATCH CARDS (BATCH NAMES ONLY) */}
      {/* ============================================================= */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              👥 Batch Cards (Strictly Batch Names)
            </h2>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0' }}>
              Performance metrics and end-of-month audit inquiry questions grouped strictly by Batch.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
          {batches.map(b => {
            const noteKey = `${selectedTenure}_${b.batchName}`;
            const noteText = batchNotes[noteKey] || '';
            const borderCol = b.batchName === 'Batch 1' ? '#38bdf8' : b.batchName === 'Batch 2' ? '#34d399' : b.batchName === 'Batch 3' ? '#fbbf24' : b.batchName === 'Batch 4' ? '#a78bfa' : '#94a3b8';

            return (
              <div
                key={b.batchName}
                style={{
                  background: '#0d111b',
                  border: '1.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: '18px 20px',
                  borderTop: `4px solid ${borderCol}`,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.4)'
                }}
              >
                {/* Batch Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: borderCol }}>
                    {b.batchName}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 6 }}>
                    {b.totalJobs} Complaints
                  </div>
                </div>

                {/* 4 Mini Cards for the Batch */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  
                  {/* Batch Invoices Sent */}
                  <div style={{ background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.2)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#7dd3fc', textTransform: 'uppercase' }}>Invoices Sent</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'monospace', marginTop: 2 }}>
                      {b.invoicesSent.count}
                    </div>
                    <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600, marginTop: 2 }}>
                      Rs. {b.invoicesSent.amount.toLocaleString()}
                    </div>
                  </div>

                  {/* Batch Invoices Pending */}
                  <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#fde68a', textTransform: 'uppercase' }}>Invoices Pending</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace', marginTop: 2 }}>
                      {b.invoicesPending.count}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      Awaiting Bill
                    </div>
                  </div>

                  {/* Batch Payments Sent / Received */}
                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#a7f3d0', textTransform: 'uppercase' }}>Payments Received</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981', fontFamily: 'monospace', marginTop: 2 }}>
                      Rs. {b.paymentsSent.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {b.paymentsSent.count} Collections
                    </div>
                  </div>

                  {/* Batch Payments Pending */}
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase' }}>Payments Pending</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#ef4444', fontFamily: 'monospace', marginTop: 2 }}>
                      Rs. {b.paymentsPending.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: '#f87171', fontWeight: 600, marginTop: 2 }}>
                      {b.paymentsPending.count} Overdue
                    </div>
                  </div>

                </div>

                {/* END-OF-MONTH AUDIT INQUIRY QUESTION */}
                <div style={{ background: '#171c2a', border: '1px dashed #f59e0b', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HelpCircle size={14} /> End-of-Tenure Audit Inquiry:
                  </div>
                  <div style={{ fontSize: 12, color: '#fef3c7', lineHeight: 1.4, marginBottom: 8 }}>
                    <strong>Why are {b.invoicesPending.count} invoices and Rs. {b.paymentsPending.amount.toLocaleString()} payment pending for {b.batchName}?</strong>
                  </div>

                  <textarea
                    rows={2}
                    placeholder={`Type ${b.batchName} explanation / client reason here...`}
                    value={noteText}
                    onChange={(e) => handleSaveNote(b.batchName, e.target.value)}
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
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={11} /> Auto-saves to system
                    </span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================= */}
      {/* SECTION 3: TENURE-WISE TIMELINE CARDS MATRIX */}
      {/* ============================================================= */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          📅 Tenure-by-Tenure Performance Cards (All Months)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {tenureCards.map(tc => {
            const isSelected = selectedTenure === tc.tenureKey;
            return (
              <div
                key={tc.tenureKey}
                onClick={() => setSelectedTenure(tc.tenureKey)}
                style={{
                  background: isSelected ? 'rgba(79, 70, 229, 0.15)' : '#0d111b',
                  border: isSelected ? '2px solid #4f46e5' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, border-color 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{tc.tenureName}</div>
                  <span style={{ fontSize: 10, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>
                    {tc.totalJobs} Jobs
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: 10 }}>Invoices Sent:</span>
                    <div style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>{tc.invoicesSent.count} (Rs. {tc.invoicesSent.amount.toLocaleString()})</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: 10 }}>Invoices Pending:</span>
                    <div style={{ color: '#f59e0b', fontWeight: 700, fontFamily: 'monospace' }}>{tc.invoicesPending.count} Pending</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: 10 }}>Payments Received:</span>
                    <div style={{ color: '#10b981', fontWeight: 700, fontFamily: 'monospace' }}>Rs. {tc.paymentsSent.amount.toLocaleString()}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: 10 }}>Payments Pending:</span>
                    <div style={{ color: '#ef4444', fontWeight: 700, fontFamily: 'monospace' }}>Rs. {tc.paymentsPending.amount.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
