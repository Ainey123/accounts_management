"use client";

import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function OperationsFeedPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { tickets: data } = await apiFetch('/api/tickets');
      setTickets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  return (
    <div>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1>Operations Feed</h1>
          <p>Live Gmail ingestion stream awaiting job intake.</p>
        </div>
        <button type="button" className="nexus-btn nexus-btn-ghost" onClick={loadTickets}>
          <RefreshCw size={16} /> Refresh Feed
        </button>
      </header>

      {loading ? (
        <div className="glass-card"><p style={{ color: '#94a3b8' }}>Loading incoming tickets...</p></div>
      ) : tickets.length === 0 ? (
        <div className="glass-card">
          <p style={{ color: '#94a3b8' }}>No pending tickets. Gmail webhooks POST to <code>/api/gmail</code>.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tickets.map((ticket) => (
            <div key={ticket.id} className="glass-card ticket-summary">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ background: 'rgba(0,242,254,0.1)', padding: 10, borderRadius: 10, border: '1px solid rgba(0,242,254,0.2)' }}>
                  <Mail size={20} color="#00f2fe" />
                </div>
                <div>
                  <span className="field-label">Serial</span>
                  <div style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 700 }}>{ticket.serialNo}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
                <div>
                  <span className="field-label">Date & Time</span>
                  <div style={{ fontSize: 14 }}>
                    {new Date(ticket.exactDate).toLocaleDateString()} · {ticket.time}
                  </div>
                </div>
                <div>
                  <span className="field-label">Sender</span>
                  <div style={{ fontSize: 14 }}>{ticket.sender}</div>
                </div>
              </div>

              <div>
                <span className="field-label">Subject</span>
                <h3 style={{ fontSize: 18, marginTop: 4 }}>{ticket.subject}</h3>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
