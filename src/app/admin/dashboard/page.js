"use client";

import React, { useState, useEffect } from 'react';
import {
  Users, Activity, UserPlus, Trash2, X, UserCheck, ShieldAlert,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function AdminCommandCenter() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ employeeName: '', email: '', password: '' });
  const [message, setMessage] = useState('');

  const loadAll = async () => {
    const [userRes, statsRes, finRes] = await Promise.all([
      apiFetch('/api/users'),
      apiFetch('/api/admin/stats'),
      apiFetch('/api/admin/financials'),
    ]);
    setUsers(userRes.users);
    setStats(statsRes.stats);
    setFinancials(finRes.financials);
  };

  useEffect(() => {
    loadAll().catch(console.error);
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, role: 'EMPLOYEE' }),
      });
      setForm({ employeeName: '', email: '', password: '' });
      setIsModalOpen(false);
      setMessage('Employee registered in User table.');
      await loadAll();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleDelete = async (id, role) => {
    if (role === 'ADMIN') return;
    if (!confirm('Revoke this employee\'s system access?')) return;
    try {
      await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const employees = users.filter((u) => u.role === 'EMPLOYEE');

  return (
    <div className="admin-grid">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', padding: 12, borderRadius: 12 }}>
            <ShieldAlert size={28} color="#fff" />
          </div>
          <div>
            <h1>Admin Command Center</h1>
            <p style={{ color: '#a78bfa' }}>Level 5 Authorization Active</p>
          </div>
        </div>
      </header>

      {message && <div className="alert-success">{message}</div>}

      {/* Section B: Strategic Workflow Matrix */}
      <section className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Activity size={20} color="#f59e0b" />
          <h2 style={{ fontSize: 18, margin: 0 }}>Strategic Workflow Matrix</h2>
        </div>
        {stats && (
          <div className="admin-metrics-row">
            {[
              { label: 'Pending Gmail', value: stats.pendingTickets },
              { label: 'Intake Forms', value: stats.intakeForms },
              { label: 'Surveys', value: stats.surveys },
              { label: 'Unsigned Quotes', value: stats.pendingQuotations },
              { label: 'Pending Invoices', value: stats.pendingInvoices },
            ].map((m) => (
              <div key={m.label} className="metric-tile">
                <div className="metric-digit">{m.value}</div>
                <div className="metric-tile-label">{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section A: Live Employee Tracker */}
      <section className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Users size={20} color="#00f2fe" />
            <h2 style={{ fontSize: 18, margin: 0 }}>Live Employee Tracker</h2>
          </div>
          <button type="button" className="nexus-btn nexus-btn-primary" onClick={() => setIsModalOpen(true)}>
            <UserPlus size={16} /> Register Employee
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Email</th>
              <th>Active Serial</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const serial = emp.assignedJobs?.[0]?.ticket?.serialNo;
              return (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 600 }}>{emp.employeeName}</td>
                  <td>{emp.email}</td>
                  <td style={{ fontFamily: 'monospace', color: '#00f2fe' }}>{serial || '—'}</td>
                  <td>
                    <span className={`status-pill ${emp.activeStatus ? 'active' : 'inactive'}`}>
                      {emp.activeStatus ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="nexus-btn nexus-btn-ghost" onClick={() => handleDelete(emp.id, emp.role)} style={{ color: '#ef4444', padding: 8 }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Section C: Financial Ledger Terminal */}
      <section className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Activity size={20} color="#10b981" />
          <h2 style={{ fontSize: 18, margin: 0 }}>Financial Ledger Terminal</h2>
        </div>
        {financials && (
          <div className="financial-row">
            <div className="financial-tile">
              <span className="field-label">Total Site Expenses</span>
              <div className="financial-value">Rs. {financials.totalExpenses.toLocaleString()}</div>
            </div>
            <div className="financial-tile">
              <span className="field-label">Tax Deductions</span>
              <div className="financial-value" style={{ color: '#f87171' }}>Rs. {financials.taxDeduction.toLocaleString()}</div>
            </div>
            <div className="financial-tile net">
              <span className="field-label">Net Final Cash Flow</span>
              <div className="financial-value" style={{ color: '#34d399' }}>Rs. {financials.netCashFlow.toLocaleString()}</div>
            </div>
          </div>
        )}
      </section>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <UserCheck size={20} color="#00f2fe" />
                <h3 style={{ margin: 0 }}>Create Employee Account</h3>
              </div>
              <button type="button" className="nexus-btn nexus-btn-ghost" onClick={() => setIsModalOpen(false)} style={{ padding: 8 }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Full Legal Name</label>
                <input className="nexus-input" required value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Email (Login ID)</label>
                <input className="nexus-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Temporary Password</label>
                <input className="nexus-input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <button type="submit" className="nexus-btn nexus-btn-primary">Generate User Account</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
