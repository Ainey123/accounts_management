"use client";

import React, { useState, useEffect } from 'react';
import { ShieldCheck, KeyRound, Briefcase, Settings, User, ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { apiFetch } from '@/lib/api';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('EMPLOYEE');
  const [pin, setPin] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const { login } = useAuth();

  // Fetch employee names for dropdown when on EMPLOYEE tab
  useEffect(() => {
    if (activeTab !== 'EMPLOYEE') return;
    setLoadingEmployees(true);
    fetch('/api/employees')
      .then((r) => r.json())
      .then((data) => {
        setEmployees(data.employees || []);
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false));
  }, [activeTab]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (activeTab === 'EMPLOYEE' && !selectedName) {
      setError('Please select your name from the list.');
      return;
    }

    setLoading(true);
    try {
      const { user } = await apiFetch('/api/auth/pin-login', {
        method: 'POST',
        body: JSON.stringify({
          pin: String(pin).trim(),
          role: activeTab,
          employeeName: activeTab === 'EMPLOYEE' ? selectedName : undefined,
        }),
      });
      // Store full user info (including id and employeeName) in cookie via AuthProvider
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
    setSelectedName('');
    setError('');
  };

  return (
    <div className="glass-card login-card">
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ width: 64, height: 64, background: 'rgba(0,0,0,0.4)', borderRadius: 16, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
          <ShieldCheck size={32} color={activeTab === 'ADMIN' ? '#a78bfa' : '#00f2fe'} />
        </div>
        <h1 style={{ fontSize: 24 }}>NEXUS ACCESS</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
          {activeTab === 'EMPLOYEE' ? 'Select your name and enter PIN to access' : 'Enter admin PIN to access'}
        </p>
      </div>

      <div className="tab-segment">
        <button
          type="button"
          className={`tab-segment-btn ${activeTab === 'EMPLOYEE' ? 'active-employee' : ''}`}
          onClick={() => switchTab('EMPLOYEE')}
        >
          <Briefcase size={16} /> Employee
        </button>
        <button
          type="button"
          className={`tab-segment-btn ${activeTab === 'ADMIN' ? 'active-admin' : ''}`}
          onClick={() => switchTab('ADMIN')}
        >
          <Settings size={16} /> Admin
        </button>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: 20 }}>{error}</div>}

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Name dropdown — only for employees */}
        {activeTab === 'EMPLOYEE' && (
          <div>
            <label className="field-label">
              <User size={13} style={{ display: 'inline', marginRight: 4 }} />
              Your Name
            </label>
            <div style={{ position: 'relative' }}>
              <select
                className="nexus-input"
                style={{ paddingLeft: 14, paddingRight: 36, appearance: 'none' }}
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                required
              >
                <option value="">
                  {loadingEmployees ? 'Loading...' : employees.length === 0 ? 'No employees found — contact admin' : '— Select your name —'}
                </option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.employeeName}>
                    {emp.employeeName}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: 13, color: '#64748b', pointerEvents: 'none' }} />
            </div>
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
              placeholder={activeTab === 'EMPLOYEE' ? 'Enter your PIN' : 'Enter admin PIN'}
              maxLength={6}
            />
          </div>
        </div>

        <button
          type="submit"
          className="nexus-btn nexus-btn-primary"
          style={{ width: '100%', padding: '16px', fontSize: 16 }}
          disabled={loading}
        >
          {loading ? 'Authenticating...' : activeTab === 'ADMIN' ? 'Access Master Console' : 'Secure Login'}
        </button>
      </form>
    </div>
  );
}