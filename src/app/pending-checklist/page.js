"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Download, FileSpreadsheet, FileText, RefreshCw, Calendar,
  Filter, HelpCircle, CheckCircle2, ChevronRight
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function DomainOverviewCardsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedTenure, setSelectedTenure] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Justification notes
  const [batchNotes, setBatchNotes] = useState({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nexus_domain_batch_notes');
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
      if (!json.success) throw new Error(json.error || 'Failed to load domain overview');
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
        localStorage.setItem('nexus_domain_batch_notes', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    setSaveSuccessMsg(`Justification saved for ${batchName}!`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const domainOverview = data?.domainOverview || {
    cardTitle: 'Domain Overview',
    batchName: 'Overall Domain Overview',
    totalComplaints: 0,
    paymentReceivedCases: 0,
    paymentPendingCases: 0,
    poPendingCases: 0,
    inprocessCases: 0,
    cancelCases: 0,
  };

  const batchCards = data?.batchCards || [];
  const tenureCards = data?.tenureCards || [];

  // Card Component matching the user's exact uploaded image
  const renderDomainCard = (title, batchName, cardData, showInquiry = true) => {
    const noteKey = `${selectedTenure}_${batchName}`;
    const noteText = batchNotes[noteKey] || '';

    return (
      <div
        key={batchName}
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          background: '#ffffff',
          border: '2px solid #000000',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)',
          borderRadius: 2,
          overflow: 'hidden',
          color: '#000000',
          fontFamily: "'Times New Roman', Times, serif, 'Inter', sans-serif"
        }}
      >
        {/* TOP TITLE: Domain Overview */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            textAlign: 'center',
            padding: '8px 12px',
            borderBottom: '2px solid #000000',
            letterSpacing: '0.02em',
            background: '#ffffff'
          }}
        >
          {title || 'Domain Overview'}
        </div>

        {/* SUBHEADER: Batch No. XX */}
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            textAlign: 'left',
            padding: '6px 12px',
            borderBottom: '2px solid #000000',
            background: '#ffffff'
          }}
        >
          {batchName}
        </div>

        {/* 6 STANDARDIZED ROWS */}
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <tbody>
            <tr style={{ borderBottom: '1.5px solid #000000' }}>
              <td style={{ width: '70%', padding: '6px 12px', borderRight: '2px solid #000000', fontSize: 13.5 }}>
                Total no of Complaints
              </td>
              <td style={{ width: '30%', padding: '6px 12px', fontSize: 14.5, fontWeight: 500 }}>
                {cardData?.totalComplaints || 0}
              </td>
            </tr>

            <tr style={{ borderBottom: '1.5px solid #000000' }}>
              <td style={{ width: '70%', padding: '6px 12px', borderRight: '2px solid #000000', fontSize: 13.5 }}>
                Total no of Payment Received Cases
              </td>
              <td style={{ width: '30%', padding: '6px 12px', fontSize: 14.5, fontWeight: 500 }}>
                {cardData?.paymentReceivedCases || 0}
              </td>
            </tr>

            <tr style={{ borderBottom: '1.5px solid #000000' }}>
              <td style={{ width: '70%', padding: '6px 12px', borderRight: '2px solid #000000', fontSize: 13.5 }}>
                Total no of Payment Pending Cases
              </td>
              <td style={{ width: '30%', padding: '6px 12px', fontSize: 14.5, fontWeight: 500 }}>
                {cardData?.paymentPendingCases || 0}
              </td>
            </tr>

            <tr style={{ borderBottom: '1.5px solid #000000' }}>
              <td style={{ width: '70%', padding: '6px 12px', borderRight: '2px solid #000000', fontSize: 13.5 }}>
                Total no of PO Pending Cases
              </td>
              <td style={{ width: '30%', padding: '6px 12px', fontSize: 14.5, fontWeight: 500 }}>
                {cardData?.poPendingCases || 0}
              </td>
            </tr>

            <tr style={{ borderBottom: '1.5px solid #000000' }}>
              <td style={{ width: '70%', padding: '6px 12px', borderRight: '2px solid #000000', fontSize: 13.5 }}>
                Total no of Inprocess Cases
              </td>
              <td style={{ width: '30%', padding: '6px 12px', fontSize: 14.5, fontWeight: 500 }}>
                {cardData?.inprocessCases || 0}
              </td>
            </tr>

            <tr>
              <td style={{ width: '70%', padding: '6px 12px', borderRight: '2px solid #000000', fontSize: 13.5 }}>
                Total no of Cancel Cases
              </td>
              <td style={{ width: '30%', padding: '6px 12px', fontSize: 14.5, fontWeight: 500 }}>
                {cardData?.cancelCases || 0}
              </td>
            </tr>
          </tbody>
        </table>

        {/* OPTIONAL INQUIRY QUESTION FIELD */}
        {showInquiry && batchName !== 'Overall (All Batches)' && (
          <div style={{ background: '#fafafa', borderTop: '1.5px solid #000000', padding: '10px 12px', fontFamily: 'sans-serif' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
              <HelpCircle size={13} /> Why are cases pending for {batchName}?
            </div>
            <textarea
              rows={2}
              placeholder={`Enter justification or reason for ${batchName}...`}
              value={noteText}
              onChange={(e) => handleSaveNote(batchName, e.target.value)}
              style={{
                width: '100%',
                background: '#ffffff',
                color: '#000000',
                border: '1px solid #cbd5e1',
                padding: '6px 8px',
                borderRadius: 4,
                fontSize: 12,
                resize: 'vertical',
                fontFamily: 'sans-serif'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3 }}>
                <CheckCircle2 size={11} /> Auto-saved
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 20px 48px', color: '#f8fafc' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, background: '#4f46e5', color: '#fff', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.05em' }}>
              EXECUTIVE CARDS OVERVIEW
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Domain Overview Format &bull; Tenure Wise Search
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>
            Domain Overview &bull; Batch Cards Summary
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, marginBottom: 0 }}>
            Clean card-only representation of Total Complaints, Payment Received, Payment Pending, PO Pending, Inprocess, and Cancel Cases.
          </p>
        </div>

        {/* DOWNLOAD BUTTONS */}
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
          <div style={{ minWidth: 220 }}>
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
              <option value="all">🌐 Full Year 2026 (All Tenures)</option>
              {data?.tenureOptions?.map(t => (
                <option key={t.key} value={t.key}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Batch Selector */}
          <div style={{ minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              👥 Batch Selection
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

          {/* Date Range Inputs */}
          <div style={{ minWidth: 150 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              From Date
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

          <div style={{ minWidth: 150 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              To Date
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

          {/* Reset Filters */}
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
      {/* 1. OVERALL DOMAIN OVERVIEW CARD */}
      {/* ============================================================= */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Consolidated Tenure Overview
          </span>
        </div>
        
        {renderDomainCard(
          'Domain Overview',
          selectedTenure === 'all' ? 'Overall (All Batches)' : `Overall Tenure: ${data?.tenureOptions?.find(o => o.key === selectedTenure)?.name || selectedTenure}`,
          domainOverview,
          false
        )}
      </div>

      {/* ============================================================= */}
      {/* 2. BATCH CARDS GRID (EXACT FORMAT) */}
      {/* ============================================================= */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
            Individual Batch Domain Overview Cards
          </h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0' }}>
            Grouped strictly by batch names (Batch No. 01, Batch No. 02, Batch No. 03, Batch No. 04).
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
          {batchCards
            .filter(b => selectedBatch === 'all' || b.batchName === selectedBatch)
            .map(b => renderDomainCard(b.cardTitle, b.batchName, b, true))}
        </div>
      </div>

      {/* ============================================================= */}
      {/* 3. TENURE-WISE CARDS (MONTH-BY-MONTH) */}
      {/* ============================================================= */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
            Tenure-by-Tenure Domain Overview Cards
          </h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0' }}>
            Click any tenure card to view the batch breakdown for that specific month.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
          {tenureCards.map(tc => {
            const isSelected = selectedTenure === tc.tenureKey;
            return (
              <div
                key={tc.tenureKey}
                onClick={() => setSelectedTenure(tc.tenureKey)}
                style={{
                  cursor: 'pointer',
                  border: isSelected ? '3px solid #4f46e5' : 'none',
                  borderRadius: 4,
                  padding: 2,
                  transition: 'transform 0.15s ease'
                }}
              >
                {renderDomainCard(tc.cardTitle, tc.batchName, tc, false)}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
