"use client";

import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function FinancialLedgerPage() {
  const [financials, setFinancials] = useState(null);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    apiFetch('/api/admin/financials')
      .then((data) => {
        setFinancials(data.financials);
        setExpenses(data.expenses);
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
          <DollarSign size={20} color="#10b981" /> Tax Breakdown
        </h2>
        <div className="financial-row">
          <div className="financial-tile">
            <span className="field-label">Gross Revenue</span>
            <div className="financial-value" style={{ color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={20} color="#10b981" />
              Rs. {financials.grossRevenue.toLocaleString()}
            </div>
          </div>
          <div className="financial-tile">
            <span className="field-label">Total Expenses</span>
            <div className="financial-value" style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingDown size={20} color="#ef4444" />
              Rs. {financials.totalExpenses.toLocaleString()}
            </div>
          </div>
          <div className="financial-tile">
            <span className="field-label">Tax Deduction ({Math.round(financials.taxRate * 100)}%)</span>
            <div className="financial-value" style={{ color: '#22d3ee' }}>
              Rs. {financials.taxDeduction.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="financial-tile net" style={{ marginTop: 16 }}>
          <span className="field-label">Net Final Cash Flow</span>
          <div className="financial-value" style={{ color: '#34d399', fontSize: 36 }}>
            Rs. {financials.netCashFlow.toLocaleString()}
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
    </div>
  );
}
