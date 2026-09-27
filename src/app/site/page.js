"use client";

import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, Save, CheckCircle2, FileText, Trash2, X } from 'lucide-react';
import JobSelector from '@/components/JobSelector';
import { useJob } from '@/components/JobContext';
import { apiFetch } from '@/lib/api';

export default function SiteExpensePage() {
  const { activeJobId } = useJob();
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

  // Mode 2: Bank Receipt Attached
  const [bankReceiptDate, setBankReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [bankReceiptTime, setBankReceiptTime] = useState(new Date().toTimeString().slice(0, 5));
  const [bankReceiptBankName, setBankReceiptBankName] = useState('Meezan Bank');
  const [bankReceiptSlipNo, setBankReceiptSlipNo] = useState('');
  const [bankReceiptAmount, setBankReceiptAmount] = useState('');
  const [bankReceiptNotes, setBankReceiptNotes] = useState('');
  const [bankReceiptImg, setBankReceiptImg] = useState('');
  const [capturedBankReceiptImg, setCapturedBankReceiptImg] = useState(null);

  // Mode 3: Attach Bill
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [billTime, setBillTime] = useState(new Date().toTimeString().slice(0, 5));
  const [billAmount, setBillAmount] = useState('');
  const [billNotes, setBillNotes] = useState('');
  const [billImg, setBillImg] = useState('');
  const [capturedBillImg, setCapturedBillImg] = useState(null);

  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const webcamRef = useRef(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

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
        accountName,
        personName,
      };
    } else if (expenseMode === 'bank_receipt') {
      if (!bankReceiptAmount || parseFloat(bankReceiptAmount) <= 0) {
        setMessage('Valid bank receipt amount is required.');
        return;
      }
      if (!bankReceiptBankName.trim()) {
        setMessage('Bank Name is required.');
        return;
      }
      amountToSave = parseFloat(bankReceiptAmount);
      payload = {
        jobMetadataId: activeJobId,
        amount: amountToSave,
        summaryNotes: bankReceiptNotes.trim() || `Bank deposit to ${bankReceiptBankName}`,
        category: 'Bank Receipt',
        expenseDate: bankReceiptDate || new Date().toISOString().slice(0, 10),
        expenseTime: bankReceiptTime || new Date().toTimeString().slice(0, 5),
        bankName: bankReceiptBankName,
        bankSlipNo: bankReceiptSlipNo || null,
        accountName: bankReceiptBankName,
      };
    } else if (expenseMode === 'attach_bill') {
      if (!billAmount || parseFloat(billAmount) <= 0) {
        setMessage('Valid bill amount is required.');
        return;
      }
      amountToSave = parseFloat(billAmount);
      payload = {
        jobMetadataId: activeJobId,
        amount: amountToSave,
        summaryNotes: billNotes.trim() || 'Uploaded physical site bill',
        category: 'Site Bill',
        expenseDate: billDate || new Date().toISOString().slice(0, 10),
        expenseTime: billTime || new Date().toTimeString().slice(0, 5),
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
              bankName: bankReceiptBankName,
              accountNumber: bankReceiptSlipNo || null,
              amount: amountToSave,
              imageUrl: finalUrl || null,
              notes: bankReceiptNotes || 'Bank Receipt proof',
              status: 'SUBMITTED',
            }),
          });
        } catch {}
      }

      setMessage('Expense / Receipt attached successfully!');
      setAmount('');
      setSummaryNotes('');
      setImageUrl('');
      setCapturedImage(null);
      setBankReceiptAmount('');
      setBankReceiptSlipNo('');
      setBankReceiptNotes('');
      setBankReceiptImg('');
      setCapturedBankReceiptImg(null);
      setBillAmount('');
      setBillNotes('');
      setBillImg('');
      setCapturedBillImg(null);
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
                <Save size={15} /> {saving ? 'Saving...' : 'Record Manually Attached Expense'}
              </button>
            </div>
          )}

          {/* OPTION 2: Bank Receipt Attached */}
          {expenseMode === 'bank_receipt' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Date *</label>
                  <input
                    className="nexus-input"
                    type="date"
                    required
                    value={bankReceiptDate}
                    onChange={(e) => setBankReceiptDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Time *</label>
                  <input
                    className="nexus-input"
                    type="time"
                    required
                    value={bankReceiptTime}
                    onChange={(e) => setBankReceiptTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Amount (Rs.) *</label>
                  <input
                    className="nexus-input"
                    type="number"
                    step="0.01"
                    required
                    value={bankReceiptAmount}
                    onChange={(e) => setBankReceiptAmount(e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: 15, fontWeight: 700, color: '#38bdf8' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Bank Name *</label>
                  <input
                    className="nexus-input"
                    type="text"
                    required
                    placeholder="e.g. Meezan Bank, HBL, Allied"
                    value={bankReceiptBankName}
                    onChange={(e) => setBankReceiptBankName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Slip / TRX No.</label>
                  <input
                    className="nexus-input"
                    type="text"
                    placeholder="e.g. TRX-982341 / Slip #4412"
                    value={bankReceiptSlipNo}
                    onChange={(e) => setBankReceiptSlipNo(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="field-label" style={{ marginBottom: 4 }}>Purpose / Notes</label>
                <textarea
                  className="nexus-textarea"
                  value={bankReceiptNotes}
                  onChange={(e) => setBankReceiptNotes(e.target.value)}
                  placeholder="Bank deposit details, transfer reference, client advance..."
                  style={{ minHeight: 70 }}
                />
              </div>

              <div style={{ marginTop: 6 }}>
                <label className="field-label" style={{ marginBottom: 6 }}>Attach Bank Slip / Proof</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    onClick={capture}
                    style={{ borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}
                  >
                    <Camera size={14} /> Capture Bank Slip
                  </button>
                  <label
                    className="nexus-btn nexus-btn-ghost"
                    style={{ cursor: 'pointer', textAlign: 'center', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}
                  >
                    <Upload size={14} /> Upload Bank Doc
                    <input type="file" accept="image/*,application/pdf" hidden onChange={handleFileUpload} />
                  </label>
                </div>
              </div>

              <button
                type="button"
                className="nexus-btn nexus-btn-primary"
                style={{ width: '100%', marginTop: 14, background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}
                onClick={handleSave}
                disabled={saving}
              >
                <Save size={15} /> {saving ? 'Saving...' : 'Attach Bank Receipt'}
              </button>
            </div>
          )}

          {/* OPTION 3: Attach Bill (Upload Bills) */}
          {expenseMode === 'attach_bill' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 10 }}>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Date *</label>
                  <input
                    className="nexus-input"
                    type="date"
                    required
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Time *</label>
                  <input
                    className="nexus-input"
                    type="time"
                    required
                    value={billTime}
                    onChange={(e) => setBillTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Bill Amount (Rs.) *</label>
                  <input
                    className="nexus-input"
                    type="number"
                    step="0.01"
                    required
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}
                  />
                </div>
              </div>

              <div>
                <label className="field-label" style={{ marginBottom: 4 }}>Vendor / Bill Description</label>
                <textarea
                  className="nexus-textarea"
                  value={billNotes}
                  onChange={(e) => setBillNotes(e.target.value)}
                  placeholder="Vendor name, items purchased, voucher number..."
                  style={{ minHeight: 80 }}
                />
              </div>

              <div style={{ marginTop: 6 }}>
                <label className="field-label" style={{ marginBottom: 6 }}>Upload Bill File or Snapshot *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    onClick={capture}
                    style={{ borderColor: 'rgba(34, 197, 94, 0.3)', color: '#4ade80' }}
                  >
                    <Camera size={14} /> Capture Bill
                  </button>
                  <label
                    className="nexus-btn nexus-btn-ghost"
                    style={{ cursor: 'pointer', textAlign: 'center', borderColor: 'rgba(34, 197, 94, 0.3)', color: '#4ade80' }}
                  >
                    <Upload size={14} /> Upload Bill Doc
                    <input type="file" accept="image/*,application/pdf" hidden onChange={handleFileUpload} />
                  </label>
                </div>
              </div>

              <button
                type="button"
                className="nexus-btn nexus-btn-primary"
                style={{ width: '100%', marginTop: 14, background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                onClick={handleSave}
                disabled={saving}
              >
                <Save size={15} /> {saving ? 'Uploading...' : 'Upload & Attach Bill'}
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
