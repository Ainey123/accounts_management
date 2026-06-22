"use client";

import React, { useState, useEffect } from 'react';
import { Send, Building, User, Briefcase } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useJob } from '@/components/JobContext';

const WORK_NATURES = [
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'WAPDA', label: 'WAPDA' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'PROJECT', label: 'Project' },
];

export default function IntakeGridPage() {
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
  });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/tickets?pending=true'),
      apiFetch('/api/users'),
    ]).then(([ticketRes, userRes]) => {
      setTickets(ticketRes.tickets);
      setEmployees(userRes.users.filter((u) => u.role === 'EMPLOYEE'));
      if (ticketRes.tickets.length) setSelectedTicketId(String(ticketRes.tickets[0].id));
    }).catch(console.error);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicketId) {
      setMessage('Select an incoming ticket first.');
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
        }),
      });
      setMessage('Job metadata saved. Serial assigned from ticket.');
      setForm({ clientName: '', branchName: '', personOfContact: '', workNature: '', assignedEmployeeId: '' });
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

  return (
    <div>
      <header className="page-header">
        <h1>Job Metadata Intake</h1>
        <p>Commercial customers and branches — stored in JobMetadata, never in User.</p>
      </header>

      <div className="glass-card" style={{ marginBottom: 28 }}>
        <label className="field-label">Link to Incoming Ticket</label>
        <select className="nexus-select" value={selectedTicketId} onChange={(e) => setSelectedTicketId(e.target.value)}>
          <option value="">Select ticket...</option>
          {tickets.map((t) => (
            <option key={t.id} value={t.id}>{t.serialNo} — {t.subject}</option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSubmit} className="glass-card">
        <div className="intake-grid">
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
        </div>

        {message && (
          <div className={message.includes('saved') ? 'alert-success' : 'alert-error'} style={{ marginTop: 20 }}>
            {message}
          </div>
        )}

        <button type="submit" className="nexus-btn nexus-btn-primary" style={{ width: '100%', marginTop: 24, padding: 16 }} disabled={submitting}>
          <Send size={18} /> {submitting ? 'Saving...' : 'Generate Serial & Save Metadata'}
        </button>
      </form>

      <section className="glass-card" style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18, marginBottom: 20 }}>Live Rolling Register</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Sr #</th>
              <th>Client</th>
              <th>Branch</th>
              <th>POC</th>
              <th>Work Nature</th>
              <th>Assigned</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No entries yet.</td></tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id}>
                  <td style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 600 }}>{job.ticket?.serialNo}</td>
                  <td>{job.clientName}</td>
                  <td>{job.branchName}</td>
                  <td>{job.personOfContact}</td>
                  <td>{job.workNature}</td>
                  <td>{job.assignedEmployee?.employeeName || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
