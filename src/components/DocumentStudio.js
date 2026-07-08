"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, Lock, Plus, X, FileText } from 'lucide-react';
import { useJob } from '@/components/JobContext';
import JobSelector from '@/components/JobSelector';
import { apiFetch } from '@/lib/api';

const DEFAULT_LINE = { sr: 1, description: '', unit: 'Nos', qty: 1, rate: 0, amount: 0 };

export default function DocumentStudio({ documentType = 'QUOTATION', jobId: propJobId, job: propJob, onSaveSuccess }) {
  const { activeJob, activeJobId: contextJobId, jobs } = useJob();
  const activeJobId = propJobId || contextJobId;
  const job = propJob || (propJobId ? jobs.find(j => j.id === propJobId) : activeJob);
  const pdfRef = useRef(null);
  const genRef = useRef(0);
  const [isLocked, setIsLocked] = useState(false);
  const [documentId, setDocumentId] = useState(null);
  const [lineItems, setLineItems] = useState([{ ...DEFAULT_LINE }]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const title =
    documentType === 'INVOICE'
      ? 'INVOICE FOR MAINTENANCE WORK'
      : 'QUOTATION FOR MAINTENANCE WORK';

  const loadDocument = useCallback(async () => {
    const gen = ++genRef.current;
    if (!activeJobId) return;
    try {
      const { documents } = await apiFetch(
        `/api/quotations?jobMetadataId=${activeJobId}&documentType=${documentType}`
      );
      if (gen !== genRef.current) return;
      if (documents.length) {
        const doc = documents[0];
        setDocumentId(doc.id);
        const items = Array.isArray(doc.lineItems) ? doc.lineItems : [];
        setLineItems(items.length ? items : [{ ...DEFAULT_LINE }]);
      } else {
        setDocumentId(null);
        setLineItems([{ ...DEFAULT_LINE }]);
      }
    } catch (err) {
      if (gen !== genRef.current) return;
      console.error(err);
    }
  }, [activeJobId, documentType]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const handleItemChange = (index, field, value) => {
    const next = [...lineItems];
    next[index] = { ...next[index], [field]: value };
    if (field === 'qty' || field === 'rate') {
      const q = parseFloat(next[index].qty) || 0;
      const r = parseFloat(next[index].rate) || 0;
      next[index].amount = q * r;
    }
    setLineItems(next);
  };

  const addRow = () => {
    setLineItems([
      ...lineItems,
      { sr: lineItems.length + 1, description: '', unit: 'Nos', qty: 1, rate: 0, amount: 0 },
    ]);
  };

  const removeRow = (index) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const saveDocument = async () => {
    if (!activeJobId) {
      setMessage('Select an active job first.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        jobMetadataId: activeJobId,
        documentType,
        lineItems: lineItems.map((item, i) => ({ ...item, sr: i + 1 })),
      };
      if (documentId) {
        await apiFetch('/api/quotations', {
          method: 'PATCH',
          body: JSON.stringify({ id: documentId, lineItems: payload.lineItems }),
        });
      } else {
        const { document } = await apiFetch('/api/quotations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setDocumentId(document.id);
      }
      setMessage('Document saved successfully.');
      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    const element = pdfRef.current;
    if (!element) return;
    const hidden = document.querySelectorAll('.hide-in-pdf');
    hidden.forEach((el) => { el.style.display = 'none'; });
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${documentType}_FES.pdf`);
    } catch (err) {
      console.error(err);
      setMessage('PDF generation failed.');
    } finally {
      hidden.forEach((el) => { el.style.display = ''; });
    }
  };

  const totalAmount = lineItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

  const isEmbedded = !!propJobId;

  return (
    <div>
      {isEmbedded ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>
            {documentType === 'INVOICE' ? 'Invoice Studio' : 'Quotation Studio'}
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="nexus-btn nexus-btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setIsLocked(!isLocked)}>
              <Lock size={13} /> {isLocked ? 'Unlock' : 'Lock Edit'}
            </button>
            <button type="button" className="nexus-btn nexus-btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={saveDocument} disabled={saving}>
              Save
            </button>
            <button type="button" className="nexus-btn nexus-btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleDownloadPDF}>
              <Download size={13} /> Download PDF
            </button>
          </div>
        </div>
      ) : (
        <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1>{documentType === 'INVOICE' ? 'Invoice Studio' : 'Quotation Studio'}</h1>
            <p>Official A4 letterhead document with PDF export.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="nexus-btn nexus-btn-ghost" onClick={() => setIsLocked(!isLocked)}>
              <Lock size={16} /> {isLocked ? 'Unlock' : 'Lock Edit'}
            </button>
            <button type="button" className="nexus-btn nexus-btn-ghost" onClick={saveDocument} disabled={saving}>
              Save
            </button>
            <button type="button" className="nexus-btn nexus-btn-primary" onClick={handleDownloadPDF}>
              <Download size={16} /> Download PDF
            </button>
          </div>
        </header>
      )}

      {!isEmbedded && <JobSelector />}
      {message && <div className={message.includes('success') ? 'alert-success' : 'alert-error'} style={{ marginBottom: 20 }}>{message}</div>}

      <div ref={pdfRef} className="a4-document">
        <div className="a4-letterhead">
          <div style={{ width: 80, height: 80, marginRight: 24, flexShrink: 0, position: 'relative' }}>
            <Image
              src="/logo.png"
              alt="Company Logo"
              fill
              style={{ objectFit: 'contain' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: '0 0 8px', color: '#1e40af', fontSize: 28, fontWeight: 900, textTransform: 'uppercase' }}>
              FES FAST Engineering Solutions
            </h1>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#475569' }}>fastengineeringsolutions.com</p>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#475569' }}>info@fastengineeringsolutions.com</p>
            <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>fastsales.services@gmail.com</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ flex: 1, paddingRight: 20 }}>
            <div style={{ display: 'flex', marginBottom: 4 }}>
              <strong style={{ marginRight: 4 }}>Attn:</strong>
              <span>{job?.personOfContact || '—'}</span>
            </div>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{job?.clientName || '—'}</div>
            <div style={{ display: 'flex' }}>
              <strong style={{ marginRight: 4 }}>Site:</strong>
              <span>{job?.branchName || '—'}</span>
            </div>
          </div>
          <div style={{ flex: 1, maxWidth: 200 }}>
            <div style={{ display: 'flex', marginBottom: 4 }}>
              <strong style={{ marginRight: 4 }}>Date:</strong>
              <span>{job?.ticket?.exactDate ? new Date(job.ticket.exactDate).toLocaleDateString() : new Date().toLocaleDateString()}</span>
            </div>
            <div style={{ display: 'flex' }}>
              <strong style={{ marginRight: 4 }}>Ref.No:</strong>
              <span>{job?.ticket?.serialNo || '—'}</span>
            </div>
          </div>
        </div>

        <div className="a4-title-bar">{title}</div>

        <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 24, color: '#334155' }}>
          Dear Sir,<br /><br />
          With reference to the mentioned subject and detailed Engineering Survey of Site, please find the below detailed prices.
        </p>

        <table className="a4-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>Sr.#</th>
              <th style={{ width: '55%' }}>Description</th>
              <th style={{ width: '10%' }}>Unit</th>
              <th style={{ width: '10%', textAlign: 'center' }}>Qty</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Rate</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => (
              <tr key={index}>
                <td style={{ padding: 8, textAlign: 'center' }}>{index + 1}</td>
                <td>
                  <textarea
                    className="a4-cell-input"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    disabled={isLocked}
                    rows={2}
                    placeholder="Enter description..."
                  />
                </td>
                <td>
                  <input className="a4-cell-input" value={item.unit} onChange={(e) => handleItemChange(index, 'unit', e.target.value)} disabled={isLocked} />
                </td>
                <td>
                  <input className="a4-cell-input" type="number" value={item.qty} onChange={(e) => handleItemChange(index, 'qty', e.target.value)} disabled={isLocked} style={{ textAlign: 'center' }} />
                </td>
                <td>
                  <input className="a4-cell-input" type="number" value={item.rate} onChange={(e) => handleItemChange(index, 'rate', e.target.value)} disabled={isLocked} style={{ textAlign: 'right' }} />
                </td>
                <td style={{ padding: 8, textAlign: 'right', fontWeight: 'bold' }}>
                  {(Number(item.amount) || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ padding: 10, textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #1e40af' }}>
                GRAND TOTAL (Rs):
              </td>
              <td style={{ padding: 10, textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #1e40af' }}>
                {totalAmount.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>

        {!isLocked && (
          <button type="button" className="hide-in-pdf nexus-btn nexus-btn-ghost" onClick={addRow} style={{ marginTop: 16, color: '#1e40af', borderColor: '#cbd5e1' }}>
            <Plus size={16} /> Add Row
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 64, fontSize: 13 }}>
          {['Prepared By', 'Approved By', 'Client Signature'].map((label) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ width: 150, borderBottom: '1px solid #cbd5e1', marginBottom: 8 }} />
              <p style={{ margin: 0, fontWeight: 'bold' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
