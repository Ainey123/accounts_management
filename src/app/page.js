"use client";

import React, { useState, useEffect } from 'react';
import { ShieldCheck, KeyRound, Briefcase, Settings, Layers, ChevronDown, HardHat, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { apiFetch } from '@/lib/api';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('EMPLOYEE');
  const [pin, setPin] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const { login } = useAuth();

  // Fetch office batches & field employee list for dropdowns
  useEffect(() => {
    if (activeTab === 'ADMIN') return;
    setLoadingEmployees(true);
    fetch(`/api/employees?all=true&t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        setEmployees(data.employees || []);
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false));
  }, [activeTab]);

  // Strict separation: Office batches (already ranked by highest Gmails) vs Field staff
  const officeEmployees = employees.filter((e) => e.role === 'EMPLOYEE');
  const fieldEmployees = employees.filter((e) => e.role === 'FIELD_EMPLOYEE');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (activeTab === 'FIELD_EMPLOYEE') {
      if (fieldEmployees.length === 0) {
        setError('No field employees registered yet. An admin must add field staff from the Admin Console.');
        return;
      }
      if (!selectedName) {
        setError('Please select your field employee name from the list.');
        return;
      }
    }

    if (activeTab === 'EMPLOYEE') {
      if (!selectedBatchId) {
        setError('Please select your batch from the office batch list.');
        return;
      }
    }

    setLoading(true);
    try {
      const selectedOfficeBatch = officeEmployees.find((emp) => String(emp.id) === String(selectedBatchId));
      const { user } = await apiFetch('/api/auth/pin-login', {
        method: 'POST',
        body: JSON.stringify({
          pin: String(pin).trim(),
          role: activeTab,
          employeeId: activeTab === 'EMPLOYEE' ? Number(selectedBatchId) : undefined,
          batchLabel: activeTab === 'EMPLOYEE' ? selectedOfficeBatch?.batchLabel : undefined,
          employeeName: activeTab === 'FIELD_EMPLOYEE' ? selectedName : undefined,
        }),
      });
      // Store full user info (including id, batchLabel, and employeeName) in cookie via AuthProvider
      await login(user.email, user.tempPassword, user.role, user);
    } catch (err) {
      setError(err.message || 'Access denied.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setPin('');
    setSelectedBatchId('');
    setSelectedName('');
    setError('');
  };

  return (
    <div className="glass-card login-card">
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ width: 64, height: 64, background: 'rgba(0,0,0,0.4)', borderRadius: 16, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
          {activeTab === 'FIELD_EMPLOYEE' ? (
            <HardHat size={32} color="#34d399" />
          ) : activeTab === 'ADMIN' ? (
            <ShieldCheck size={32} color="#a78bfa" />
          ) : (
            <Briefcase size={32} color="#00f2fe" />
          )}
        </div>
        <h1 style={{ fontSize: 24, letterSpacing: 0.5 }}>
          {activeTab === 'FIELD_EMPLOYEE' ? 'FIELD PORTAL' : activeTab === 'EMPLOYEE' ? 'OFFICE CONSOLE' : 'MASTER CONSOLE'}
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
          {activeTab === 'FIELD_EMPLOYEE'
            ? 'Field staff assigned jobs & project reports access'
            : activeTab === 'EMPLOYEE'
            ? 'Select your batch and enter PIN to access office operations'
            : 'Enter master admin PIN to access command center'}
        </p>
      </div>

      <div className="tab-segment" style={{ gap: 4 }}>
        <button
          type="button"
          className={`tab-segment-btn ${activeTab === 'EMPLOYEE' ? 'active-employee' : ''}`}
          onClick={() => switchTab('EMPLOYEE')}
        >
          <Briefcase size={15} style={{ display: 'inline', marginRight: 4 }} /> Office
        </button>
        <button
          type="button"
          className={`tab-segment-btn ${activeTab === 'FIELD_EMPLOYEE' ? 'active-field' : ''}`}
          onClick={() => switchTab('FIELD_EMPLOYEE')}
        >
          <HardHat size={15} style={{ display: 'inline', marginRight: 4 }} /> Field Portal
        </button>
        <button
          type="button"
          className={`tab-segment-btn ${activeTab === 'ADMIN' ? 'active-admin' : ''}`}
          onClick={() => switchTab('ADMIN')}
        >
          <Settings size={15} style={{ display: 'inline', marginRight: 4 }} /> Admin
        </button>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: 20 }}>{error}</div>}

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* OFFICE BATCH DROPDOWN (No Employee Personal Names) */}
        {activeTab === 'EMPLOYEE' && (
          <div>
            <label className="field-label">
              <Layers size={13} style={{ display: 'inline', marginRight: 4, color: '#00f2fe' }} />
              Office Batch
            </label>
            <div style={{ position: 'relative' }}>
              <select
                className="nexus-input"
                style={{ paddingLeft: 14, paddingRight: 36, appearance: 'none' }}
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                required
              >
                <option value="">
                  {loadingEmployees
                    ? 'Loading batches...'
                    : officeEmployees.length === 0
                    ? 'No office batches found — contact admin'
                    : '— Select your batch —'}
                </option>
                {officeEmployees.map((emp, idx) => {
                  const label = emp.batchLabel || `Batch ${idx + 1}`;
                  return (
                    <option key={emp.id} value={String(emp.id)}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: 13, color: '#64748b', pointerEvents: 'none' }} />
            </div>
          </div>
        )}

        {/* FIELD EMPLOYEE DROPDOWN */}
        {activeTab === 'FIELD_EMPLOYEE' && (
          <div>
            <label className="field-label">
              <HardHat size={13} style={{ display: 'inline', marginRight: 4, color: '#34d399' }} />
              Field Employee Name
            </label>
            <div style={{ position: 'relative' }}>
              <select
                className="nexus-input"
                style={{ paddingLeft: 14, paddingRight: 36, appearance: 'none' }}
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                disabled={loadingEmployees || fieldEmployees.length === 0}
                required
              >
                <option value="">
                  {loadingEmployees
                    ? 'Loading...'
                    : fieldEmployees.length === 0
                    ? '— No Field Employees Registered —'
                    : '— Select field employee name —'}
                </option>
                {fieldEmployees.map((emp) => (
                  <option key={emp.id} value={emp.employeeName}>
                    {emp.employeeName}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: 13, color: '#64748b', pointerEvents: 'none' }} />
            </div>

            {/* Clear notice when no field employees exist yet */}
            {fieldEmployees.length === 0 && !loadingEmployees && (
              <div style={{
                marginTop: 10,
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.08)',
                borderRadius: 8,
                fontSize: 12,
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                lineHeight: 1.4
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>No Field Employees Added Yet.</strong>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    Office staff cannot log in through the Field Portal. To register field employees or assign this role, log into the Admin Console under <strong>Employees</strong>.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="field-label">Security PIN</label>
          <div style={{ position: 'relative' }}>
            <KeyRound size={18} style={{ position: 'absolute', left: 14, top: 13, color: '#64748b' }} />
            <input
              type="password"
              inputMode="numeric"
              className="nexus-input"
              style={{ paddingLeft: 44 }}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              placeholder={activeTab === 'ADMIN' ? 'Enter admin PIN' : 'Enter 4-6 digit PIN'}
              maxLength={6}
            />
          </div>
        </div>

        <button
          type="submit"
          className="nexus-btn nexus-btn-primary"
          style={{
            width: '100%',
            padding: '16px',
            fontSize: 16,
            background: activeTab === 'FIELD_EMPLOYEE' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : undefined,
          }}
          disabled={loading || (activeTab === 'FIELD_EMPLOYEE' && fieldEmployees.length === 0)}
        >
          {loading
            ? 'Authenticating...'
            : activeTab === 'ADMIN'
            ? 'Access Master Console'
            : activeTab === 'FIELD_EMPLOYEE'
            ? fieldEmployees.length === 0
              ? 'No Field Staff Registered'
              : 'Open Field Portal'
            : 'Access Office Console'}
        </button>
      </form>
    </div>
  );
}
