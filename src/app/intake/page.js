"use client";

import React, { useState, useEffect } from 'react';
import { Send, Building, User, Briefcase, X, Copy } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useJob } from '@/components/JobContext';
import { useAuth } from '@/components/AuthProvider';

const WORK_NATURES = [
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'WAPDA', label: 'WAPDA' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'PROJECT', label: 'Project' },
];

export default function IntakeGridPage() {
  const { user } = useAuth();
  const { refreshJobs, jobs } = useJob();
  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [form, setForm] = useState({
    clientName: '',
    branchName: '',
    personOfContact: '',
    workNature: '',
    assignedEmployeeId: '',
    manualEnteredBy: '',
  });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualSubject, setManualSubject] = useState('');
  const [manualSender, setManualSender] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [copied, setCopied] = useState(false);
  const [jobSearch, setJobSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [ticketRes, userRes] = await Promise.all([
          apiFetch('/api/tickets'),
          apiFetch('/api/users'),
        ]);
        if (cancelled) return;
        const tickets = ticketRes.tickets || [];
        const employees = (userRes.users || []).filter((u) => u.role === 'EMPLOYEE');
        setTickets(tickets);
        setEmployees(employees);
        if (tickets.length) setSelectedTicketId(String(tickets[0].id));
      } catch (err) {
        if (!cancelled) console.error(err);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleTicketChange = (ticketId) => {
    setSelectedTicketId(ticketId);
    if (!ticketId) return;
    const ticket = (tickets || []).find((t) => String(t.id) === String(ticketId));
    if (ticket && !form.clientName) {
      const senderName = ticket.sender?.split('@')[0] || '';
      setForm((prev) => ({ ...prev, clientName: senderName }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicketId) {
      setMessage('Select or create an incoming ticket first.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      await apiFetch('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          ticketId: Number(selectedTicketId),
          clientName: form.clientName,
          branchName: form.branchName,
          personOfContact: form.personOfContact,
          workNature: form.workNature,
          assignedEmployeeId: form.assignedEmployeeId ? Number(form.assignedEmployeeId) : null,
          manualEnteredBy: form.manualEnteredBy,
        }),
      });
      setMessage('Job metadata saved. Serial assigned from ticket.');
      setForm({ clientName: '', branchName: '', personOfContact: '', workNature: '', assignedEmployeeId: '', manualEnteredBy: '' });
      const { tickets: updated } = await apiFetch('/api/tickets?pending=true');
      setTickets(updated);
      if (updated.length) setSelectedTicketId(String(updated[0].id));
      else setSelectedTicketId('');
      await refreshJobs();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateManualTicket = async (e) => {
    e.preventDefault();
    setCreatingTicket(true);
    setMessage('');
    try {
      const { ticket } = await apiFetch('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: manualSubject,
          sender: manualSender || 'Manual Entry',
          createdById: user?.id,
        }),
      });
      setTickets((prev) => [ticket, ...prev]);
      setSelectedTicketId(String(ticket.id));
      setShowManualForm(false);
      setManualSubject('');
      setManualSender('');
      setMessage('Manual ticket created.');
      await refreshJobs();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleCopyTicket = async () => {
    if (!selectedTicketId) return;
    const ticket = (tickets || []).find((t) => String(t.id) === String(selectedTicketId));
    if (!ticket) return;
    try {
      await navigator.clipboard.writeText(ticket.subject);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMessage('Failed to copy');
    }
  };

  const handleCopyJobSubject = async (subject) => {
    if (!subject || subject === '—') return;
    try {
      await navigator.clipboard.writeText(subject);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMessage('Failed to copy subject');
    }
  };

  return (
    <div>
      <header className="page-header">
        <h1>Job Metadata Intake</h1>
        <p>Commercial customers and branches — stored in JobMetadata, never in User.</p>
      </header>

      <div className="glass-card" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <label className="field-label" style={{ marginBottom: 0 }}>Link to Incoming Ticket</label>
          <button type="button" className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => setShowManualForm(true)}>
            + Manual Ticket
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="nexus-select" value={selectedTicketId} onChange={(e) => handleTicketChange(e.target.value)} disabled={loadingData} style={{ flex: 1 }}>
            <option value="">Select ticket...</option>
            {tickets.map((t) => (
              <option key={t.id} value={t.id}>{t.serialNo} — {t.subject}</option>
            ))}
          </select>
          <button
            type="button"
            className="nexus-btn nexus-btn-ghost"
            onClick={handleCopyTicket}
            disabled={!selectedTicketId}
            style={{ padding: '8px 12px', fontSize: 12 }}
            title="Copy serial and subject for verification"
          >
            {copied ? 'Copied!' : <><Copy size={14} /> Copy Subject</>}
          </button>
        </div>
        {tickets.length === 0 && !loadingData && (
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>No Gmail tickets. Click "+ Manual Ticket" to create one.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="glass-card">
        <div className="intake-grid" style={{ opacity: loadingData ? 0.5 : 1, pointerEvents: loadingData ? 'none' : 'auto' }}>
          <div>
            <label className="field-label"><User size={12} style={{ display: 'inline', marginRight: 4 }} />Client Name</label>
            <input className="nexus-input" name="clientName" value={form.clientName} onChange={handleChange} required placeholder="Commercial client" />
          </div>
          <div>
            <label className="field-label"><Building size={12} style={{ display: 'inline', marginRight: 4 }} />Branch Name</label>
            <input className="nexus-input" name="branchName" value={form.branchName} onChange={handleChange} required placeholder="Site branch" />
          </div>
          <div>
            <label className="field-label"><User size={12} style={{ display: 'inline', marginRight: 4 }} />Person of Contact</label>
            <input className="nexus-input" name="personOfContact" value={form.personOfContact} onChange={handleChange} required placeholder="POC name" />
          </div>
          <div>
            <label className="field-label"><Briefcase size={12} style={{ display: 'inline', marginRight: 4 }} />Work Nature</label>
            <select className="nexus-select" name="workNature" value={form.workNature} onChange={handleChange} required>
              <option value="">Select...</option>
              {WORK_NATURES.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Assigned Employee (User table)</label>
            <select className="nexus-select" name="assignedEmployeeId" value={form.assignedEmployeeId} onChange={handleChange}>
              <option value="">Unassigned</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.employeeName} ({emp.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label"><User size={12} style={{ display: 'inline', marginRight: 4 }} />Manually Entered By</label>
            <input className="nexus-input" name="manualEnteredBy" value={form.manualEnteredBy} onChange={handleChange} placeholder="If not in system" />
          </div>
        </div>

        {message && (
          <div className={message.includes('saved') ? 'alert-success' : 'alert-error'} style={{ marginTop: 20 }}>
            {message}
          </div>
        )}

        <button type="submit" className="nexus-btn nexus-btn-primary" style={{ width: '100%', marginTop: 24, padding: 16 }} disabled={submitting || loadingData}>
          <Send size={18} /> {loadingData ? 'Loading...' : submitting ? 'Saving...' : 'Generate Serial & Save Metadata'}
        </button>
      </form>

      <section className="glass-card" style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Live Rolling Register</h2>
          <input
            className="nexus-input"
            style={{ width: 260, padding: '8px 12px', fontSize: 13 }}
            placeholder="Search by client, branch, subject, POC..."
            value={jobSearch}
            onChange={(e) => setJobSearch(e.target.value)}
          />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Sr #</th>
              <th>Client</th>
              <th>Branch</th>
              <th>Subject / Ticket</th>
              <th>POC</th>
              <th>Work Nature</th>
              <th>Assigned / Entered By</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No entries yet.</td></tr>
            ) : (
              jobs
                .filter((job) => {
                  if (!jobSearch) return true;
                  const q = jobSearch.toLowerCase();
                  return (
                    job.clientName?.toLowerCase().includes(q) ||
                    job.branchName?.toLowerCase().includes(q) ||
                    job.personOfContact?.toLowerCase().includes(q) ||
                    job.workNature?.toLowerCase().includes(q) ||
                    job.ticket?.subject?.toLowerCase().includes(q) ||
                    job.ticket?.serialNo?.toLowerCase().includes(q) ||
                    job.assignedEmployee?.employeeName?.toLowerCase().includes(q) ||
                    job.manualEnteredBy?.toLowerCase().includes(q)
                  );
                })
                .map((job) => (
                  <tr key={job.id}>
                    <td style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 600 }}>{job.ticket?.serialNo}</td>
                    <td>{job.clientName}</td>
                    <td>{job.branchName}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 260 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{job.ticket?.subject || '—'}</span>
                        <button
                          type="button"
                          className="nexus-btn nexus-btn-ghost"
                          onClick={() => handleCopyJobSubject(job.ticket?.subject)}
                          style={{ padding: 4, minWidth: 'auto', flexShrink: 0 }}
                          title="Copy subject"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>
                    <td>{job.personOfContact}</td>
                    <td>{job.workNature}</td>
                    <td>{job.assignedEmployee?.employeeName || job.manualEnteredBy || '—'}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </section>

      {showManualForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowManualForm(false)}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0 }}>Create Manual Ticket</h3>
              <button type="button" className="nexus-btn nexus-btn-ghost" onClick={() => setShowManualForm(false)} style={{ padding: 8 }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateManualTicket} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Subject / Work Description</label>
                <input className="nexus-input" required value={manualSubject} onChange={(e) => setManualSubject(e.target.value)} placeholder="e.g. Electrical maintenance at Branch X" />
              </div>
              <div>
                <label className="field-label">Sender (Optional)</label>
                <input className="nexus-input" value={manualSender} onChange={(e) => setManualSender(e.target.value)} placeholder="Client name or email" />
              </div>
              <button type="submit" className="nexus-btn nexus-btn-primary" disabled={creatingTicket}>
                {creatingTicket ? 'Creating...' : 'Create Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
