"use client";

import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function FinancialLedgerPage() {
  const [financials, setFinancials] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    apiFetch('/api/admin/financials')
      .then((data) => {
        setFinancials(data.financials);
        setExpenses(data.expenses);
        setPayments(data.payments || []);
      })
      .catch(console.error);
  }, []);

  if (!financials) {
    return <div className="glass-card"><p style={{ color: '#94a3b8' }}>Loading ledger...</p></div>;
  }

  return (
    <div>
      <header className="page-header">
        <h1>Financial Ledger Terminal</h1>
        <p>Company out-of-pocket costs, tax deductions, and net cash flow.</p>
      </header>

      <section className="glass-card" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <DollarSign size={20} color="#10b981" /> Financial Overview & Tax Breakdown
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          <div className="financial-tile">
            <span className="field-label">Total Business (Completed Work)</span>
            <div className="financial-value" style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 8, fontSize: 24 }}>
              Rs. {financials.totalBusiness.toLocaleString()}
            </div>
          </div>
          
          <div className="financial-tile">
            <span className="field-label">Total Receivable (Invoices Sent)</span>
            <div className="financial-value" style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 8, fontSize: 24 }}>
              Rs. {financials.totalReceivable.toLocaleString()}
            </div>
          </div>

          <div className="financial-tile">
            <span className="field-label">Total Received Amount</span>
            <div className="financial-value" style={{ color: '#00f2fe', display: 'flex', alignItems: 'center', gap: 8, fontSize: 24 }}>
              Rs. {financials.totalReceived.toLocaleString()}
            </div>
          </div>

          <div className="financial-tile">
            <span className="field-label">Total Site Expenses</span>
            <div className="financial-value" style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 8, fontSize: 24 }}>
              Rs. {financials.totalExpenses.toLocaleString()}
            </div>
          </div>

          <div className="financial-tile">
            <span className="field-label">Total Tax Deduction</span>
            <div className="financial-value" style={{ color: '#22d3ee', display: 'flex', alignItems: 'center', gap: 8, fontSize: 24 }}>
              Rs. {financials.taxDeduction.toLocaleString()}
            </div>
          </div>

          <div className="financial-tile net" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="field-label" style={{ color: financials.isProfit ? '#10b981' : '#f87171', fontWeight: 600 }}>
              {financials.isProfit ? 'Profit' : 'Loss'} Status (After Tax & Expenses)
            </span>
            <div className="financial-value" style={{ color: financials.isProfit ? '#34d399' : '#f87171', display: 'flex', alignItems: 'center', gap: 6, fontSize: 24 }}>
              {financials.isProfit ? <TrendingUp size={24} color="#34d399" /> : <TrendingDown size={24} color="#f87171" />}
              Rs. {Math.abs(financials.profitOrLoss).toLocaleString()}
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card">
        <h2 style={{ fontSize: 18, marginBottom: 20 }}>Expense Ledger</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Serial</th>
              <th>Client</th>
              <th>Amount</th>
              <th>Notes</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No expenses recorded.</td></tr>
            ) : (
              expenses.map((exp) => (
                <tr key={exp.id}>
                  <td style={{ fontFamily: 'monospace', color: '#00f2fe' }}>{exp.jobMetadata?.ticket?.serialNo}</td>
                  <td>{exp.jobMetadata?.clientName}</td>
                  <td style={{ color: '#f87171' }}>Rs. {exp.amount.toLocaleString()}</td>
                  <td>{exp.summaryNotes.slice(0, 60)}{exp.summaryNotes.length > 60 ? '...' : ''}</td>
                  <td>{exp.imageUrl ? <a href={exp.imageUrl} target="_blank" rel="noreferrer" style={{ color: '#00f2fe' }}>View</a> : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="glass-card" style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18, marginBottom: 20 }}>Payments Received Ledger</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Serial</th>
              <th>Client</th>
              <th>Employee</th>
              <th>Amount Received</th>
              <th>Tax Deducted</th>
              <th>Net Status</th>
              <th>Notes</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No payments received.</td></tr>
            ) : (
              payments.map((pay) => (
                <tr key={pay.id}>
                  <td style={{ fontFamily: 'monospace', color: '#00f2fe' }}>{pay.jobMetadata?.ticket?.serialNo || '—'}</td>
                  <td>{pay.jobMetadata?.clientName || '—'}</td>
                  <td>{pay.createdBy?.employeeName || '—'}</td>
                  <td style={{ color: '#34d399' }}>Rs. {pay.amount.toLocaleString()}</td>
                  <td style={{ color: '#f87171' }}>Rs. {(pay.taxDeducted || 0).toLocaleString()}</td>
                  <td style={{ color: '#00f2fe', fontWeight: 'bold' }}>Rs. {(pay.amount - (pay.taxDeducted || 0)).toLocaleString()}</td>
                  <td>{pay.summaryNotes}</td>
                  <td>{pay.imageUrl ? <a href={pay.imageUrl} target="_blank" rel="noreferrer" style={{ color: '#00f2fe' }}>View</a> : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
