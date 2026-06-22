"use client";

import React, { useState } from 'react';
import { ShieldCheck, User, KeyRound, Briefcase, Settings } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('EMPLOYEE');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, activeTab);
    } catch (err) {
      setError(err.message || 'Access denied.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setEmail('');
    setPassword('');
    setError('');
  };

  return (
    <div className="glass-card login-card">
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ width: 64, height: 64, background: 'rgba(0,0,0,0.4)', borderRadius: 16, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
          <ShieldCheck size={32} color={activeTab === 'ADMIN' ? '#a78bfa' : '#00f2fe'} />
        </div>
        <h1 style={{ fontSize: 24 }}>NEXUS SECURE</h1>
      </div>

      <div className="tab-segment">
        <button
          type="button"
          className={`tab-segment-btn ${activeTab === 'EMPLOYEE' ? 'active-employee' : ''}`}
          onClick={() => switchTab('EMPLOYEE')}
        >
          <Briefcase size={16} /> Employee Terminal
        </button>
        <button
          type="button"
          className={`tab-segment-btn ${activeTab === 'ADMIN' ? 'active-admin' : ''}`}
          onClick={() => switchTab('ADMIN')}
        >
          <Settings size={16} /> Admin Command
        </button>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: 20 }}>{error}</div>}

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="field-label">Email Address</label>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', left: 14, top: 13, color: '#64748b' }} />
            <input
              type="email"
              className="nexus-input"
              style={{ paddingLeft: 44 }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={activeTab === 'ADMIN' ? 'admin@fes.com' : 'employee@fes.com'}
            />
          </div>
        </div>

        <div>
          <label className="field-label">Passcode</label>
          <div style={{ position: 'relative' }}>
            <KeyRound size={18} style={{ position: 'absolute', left: 14, top: 13, color: '#64748b' }} />
            <input
              type="password"
              className="nexus-input"
              style={{ paddingLeft: 44 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
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
