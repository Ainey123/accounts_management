"use client";

import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, Save, CheckCircle2, FileText, Trash2, X } from 'lucide-react';
import JobSelector from '@/components/JobSelector';
import { useJob } from '@/components/JobContext';
import { apiFetch } from '@/lib/api';

export default function SiteExpensePage() {
  const { activeJobId, activeJob, refreshJobs } = useJob();
  const [expenseMode, setExpenseMode] = useState('manual'); // 'manual' | 'bank_receipt' | 'attach_bill'
  
  // Mode 1: Manual Attached
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseTime, setExpenseTime] = useState(new Date().toTimeString().slice(0, 5));
  const [amount, setAmount] = useState('');
  const [summaryNotes, setSummaryNotes] = useState('');
  const [accountName, setAccountName] = useState('Meezan Bank');
  const [personName, setPersonName] = useState('');
  const [category, setCategory] = useState('Site Expense');
  const [imageUrl, setImageUrl] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);

  // Mode 2: Bank Receipt Attached (Attachment Only)
  const [bankReceiptImg, setBankReceiptImg] = useState('');
  const [capturedBankReceiptImg, setCapturedBankReceiptImg] = useState(null);

  // Mode 3: Attach Bill (Attachment Only)
  const [billImg, setBillImg] = useState('');
  const [capturedBillImg, setCapturedBillImg] = useState(null);

  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const webcamRef = useRef(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  // Existing expenses for active job to compute sequential IDs
  const existingExpenses = activeJob?.expenses || [];
  const jobBills = existingExpenses.filter((e) => !e.summaryNotes?.includes('[Bank Receipt ID:') && e.category !== 'Bank Receipt');
  const jobBankReceipts = existingExpenses.filter((e) => e.summaryNotes?.includes('[Bank Receipt ID:') || e.category === 'Bank Receipt');
  const nextBillNo = jobBills.length + 1;
  const nextBankReceiptId = jobBankReceipts.length + 1;

  const uploadToCloudinary = async (file) => {
    if (!cloudName || cloudName === 'YOUR_CLOUDINARY_CLOUD_NAME') {
      throw new Error('Cloudinary not configured.');
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'unsigned-preset');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
    return data.secure_url;
  };

  const capture = useCallback(() => {
    const shot = webcamRef.current?.getScreenshot();
    if (shot) {
      if (expenseMode === 'bank_receipt') {
        setCapturedBankReceiptImg(shot);
        setBankReceiptImg(shot);
      } else if (expenseMode === 'attach_bill') {
        setCapturedBillImg(shot);
        setBillImg(shot);
      } else {
        setCapturedImage(shot);
        setImageUrl(shot);
      }
      setMessage('Snapshot captured from camera.');
    }
  }, [expenseMode]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const res = ev.target.result;
        if (expenseMode === 'bank_receipt') {
          setBankReceiptImg(res);
          setCapturedBankReceiptImg(res);
        } else if (expenseMode === 'attach_bill') {
          setBillImg(res);
          setCapturedBillImg(res);
        } else {
          setImageUrl(res);
          setCapturedImage(res);
        }
        setMessage('File attached successfully.');
      };
      reader.readAsDataURL(file);

      if (cloudName && cloudName !== 'YOUR_CLOUDINARY_CLOUD_NAME') {
        uploadToCloudinary(file).then((url) => {
          if (expenseMode === 'bank_receipt') {
            setBankReceiptImg(url);
            setCapturedBankReceiptImg(url);
          } else if (expenseMode === 'attach_bill') {
            setBillImg(url);
            setCapturedBillImg(url);
          } else {
            setImageUrl(url);
            setCapturedImage(url);
          }
        }).catch(() => {});
      }
    } catch (err) {
      setMessage('Upload error: ' + err.message);
    }
  };

  const handleSave = async () => {
    if (!activeJobId) {
      setMessage('Select an active job first.');
      return;
    }

    let payload = {};
    let amountToSave = 0;

    if (expenseMode === 'manual') {
      if (!amount || parseFloat(amount) <= 0) {
        setMessage('Valid expense amount is required.');
        return;
      }
      if (!accountName.trim() || !personName.trim()) {
        setMessage('Account Name and Person Name are required.');
        return;
      }
      amountToSave = parseFloat(amount);
      payload = {
        jobMetadataId: activeJobId,
        amount: amountToSave,
        summaryNotes: summaryNotes.trim() || `${category} by ${personName}`,
        category: category || 'Site Expense',
        expenseDate: expenseDate || new Date().toISOString().slice(0, 10),
        expenseTime: expenseTime || new Date().toTimeString().slice(0, 5),
        billId: `Bill ${nextBillNo}`,
        billNumber: nextBillNo,
        accountName,
        personName,
      };
    } else if (expenseMode === 'bank_receipt') {
      const activeCaptured = capturedBankReceiptImg || bankReceiptImg || capturedImage || imageUrl;
      if (!activeCaptured) {
        setMessage('Please capture or upload a bank receipt attachment first.');
        return;
      }
      payload = {
        jobMetadataId: activeJobId,
        amount: 0,
        summaryNotes: `Bank Receipt ID ${nextBankReceiptId} Attached`,
        category: 'Bank Receipt',
        bankReceiptId: String(nextBankReceiptId),
        personName: personName || 'Staff',
      };
    } else if (expenseMode === 'attach_bill') {
      const activeCaptured = capturedBillImg || billImg || capturedImage || imageUrl;
      if (!activeCaptured) {
        setMessage('Please capture or upload a bill attachment first.');
        return;
      }
      payload = {
        jobMetadataId: activeJobId,
        amount: 0,
        summaryNotes: `Bill ID ${nextBillNo} Attached`,
        category: 'Site Bill',
        billId: `ID ${nextBillNo}`,
        billNumber: nextBillNo,
        personName: personName || 'Staff',
      };
    }

    setSaving(true);
    setMessage('');
    try {
      let finalUrl = expenseMode === 'bank_receipt' ? bankReceiptImg : (expenseMode === 'attach_bill' ? billImg : imageUrl);
      const activeCaptured = expenseMode === 'bank_receipt' ? capturedBankReceiptImg : (expenseMode === 'attach_bill' ? capturedBillImg : capturedImage);

      if (activeCaptured && activeCaptured.startsWith('data:')) {
        try {
          const blob = await fetch(activeCaptured).then((r) => r.blob());
          finalUrl = await uploadToCloudinary(blob);
        } catch (e) {
          finalUrl = activeCaptured;
        }
      }

      payload.imageUrl = finalUrl || null;

      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (expenseMode === 'bank_receipt') {
        try {
          await apiFetch('/api/bank-approval', {
            method: 'POST',
            body: JSON.stringify({
              jobMetadataId: activeJobId,
              bankName: 'Bank Receipt Attached',
              accountNumber: null,
              amount: 0,
              imageUrl: finalUrl || null,
              notes: `Bank Receipt ID ${nextBankReceiptId}`,
              status: 'SUBMITTED',
            }),
          });
        } catch {}
      }

      const successMsg = expenseMode === 'bank_receipt'
        ? `Bank Receipt (ID #${nextBankReceiptId}) attached successfully!`
        : `Bill (#${payload.billId || '1'}) recorded successfully!`;

      setMessage(successMsg);
      setAmount('');
      setSummaryNotes('');
      setImageUrl('');
      setCapturedImage(null);
      setBankReceiptImg('');
      setCapturedBankReceiptImg(null);
      setBillImg('');
      setCapturedBillImg(null);
      if (refreshJobs) await refreshJobs();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const activeCaptured = expenseMode === 'bank_receipt' ? capturedBankReceiptImg : (expenseMode === 'attach_bill' ? capturedBillImg : capturedImage);
  const activeUrl = expenseMode === 'bank_receipt' ? bankReceiptImg : (expenseMode === 'attach_bill' ? billImg : imageUrl);
  const isPdf = activeCaptured && (activeCaptured.startsWith('data:application/pdf') || activeCaptured.includes('.pdf'));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
      <header className="page-header" style={{ marginBottom: 24 }}>
        <h1>Site Expense &amp; Receipt Manager</h1>
        <p>Record on-site expenses, attach bank deposit receipts, or upload physical bills.</p>
      </header>

      <JobSelector />

      {message && (
        <div
          className={message.includes('success') || message.includes('attached') || message.includes('captured') ? 'alert-success' : 'alert-error'}
          style={{ marginBottom: 20 }}
        >
          {message}
        </div>
      )}

      {/* 3 Top Mode Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'rgba(0,0,0,0.4)', padding: 6, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', width: 'fit-content' }}>
        <button
          type="button"
          onClick={() => setExpenseMode('manual')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: expenseMode === 'manual' ? 'linear-gradient(135deg, rgba(167,139,250,0.35), rgba(139,92,246,0.45))' : 'transparent',
            color: expenseMode === 'manual' ? '#c4b5fd' : '#94a3b8',
            boxShadow: expenseMode === 'manual' ? '0 2px 8px rgba(139,92,246,0.3)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          📝 Manually Attached
        </button>
        <button
          type="button"
          onClick={() => setExpenseMode('bank_receipt')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: expenseMode === 'bank_receipt' ? 'linear-gradient(135deg, rgba(56,189,248,0.35), rgba(14,165,233,0.45))' : 'transparent',
            color: expenseMode === 'bank_receipt' ? '#38bdf8' : '#94a3b8',
            boxShadow: expenseMode === 'bank_receipt' ? '0 2px 8px rgba(14,165,233,0.3)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          🏦 Bank Receipt Attached
        </button>
        <button
          type="button"
          onClick={() => setExpenseMode('attach_bill')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: expenseMode === 'attach_bill' ? 'linear-gradient(135deg, rgba(34,197,94,0.35), rgba(22,163,74,0.45))' : 'transparent',
            color: expenseMode === 'attach_bill' ? '#4ade80' : '#94a3b8',
            boxShadow: expenseMode === 'attach_bill' ? '0 2px 8px rgba(34,197,94,0.3)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          📁 Attach Bill
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 24 }}>
        {/* Form Column */}
        <div className="glass-card" style={{ padding: 24 }}>
          {/* OPTION 1: Manually Attached */}
          {expenseMode === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(167, 139, 250, 0.12)', border: '1px solid rgba(167, 139, 250, 0.3)', padding: '8px 12px', borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>🏷️ Sequential Expense ID:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#c4b5fd', background: 'rgba(167, 139, 250, 0.25)', padding: '2px 10px', borderRadius: 6, fontSize: 13 }}>
                  Bill #{nextBillNo}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Date *</label>
                  <input
                    className="nexus-input"
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Time *</label>
                  <input
                    className="nexus-input"
                    type="time"
                    required
                    value={expenseTime}
                    onChange={(e) => setExpenseTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Amount (Rs.) *</label>
                  <input
                    className="nexus-input"
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Account / Bank Name *</label>
                  <input
                    className="nexus-input"
                    type="text"
                    required
                    placeholder="e.g. Meezan Bank, HBL, Cash"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Person Name *</label>
                  <input
                    className="nexus-input"
                    type="text"
                    required
                    placeholder="e.g. Ibrahim, Ali Shehzad"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="field-label" style={{ marginBottom: 4 }}>Category</label>
                <select
                  className="nexus-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Site Expense">Site Expense</option>
                  <option value="Fuel & Travel">Fuel &amp; Travel</option>
                  <option value="Spare Parts & Materials">Spare Parts &amp; Materials</option>
                  <option value="Labor & Wages">Labor &amp; Wages</option>
                  <option value="Food & Refreshment">Food &amp; Refreshment</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Office & Misc">Office &amp; Misc</option>
                </select>
              </div>

              <div>
                <label className="field-label" style={{ marginBottom: 4 }}>Expense Description / Notes</label>
                <textarea
                  className="nexus-textarea"
                  value={summaryNotes}
                  onChange={(e) => setSummaryNotes(e.target.value)}
                  placeholder="Details of materials, items purchased, voucher number..."
                  style={{ minHeight: 70 }}
                />
              </div>

              <div style={{ marginTop: 6 }}>
                <label className="field-label" style={{ marginBottom: 6 }}>Attach Bill Proof (Optional)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    onClick={capture}
                    style={{ borderColor: 'rgba(167, 139, 250, 0.3)', color: '#c4b5fd' }}
                  >
                    <Camera size={14} /> Capture Photo
                  </button>
                  <label
                    className="nexus-btn nexus-btn-ghost"
                    style={{ cursor: 'pointer', textAlign: 'center', borderColor: 'rgba(167, 139, 250, 0.3)', color: '#c4b5fd' }}
                  >
                    <Upload size={14} /> Upload Bill Doc
                    <input type="file" accept="image/*,application/pdf" hidden onChange={handleFileUpload} />
                  </label>
                </div>
              </div>

              <button
                type="button"
                className="nexus-btn nexus-btn-primary"
                style={{ width: '100%', marginTop: 14, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
                onClick={handleSave}
                disabled={saving}
              >
                <Save size={15} /> {saving ? 'Saving...' : `Record Manually Attached (Bill #${nextBillNo})`}
              </button>
            </div>
          )}

          {/* OPTION 2: Bank Receipt Attached (Attachment Only) */}
          {expenseMode === 'bank_receipt' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '10px 14px', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 700 }}>🏦 Bank Receipt Attachment</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Direct proof attachment for bank slips and transfers</div>
                </div>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.25)', padding: '4px 12px', borderRadius: 6, fontSize: 14 }}>
                  ID #{nextBankReceiptId}
                </span>
              </div>

              <div style={{ padding: '20px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: 10, border: '1px dashed rgba(56, 189, 248, 0.25)' }}>
                <label className="field-label" style={{ marginBottom: 12, textAlign: 'center', color: '#38bdf8' }}>Select Bank Receipt or Snapshot</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    onClick={capture}
                    style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Camera size={16} /> Capture Bank Slip
                  </button>
                  <label
                    className="nexus-btn nexus-btn-ghost"
                    style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Upload size={16} /> Upload Bank Doc
                    <input type="file" accept="image/*,application/pdf" hidden onChange={handleFileUpload} />
                  </label>
                </div>
              </div>

              <button
                type="button"
                className="nexus-btn nexus-btn-primary"
                style={{ width: '100%', marginTop: 8, padding: '12px 18px', fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}
                onClick={handleSave}
                disabled={saving}
              >
                <Save size={16} /> {saving ? 'Saving...' : `Attach Bank Receipt (ID #${nextBankReceiptId})`}
              </button>
            </div>
          )}

          {/* OPTION 3: Attach Bill (Upload Bills - Attachment Only) */}
          {expenseMode === 'attach_bill' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '10px 14px', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#f8fafc', fontWeight: 700 }}>🧾 Bill Attachment</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Direct physical bill snapshot &amp; doc upload</div>
                </div>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#4ade80', background: 'rgba(34, 197, 94, 0.25)', padding: '4px 12px', borderRadius: 6, fontSize: 14 }}>
                  ID #{nextBillNo}
                </span>
              </div>

              <div style={{ padding: '20px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: 10, border: '1px dashed rgba(34, 197, 94, 0.25)' }}>
                <label className="field-label" style={{ marginBottom: 12, textAlign: 'center', color: '#4ade80' }}>Select Bill Image or Document</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    onClick={capture}
                    style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, borderColor: 'rgba(34, 197, 94, 0.4)', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Camera size={16} /> Capture Bill
                  </button>
                  <label
                    className="nexus-btn nexus-btn-ghost"
                    style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center', borderColor: 'rgba(34, 197, 94, 0.4)', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Upload size={16} /> Upload Bill Doc
                    <input type="file" accept="image/*,application/pdf" hidden onChange={handleFileUpload} />
                  </label>
                </div>
              </div>

              <button
                type="button"
                className="nexus-btn nexus-btn-primary"
                style={{ width: '100%', marginTop: 8, padding: '12px 18px', fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                onClick={handleSave}
                disabled={saving}
              >
                <Save size={16} /> {saving ? 'Uploading...' : `Attach Bill (ID #${nextBillNo})`}
              </button>
            </div>
          )}
        </div>

        {/* Live Camera & Preview Column */}
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <label className="field-label" style={{ margin: 0 }}>Receipt Preview &amp; Camera Feed</label>
            {activeCaptured && (
              <span style={{ fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', padding: '2px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={12} /> Ready
              </span>
            )}
          </div>

          <div style={{ borderRadius: 12, overflow: 'hidden', background: '#0a0a0c', minHeight: 280, flex: 1, border: '2px dashed rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!activeCaptured ? (
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : isPdf ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <FileText size={48} color="#38bdf8" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>PDF Document Attached</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Ready to be submitted</div>
              </div>
            ) : (
              <img src={activeCaptured} alt="Receipt Preview" style={{ width: '100%', height: '100%', maxHeight: 350, objectFit: 'contain' }} />
            )}
          </div>

          {activeCaptured && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                style={{ padding: '6px 12px', fontSize: 12, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                onClick={() => {
                  if (expenseMode === 'bank_receipt') {
                    setCapturedBankReceiptImg(null);
                    setBankReceiptImg('');
                  } else if (expenseMode === 'attach_bill') {
                    setCapturedBillImg(null);
                    setBillImg('');
                  } else {
                    setCapturedImage(null);
                    setImageUrl('');
                  }
                }}
              >
                <X size={13} /> Remove
              </button>
              {activeUrl && activeUrl.startsWith('http') && (
                <a
                  href={activeUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: '#00f2fe', textDecoration: 'none' }}
                >
                  View Full Size ↗
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
