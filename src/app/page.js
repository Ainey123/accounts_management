"use client";

import React, { useState } from 'react';
import { ShieldCheck, KeyRound, Briefcase, Settings } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { apiFetch } from '@/lib/api';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('EMPLOYEE');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await apiFetch('/api/auth/pin-login', {
        method: 'POST',
        body: JSON.stringify({ pin: pin.trim(), role: activeTab }),
      });
      await login(user.email, user.tempPassword, user.role);
    } catch (err) {
      setError(err.message || 'Access denied.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setPin('');
    setError('');
  };

  return (
    <div className="glass-card login-card">
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ width: 64, height: 64, background: 'rgba(0,0,0,0.4)', borderRadius: 16, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
          <ShieldCheck size={32} color={activeTab === 'ADMIN' ? '#a78bfa' : '#00f2fe'} />
        </div>
        <h1 style={{ fontSize: 24 }}>NEXUS ACCESS</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Enter PIN to access</p>
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
              placeholder="Enter 6-digit PIN"
              maxLength={6}
            />
          </div>
        </div>

        <button type="submit" className="nexus-btn nexus-btn-primary" style={{ width: '100%', padding: '16px', fontSize: 16 }} disabled={loading}>
          {loading ? 'Authenticating...' : activeTab === 'ADMIN' ? 'Access Master Console' : 'Secure Login'}
        </button>
      </form>
    </div>
  );
}