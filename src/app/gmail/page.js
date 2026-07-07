"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mail, RefreshCw, Link, X, Filter, Shield, Plus, Trash2, AlertTriangle } from 'lucide-react';
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
  const oauthHandlerRef = useRef(null);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    loadAccounts();
    loadTickets();
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

  const handleConnect = useCallback(async () => {
    setMessage('');
    try {
      const { authUrl } = await apiFetch('/api/gmail-oauth');
      const popup = window.open(authUrl, 'gmail-oauth', 'width=600,height=700');
      if (!popup) {
        setMessage('Popup blocked. Please allow popups and try again.');
        return;
      }

      const handler = async (event) => {
        if (event.data?.type === 'gmail-oauth-success') {
          window.removeEventListener('message', handler);
          oauthHandlerRef.current = null;
          clearTimeout(timeoutId);
          popup.close();
          const { email: connectedEmail, tokens } = event.data;
          try {
            await apiFetch('/api/gmail-account', {
              method: 'POST',
              body: JSON.stringify({
                email: connectedEmail,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiryDate: tokens.expiry_date,
                userId: user?.id,
              }),
            });
            setMessage(`Gmail ${connectedEmail} connected successfully!`);
            await loadAccounts();
            await handleSync();
          } catch (err) {
            setMessage('Gmail connected but failed to save account: ' + err.message);
          }
        } else if (event.data?.type === 'gmail-oauth-error') {
          window.removeEventListener('message', handler);
          oauthHandlerRef.current = null;
          clearTimeout(timeoutId);
          popup.close();
          const errorMsg = event.data.error || 'Unknown error';
          if (errorMsg.includes('403') || errorMsg.includes('access_denied') || errorMsg.includes('not completed') || errorMsg.includes('400')) {
            setMessage('Google OAuth setup incomplete. Go to cloud.google.com → APIs & Services → OAuth consent screen → Fill ALL required fields (App name, Support email, Developer contact) → Add your Gmail as a "Test user" under Audience → Add redirect URI: https://accounts-management-ainey123s-projects.vercel.app/api/gmail/callback → Publish app. Then try again.');
          } else {
            setMessage('Connection failed: ' + errorMsg);
          }
        }
      };

      oauthHandlerRef.current = handler;
      window.addEventListener('message', handler);

      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handler);
        oauthHandlerRef.current = null;
        popup.close();
        setMessage('Connection timed out. If you see "has not completed verification", add your Gmail as a Test user in Google Cloud Console → OAuth consent screen.');
      }, 120000);
    } catch (err) {
      popup.close();
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
      const errors = (result.results || []).filter((r) => r.error).map((r) => `${r.email}: ${r.error}`).join(' | ');
      if (errors) {
        setMessage(`Errors: ${errors}`);
      } else {
        setMessage(`Synced ${syncedCount} email(s) across ${result.results?.length || accounts.length} account(s)!`);
      }
      await loadAccounts();
      await loadTickets();
    } catch (err) {
      setMessage('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
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
                <button
                  type="button"
                  className="nexus-btn nexus-btn-ghost"
                  onClick={() => handleDisconnect(account.id)}
                  style={{ color: '#ef4444' }}
                >
                  <Trash2 size={14} /> Disconnect
                </button>
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
          </>
        )}
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
