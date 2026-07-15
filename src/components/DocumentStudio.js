"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, Lock, Plus, X, FileText, Globe, Mail } from 'lucide-react';
import { useJob } from '@/components/JobContext';
import JobSelector from '@/components/JobSelector';
import { apiFetch } from '@/lib/api';

const DEFAULT_LINE = { sr: 1, description: '', unit: 'Nos', qty: 1, rate: 0, amount: 0 };

const formatDate = (dateInput) => {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const nature = job?.workNature ? job.workNature.toUpperCase() : 'MAINTENANCE';
  const title =
    documentType === 'INVOICE'
      ? `INVOICE FOR ${nature} WORK`
      : `QUOTATION FOR ${nature} WORK`;

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
        if (documentType === 'INVOICE') {
          try {
            const res = await apiFetch(`/api/quotations?jobMetadataId=${activeJobId}&documentType=QUOTATION`);
            if (res.documents && res.documents.length) {
              setDocumentId(null);
              const items = Array.isArray(res.documents[0].lineItems) ? res.documents[0].lineItems : [];
              setLineItems(items.length ? items : [{ ...DEFAULT_LINE }]);
              return;
            }
          } catch (e) {
            console.error('Failed to carry over quotation', e);
          }
        }
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
    setIsGeneratingPDF(true);
    // Give React state update a moment to render read-only text before screenshotting
    await new Promise((resolve) => setTimeout(resolve, 150));
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
      setIsGeneratingPDF(false);
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
        <div className="a4-letterhead" style={{ borderBottom: 'none' }}>
          <div style={{ width: 120, height: 120, marginRight: 24, flexShrink: 0, position: 'relative' }}>
            <Image
              src="/logo.png"
              alt="FES Logo"
              fill
              sizes="120px"
              priority
              style={{ objectFit: 'contain' }}
              onError={(e) => {
                console.error("Logo image failed to load");
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ margin: 0, color: '#C1272D', fontSize: '34px', fontWeight: 900, textTransform: 'uppercase', fontFamily: 'Arial, sans-serif', letterSpacing: '0.5px' }}>
                FAST
              </span>
              <span style={{ margin: 0, color: '#1B4372', fontSize: '24px', fontWeight: 700, fontFamily: 'Arial, sans-serif', marginLeft: '6px', letterSpacing: '0.2px' }}>
                Engineering Solutions
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#1B4372', fontWeight: '500' }}>
                <Globe size={12} style={{ color: '#1B4372' }} />
                <span>www.fastengineeringsolutions.com</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#1B4372', fontWeight: '500' }}>
                <Mail size={12} style={{ color: '#1B4372' }} />
                <span>info@fastengineeringsolutions.com</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#1B4372', fontWeight: '500' }}>
                <Mail size={12} style={{ color: '#1B4372' }} />
                <span>fastsales.services@gmail.com</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, fontSize: 13, lineHeight: 1.5, color: '#1e293b', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ flex: 1, paddingRight: 20 }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>
                Attn. {job?.personOfContact ? job.personOfContact.toUpperCase() : '—'}
              </span>
            </div>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
              {job?.clientName ? job.clientName.toUpperCase() : '—'}
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>Site : </strong>
              <span>{job?.branchName ? job.branchName.toUpperCase() : '—'}</span>
            </div>
            <div>
              <span>{job?.workNature ? job.workNature.toUpperCase() : '—'}</span>
            </div>
          </div>
          <div style={{ width: '220px', flexShrink: 0 }}>
            <div style={{ marginBottom: 4 }}>
              <strong style={{ display: 'inline-block', width: '60px' }}>Date:</strong>
              <span>{formatDate(job?.ticket?.exactDate)}</span>
            </div>
            <div>
              <strong style={{ display: 'inline-block', width: '60px' }}>Ref.No:</strong>
              <span>{job?.ticket?.serialNo ? `${documentType === 'INVOICE' ? 'I' : 'Q'}${job.ticket.serialNo}` : '—'}</span>
            </div>
          </div>
        </div>

        <div className="a4-title-bar" style={{ backgroundColor: '#1b4372' }}>{title}</div>

        <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 24, color: '#334155', fontFamily: 'Arial, sans-serif' }}>
          Dear Sir,<br /><br />
          With reference to the mentioned subject and detailed Engineering Survey of Site, please find the below detailed prices.
        </p>

        <table className="a4-table" style={{ fontFamily: 'Arial, sans-serif' }}>
          <thead>
            <tr>
              <th style={{ width: '6%', textAlign: 'center', backgroundColor: '#1b4372', borderColor: '#cbd5e1', padding: '10px 8px' }}>Sr.#</th>
              <th style={{ width: isLocked ? '54%' : '48%', backgroundColor: '#1b4372', borderColor: '#cbd5e1', padding: '10px 8px' }}>Description</th>
              <th style={{ width: '10%', textAlign: 'center', backgroundColor: '#1b4372', borderColor: '#cbd5e1', padding: '10px 8px' }}>Unit</th>
              <th style={{ width: '10%', textAlign: 'center', backgroundColor: '#1b4372', borderColor: '#cbd5e1', padding: '10px 8px' }}>Qty</th>
              <th style={{ width: '10%', textAlign: 'right', backgroundColor: '#1b4372', borderColor: '#cbd5e1', padding: '10px 8px' }}>Rate</th>
              <th style={{ width: '10%', textAlign: 'right', backgroundColor: '#1b4372', borderColor: '#cbd5e1', padding: '10px 8px' }}>Amount</th>
              {!isLocked && !isGeneratingPDF && <th className="hide-in-pdf" style={{ width: '6%', textAlign: 'center', backgroundColor: '#1b4372', borderColor: '#cbd5e1', padding: '10px 8px' }}></th>}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => {
              const isReadOnly = isLocked || isGeneratingPDF;
              return (
                <tr key={index}>
                  <td style={{ padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle', borderColor: '#cbd5e1', fontSize: '13px' }}>{index + 1}</td>
                  <td style={{ verticalAlign: 'top', borderColor: '#cbd5e1' }}>
                    {isReadOnly ? (
                      <div style={{ padding: '10px 8px', whiteSpace: 'pre-wrap', minHeight: '36px', fontSize: '13px', lineHeight: '1.5', color: '#1e293b' }}>
                        {item.description}
                      </div>
                    ) : (
                      <textarea
                        className="a4-cell-input"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        rows={2}
                        placeholder="Enter description..."
                        style={{ padding: '8px', display: 'block', resize: 'vertical' }}
                      />
                    )}
                  </td>
                  <td style={{ verticalAlign: 'middle', textAlign: 'center', borderColor: '#cbd5e1' }}>
                    {isReadOnly ? (
                      <span style={{ fontSize: '13px' }}>{item.unit}</span>
                    ) : (
                      <input 
                        className="a4-cell-input" 
                        value={item.unit} 
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)} 
                        style={{ textAlign: 'center' }} 
                      />
                    )}
                  </td>
                  <td style={{ verticalAlign: 'middle', textAlign: 'center', borderColor: '#cbd5e1' }}>
                    {isReadOnly ? (
                      <span style={{ fontSize: '13px' }}>{item.qty}</span>
                    ) : (
                      <input 
                        className="a4-cell-input" 
                        type="number" 
                        value={item.qty} 
                        onChange={(e) => handleItemChange(index, 'qty', e.target.value)} 
                        style={{ textAlign: 'center' }} 
                      />
                    )}
                  </td>
                  <td style={{ verticalAlign: 'middle', textAlign: 'right', borderColor: '#cbd5e1', paddingRight: isReadOnly ? '8px' : '0' }}>
                    {isReadOnly ? (
                      <span style={{ fontSize: '13px' }}>{(Number(item.rate) || 0).toLocaleString()}</span>
                    ) : (
                      <input 
                        className="a4-cell-input" 
                        type="number" 
                        value={item.rate} 
                        onChange={(e) => handleItemChange(index, 'rate', e.target.value)} 
                        style={{ textAlign: 'right' }} 
                      />
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle', borderColor: '#cbd5e1', fontSize: '13px' }}>
                    {(Number(item.amount) || 0).toLocaleString()}
                  </td>
                  {!isReadOnly && (
                    <td className="hide-in-pdf" style={{ textAlign: 'center', verticalAlign: 'middle', borderColor: '#cbd5e1', padding: '4px' }}>
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        disabled={lineItems.length <= 1}
                        title="Delete row"
                        style={{
                          background: lineItems.length <= 1 ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          borderRadius: 4,
                          color: lineItems.length <= 1 ? '#64748b' : '#ef4444',
                          cursor: lineItems.length <= 1 ? 'not-allowed' : 'pointer',
                          padding: '4px 6px',
                          fontSize: 12,
                        }}
                      >
                        <X size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #1b4372', borderColor: '#cbd5e1', color: '#1e293b', fontSize: '13px' }}>
                GRAND TOTAL (Rs):
              </td>
              <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #1b4372', borderColor: '#cbd5e1', color: '#1e293b', fontSize: '13px' }}>
                {totalAmount.toLocaleString()}
              </td>
              {!isLocked && !isGeneratingPDF && <td className="hide-in-pdf" style={{ borderColor: '#cbd5e1' }}></td>}
            </tr>
          </tfoot>
        </table>

        {!isLocked && (
          <button type="button" className="hide-in-pdf nexus-btn nexus-btn-ghost" onClick={addRow} style={{ marginTop: 16, color: '#1b4372', borderColor: '#cbd5e1' }}>
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
