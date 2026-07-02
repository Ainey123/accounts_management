"use client";

import React, { useState, useEffect } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function EmployeeAllTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadTickets = async () => {
    setLoading(true);
    try {
      const result = await apiFetch('/api/tickets');
      setTickets(result.tickets || []);
    } catch (err) {
      console.error('Ticket load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const filteredTickets = tickets.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.subject?.toLowerCase().includes(q) ||
      t.sender?.toLowerCase().includes(q) ||
      t.serialNo?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>All Tickets</h1>
          <p style={{ color: '#a78bfa' }}>View all complaint tickets and their intake status</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
            <input
              className="nexus-input"
              style={{ paddingLeft: 32, width: 220 }}
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="button" className="nexus-btn nexus-btn-ghost" onClick={loadTickets} style={{ padding: '8px 12px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </header>

      <section className="glass-card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={32} style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
            <p>Loading tickets...</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>Total Tickets: {tickets.length}</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Sender</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No tickets found.</td>
                  </tr>
                ) : (
                  filteredTickets.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 600 }}>{t.serialNo}</td>
                      <td>{new Date(t.exactDate).toLocaleDateString()}</td>
                      <td>{t.time}</td>
                      <td>{t.sender}</td>
                      <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</td>
                      <td>
                        <span className={`status-pill ${t.jobMetadata ? 'active' : ''}`} style={!t.jobMetadata ? { background: 'rgba(248,113,113,0.2)', color: '#f87171' } : {}}>
                          {t.jobMetadata ? 'Intake Done' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: '#a78bfa' }}>
                        {t.jobMetadata?.assignedEmployee?.employeeName || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}