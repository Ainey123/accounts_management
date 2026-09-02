"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mail, RefreshCw, Link, X, Filter, Shield, Plus, Trash2, AlertTriangle, Copy, Check, ExternalLink, Key } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function GmailConnectionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [forceResetting, setForceResetting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [tickets, setTickets] = useState([]);
  const [oauthDetails, setOauthDetails] = useState(null);
  const [copied, setCopied] = useState(false);
  const oauthHandlerRef = useRef(null);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const loadOAuthInfo = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const data = await apiFetch(`/api/gmail-oauth?origin=${encodeURIComponent(origin)}`);
      setOauthDetails(data);
    } catch (e) {
      console.error('Failed to load OAuth info:', e);
    }
  };

  useEffect(() => {
    loadAccounts();
    loadTickets();
    loadOAuthInfo();
    return () => {
      if (oauthHandlerRef.current) {
        window.removeEventListener('message', oauthHandlerRef.current);
      }
    };
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await apiFetch('/api/gmail-account');
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = async () => {
    try {
      const { tickets: data } = await apiFetch('/api/tickets?pending=true');
      setTickets(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // Check URL for callback results
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const email = params.get('email');

    if (success) {
      setMessage(`Gmail ${email || ''} connected successfully!`);
      // Clean up URL
      window.history.replaceState({}, '', '/gmail');
      handleSync();
    } else if (error) {
      setMessage(`Connection failed: ${error}`);
      window.history.replaceState({}, '', '/gmail');
    }
  }, []);

  const handleConnect = useCallback(async () => {
    setMessage('Redirecting to Google for authentication...');
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { authUrl } = await apiFetch(`/api/gmail-oauth?origin=${encodeURIComponent(origin)}`);
      // Redirect in the same window (no popups)
      window.location.href = authUrl;
    } catch (err) {
      setMessage('Failed to start OAuth: ' + err.message);
    }
  }, [user]);

  const handleDisconnect = async (accountId) => {
    try {
      await apiFetch(`/api/gmail-account?accountId=${accountId}`, { method: 'DELETE' });
      setMessage('Gmail account disconnected');
      await loadAccounts();
    } catch (err) {
      setMessage('Disconnect failed');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage('');
    try {
      const result = await apiFetch('/api/gmail-sync', { method: 'POST' });
      const syncedCount = result.results?.reduce((sum, r) => sum + (r.synced || 0), 0) || result.synced || 0;
      const totalScanned = result.results?.reduce((sum, r) => sum + (r.totalScanned || 0), 0) || result.totalScanned || 0;
      const errors = (result.results || []).filter((r) => r.error).map((r) => `${r.email}: ${r.error}`).join(' | ');
      if (errors) {
        setMessage(`⚠️ Errors: ${errors}. Run diagnostics below for details.`);
      } else {
        setMessage(`✅ Synced ${syncedCount} new email(s) from ${totalScanned} scanned across ${result.results?.length || accounts.length} account(s)!`);
      }
      await loadAccounts();
      await loadTickets();
    } catch (err) {
      setMessage('❌ Sync failed: ' + err.message + ' — Try clicking "Run Diagnostics" to find out why.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDiagnostics = () => {
    window.open('/api/gmail-debug', '_blank');
  };

  const handleForceResync = async () => {
    setForceResetting(true);
    setMessage('');
    try {
      // Step 1: Clear sync history on the live database (removes the 2000 ID limit)
      await apiFetch('/api/gmail-force-reset', { method: 'POST' });
      setMessage('Sync history cleared. Now importing ALL emails...');
      
      // Step 2: Let React render the message, then trigger full sync
      await new Promise(r => setTimeout(r, 100));
      
      // Step 3: Trigger full sync — no filters, no exclusions, no limits
      await handleSync();
      setMessage('✅ Full re-sync complete! All emails from 2026 onwards have been imported.');
    } catch (err) {
      setMessage('Force re-sync failed: ' + err.message);
    } finally {
      setForceResetting(false);
    }
  };

  if (loading) {
    return <div className="glass-card"><p style={{ color: '#94a3b8' }}>Loading...</p></div>;
  }

  if (user?.role !== 'ADMIN') {
    return null; // Don't render anything while redirecting
  }

  return (
    <div>
      <header className="page-header">
        <h1>Gmail Integration</h1>
        <p>Connect multiple Gmail accounts to automatically sync complaint emails.</p>
      </header>

      {message && (
        <div className={message.includes('failed') || message.includes('failed') ? 'alert-error' : 'alert-success'} style={{ marginBottom: 20 }}>
          {message}
        </div>
      )}

      <div className="glass-card" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Connected Accounts ({accounts.length})</h2>

        {accounts.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
            <Mail size={40} color="#475569" style={{ marginBottom: 12 }} />
            <p style={{ color: '#94a3b8', marginBottom: 16 }}>No Gmail accounts connected yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {accounts.map((account) => (
              <div key={account.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'rgba(34, 197, 94, 0.05)', borderRadius: 12, border: '1px solid rgba(34, 197, 94, 0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, background: 'rgba(34, 197, 94, 0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={16} color="#22c55e" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{account.gmailEmail}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Last synced: {account.syncedAt ? new Date(account.syncedAt).toLocaleString() : 'Never'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-primary"
                    onClick={handleConnect}
                    style={{ padding: '6px 12px', fontSize: 13 }}
                    title="Re-authenticate if password changed or token expired"
                  >
                    <RefreshCw size={13} /> Reconnect
                  </button>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    onClick={() => handleDisconnect(account.id)}
                    style={{ color: '#ef4444', padding: '6px 12px' }}
                  >
                    <Trash2 size={14} /> Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}


        <button
          type="button"
          className="nexus-btn nexus-btn-primary"
          style={{ width: '100%', padding: 16, marginTop: 16 }}
          onClick={handleConnect}
        >
          <Plus size={18} /> Connect Another Gmail
        </button>

        {accounts.length > 0 && (
          <>
            <button
              type="button"
              className="nexus-btn nexus-btn-ghost"
              style={{ width: '100%', padding: 16, marginTop: 8 }}
              onClick={handleSync}
              disabled={syncing || forceResetting}
            >
              <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing All Accounts...' : `Sync ${accounts.length} Gmail Account(s) Now`}
            </button>

            <button
              type="button"
              className="nexus-btn"
              style={{
                width: '100%',
                padding: 16,
                marginTop: 8,
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                color: '#eab308',
              }}
              onClick={handleForceResync}
              disabled={syncing || forceResetting}
            >
              <AlertTriangle size={18} style={{ marginRight: 8 }} />
              {forceResetting ? 'Resetting Sync History...' : '⚠️ Force Full Re-Sync (Import ALL Emails)'}
            </button>

            <button
              type="button"
              className="nexus-btn"
              style={{
                width: '100%',
                padding: 16,
                marginTop: 8,
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: '#818cf8',
              }}
              onClick={handleDiagnostics}
            >
              🔍 Run Diagnostics (See Why Sync Fails)
            </button>
          </>
        )}

        {/* Google OAuth Configuration & Redirect URI helper */}
        <div style={{ marginTop: 24, padding: 18, background: 'rgba(15, 23, 42, 0.7)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#00f2fe', fontWeight: 600, fontSize: 14 }}>
              <Key size={16} /> Google OAuth Configuration Info
            </div>
            <a
              href="https://console.cloud.google.com/auth/clients?project=nexus-operations-500206"
              target="_blank"
              rel="noopener noreferrer"
              className="nexus-btn nexus-btn-ghost"
              style={{ fontSize: 12, padding: '4px 10px', color: '#a78bfa' }}
            >
              <ExternalLink size={13} /> Open Google Cloud Clients
            </a>
          </div>

          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, lineHeight: 1.5 }}>
            If Google returns <strong>Error 400 (Malformed request)</strong>, make sure the exact Redirect URI below is copied into your Google Cloud Console under <em>Authorized redirect URIs</em>:
          </p>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>
              Required Authorized Redirect URI:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
              <code style={{ fontSize: 12, color: '#00f2fe', flex: 1, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {oauthDetails?.redirectUri || (typeof window !== 'undefined' ? `${window.location.origin}/api/gmail/callback` : 'https://.../api/gmail/callback')}
              </code>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={() => {
                  const uri = oauthDetails?.redirectUri || `${window.location.origin}/api/gmail/callback`;
                  navigator.clipboard.writeText(uri);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{ padding: '4px 8px', fontSize: 12, color: copied ? '#22c55e' : '#fff' }}
                title="Copy Redirect URI"
              >
                {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>
              Configured Google Client ID:
            </label>
            <code style={{ fontSize: 11, color: '#94a3b8', wordBreak: 'break-all', fontFamily: 'monospace' }}>
              {oauthDetails?.clientId || 'Loading...'}
            </code>
          </div>
        </div>
      </div>

      <section className="glass-card">
        <h2 style={{ fontSize: 18, marginBottom: 20 }}>Synced Complaint Emails ({tickets.length})</h2>

        {tickets.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: 32 }}>
            No complaint emails synced yet. {accounts.length > 0 ? 'Click "Sync Gmail Account(s) Now" to fetch emails.' : 'Connect a Gmail account first.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tickets.map((ticket) => (
              <div key={ticket.id} style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>From:</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{ticket.sender}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right' }}>
                    <div>{new Date(ticket.exactDate).toLocaleDateString()}</div>
                    <div>{ticket.time}</div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Subject:</div>
                  <div style={{ fontSize: 15 }}>{ticket.subject}</div>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
                  {ticket.serialNo}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
