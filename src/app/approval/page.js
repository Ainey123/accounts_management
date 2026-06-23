"use client";

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, FileKey } from 'lucide-react';
import JobSelector from '@/components/JobSelector';
import { useJob } from '@/components/JobContext';
import { apiFetch } from '@/lib/api';

export default function BankApprovalPage() {
  const { activeJobId } = useJob();
  const [documentId, setDocumentId] = useState(null);
  const [status, setStatus] = useState('PENDING');
  const [poNumber, setPoNumber] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeJobId) return;
    apiFetch(`/api/quotations?jobMetadataId=${activeJobId}&documentType=QUOTATION`)
      .then(({ documents }) => {
        if (documents.length) {
          const doc = documents[0];
          setDocumentId(doc.id);
          setStatus(doc.status);
          setPoNumber(doc.poNumber || '');
        } else {
          setDocumentId(null);
          setStatus('PENDING');
          setPoNumber('');
        }
      })
      .catch(console.error);
  }, [activeJobId]);

  const updateStatus = async (newStatus) => {
    if (!documentId) {
      setMessage('Create a quotation for this job first.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await apiFetch('/api/quotations', {
        method: 'PATCH',
        body: JSON.stringify({
          id: documentId,
          status: newStatus,
          poNumber: newStatus === 'APPROVED' ? poNumber : null,
        }),
      });
      setStatus(newStatus);
      if (newStatus !== 'APPROVED') setPoNumber('');
      setMessage(`Status updated to ${newStatus}.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const savePo = async () => {
    if (!documentId || status !== 'APPROVED') return;
    setSaving(true);
    try {
      await apiFetch('/api/quotations', {
        method: 'PATCH',
        body: JSON.stringify({ id: documentId, poNumber }),
      });
      setMessage('PO number saved.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const statusClass = {
    PENDING: 'selected-pending',
    APPROVED: 'selected-approved',
    CANCELLED: 'selected-cancelled',
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <header className="page-header" style={{ textAlign: 'center' }}>
        <h1>Bank Approval Console</h1>
        <p>Quotation status and PO assignment.</p>
      </header>

      <JobSelector />
      {message && <div className={message.includes('updated') || message.includes('saved') ? 'alert-success' : 'alert-error'} style={{ marginBottom: 20 }}>{message}</div>}

      <div className="glass-card">
        <label className="field-label">Current Status</label>
        <div className="status-segment" style={{ marginBottom: 28 }}>
          <button type="button" className={`status-segment-btn ${status === 'PENDING' ? statusClass.PENDING : ''}`} onClick={() => updateStatus('PENDING')} disabled={saving}>
            <Clock size={16} /> Pending
          </button>
          <button type="button" className={`status-segment-btn ${status === 'APPROVED' ? statusClass.APPROVED : ''}`} onClick={() => updateStatus('APPROVED')} disabled={saving}>
            <CheckCircle size={16} /> Approved
          </button>
          <button type="button" className={`status-segment-btn ${status === 'CANCELLED' ? statusClass.CANCELLED : ''}`} onClick={() => updateStatus('CANCELLED')} disabled={saving}>
            <XCircle size={16} /> Cancelled
          </button>
        </div>

        <div style={{ opacity: status === 'APPROVED' ? 1 : 0.4, pointerEvents: status === 'APPROVED' ? 'auto' : 'none' }}>
          <label className="field-label">Purchase Order Number</label>
          <div style={{ position: 'relative' }}>
            <FileKey size={18} style={{ position: 'absolute', left: 14, top: 13, color: '#10b981' }} />
            <input
              className="nexus-input"
              style={{ paddingLeft: 44, fontFamily: 'monospace', fontSize: 16 }}
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              onBlur={savePo}
              placeholder="Enter official PO number..."
              disabled={status !== 'APPROVED' || saving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
