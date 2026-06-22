"use client";

import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, Link, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function GmailConnectionPage() {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    checkConnection();
    loadTickets();
  }, []);

  const checkConnection = async () => {
    try {
      const data = await apiFetch('/api/gmail-account');
      setConnected(data.connected);
      if (data.connected) {
        setEmail(data.email);
      }
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

  const handleConnect = async () => {
    try {
      // Get OAuth URL
      const { authUrl } = await apiFetch('/api/gmail-oauth');
      
      // Open OAuth popup
      const popup = window.open(authUrl, 'gmail-oauth', 'width=600,height=700');
      
      // Listen for message from callback
      window.addEventListener('message', async (event) => {
        if (event.data?.type === 'gmail-oauth-success') {
          const { email, tokens } = event.data;
          
          // Save tokens
          await apiFetch('/api/gmail-account', {
            method: 'POST',
            body: JSON.stringify({
              email,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiryDate: tokens.expiry_date,
            }),
          });
          
          setConnected(true);
          setEmail(email);
          setMessage('Gmail connected successfully!');
          
          // Auto-sync
          await handleSync();
        }
      });
    } catch (err) {
      setMessage('Connection failed: ' + err.message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await apiFetch('/api/gmail-account', { method: 'DELETE' });
      setConnected(false);
      setEmail('');
      setMessage('Gmail disconnected');
    } catch (err) {
      setMessage('Disconnect failed');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage('');
    try {
      const result = await apiFetch('/api/gmail-sync', { method: 'POST' });
      setMessage(`Synced ${result.synced} new emails!`);
      await loadTickets();
    } catch (err) {
      setMessage('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="glass-card"><p style={{ color: '#94a3b8' }}>Loading...</p></div>;
  }

  return (
    <div>
      <header className="page-header">
        <h1>Gmail Integration</h1>
        <p>Connect your Gmail to automatically sync emails.</p>
      </header>

      {message && (
        <div className={message.includes('failed') ? 'alert-error' : 'alert-success'} style={{ marginBottom: 20 }}>
          {message}
        </div>
      )}

      <div className="glass-card" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Connection Status</h2>
        
        {connected ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 12, border: '1px solid rgba(34, 197, 94, 0.2)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, background: 'rgba(34, 197, 94, 0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={20} color="#22c55e" />
                </div>
                <div>
                  <div style={{ fontSize: 14, color: '#94a3b8' }}>Connected</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{email}</div>
                </div>
              </div>
              <button type="button" className="nexus-btn nexus-btn-ghost" onClick={handleDisconnect}>
                <X size={16} /> Disconnect
              </button>
            </div>

            <button 
              type="button" 
              className="nexus-btn nexus-btn-primary" 
              style={{ width: '100%', padding: 16 }}
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} /> 
              {syncing ? 'Syncing...' : 'Sync Emails Now'}
            </button>
          </div>
        ) : (
          <button 
            type="button" 
            className="nexus-btn nexus-btn-primary" 
            style={{ width: '100%', padding: 16 }}
            onClick={handleConnect}
          >
            <Link size={18} /> Connect Gmail
          </button>
        )}
      </div>

      <section className="glass-card">
        <h2 style={{ fontSize: 18, marginBottom: 20 }}>Synced Emails ({tickets.length})</h2>
        
        {tickets.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: 32 }}>
            No emails synced yet. {connected ? 'Click "Sync Emails Now" to fetch emails.' : 'Connect your Gmail account first.'}
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
                  #{ticket.serialNo}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
