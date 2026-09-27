"use client";

import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, Save, CheckCircle2, FileText, X } from 'lucide-react';
import JobSelector from '@/components/JobSelector';
import { useJob } from '@/components/JobContext';
import { apiFetch } from '@/lib/api';

export default function SiteExpensePage() {
  const { activeJobId } = useJob();
  const [expenseMode, setExpenseMode] = useState('quick'); // 'quick' | 'manual'
  const [amount, setAmount] = useState('');
  const [summaryNotes, setSummaryNotes] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountName, setAccountName] = useState('');
  const [personName, setPersonName] = useState('');
  const [category, setCategory] = useState('Site Expense');
  
  const [imageUrl, setImageUrl] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
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
      setCapturedImage(shot);
      setImageUrl(shot);
      setMessage('Receipt snapshot captured from camera.');
    }
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const res = ev.target.result;
        setImageUrl(res);
        setCapturedImage(res);
        setMessage('Receipt file attached successfully.');
      };
      reader.readAsDataURL(file);

      if (cloudName && cloudName !== 'YOUR_CLOUDINARY_CLOUD_NAME') {
        uploadToCloudinary(file).then((url) => {
          setImageUrl(url);
          setCapturedImage(url);
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
    if (!amount || parseFloat(amount) <= 0) {
      setMessage('Valid expense amount is required.');
      return;
    }
    if (expenseMode === 'quick' && !summaryNotes.trim()) {
      setMessage('Expense notes are required.');
      return;
    }
    if (expenseMode === 'manual' && (!accountName.trim() || !personName.trim())) {
      setMessage('Account Name and Person Name are required for manual expense entry.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      let finalUrl = imageUrl;
      if (capturedImage && capturedImage.startsWith('data:')) {
        try {
          const blob = await fetch(capturedImage).then((r) => r.blob());
          finalUrl = await uploadToCloudinary(blob);
        } catch (e) {
          finalUrl = capturedImage;
        }
      }

      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          jobMetadataId: activeJobId,
          amount: parseFloat(amount),
          imageUrl: finalUrl || null,
          summaryNotes: summaryNotes.trim() || (expenseMode === 'manual' ? `${category} by ${personName}` : 'Site expense claim'),
          category: category || 'Site Expense',
          expenseDate: expenseDate || new Date().toISOString().slice(0, 10),
          accountName: accountName || null,
          personName: personName || null,
        }),
      });

      setMessage('Expense logged successfully.');
      setAmount('');
      setSummaryNotes('');
      setImageUrl('');
      setCapturedImage(null);
      if (expenseMode === 'manual') {
        setAccountName('');
        setPersonName('');
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isPdf = (capturedImage && (capturedImage.startsWith('data:application/pdf') || capturedImage.includes('.pdf')));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
      <header className="page-header" style={{ marginBottom: 24 }}>
        <h1>Site Expense Log</h1>
        <p>Record on-site expenses, attach receipt proofs, or enter manual expense details.</p>
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

      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, background: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
        <button
          type="button"
          onClick={() => setExpenseMode('quick')}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: expenseMode === 'quick' ? 'rgba(0, 242, 254, 0.2)' : 'transparent',
            color: expenseMode === 'quick' ? '#00f2fe' : '#94a3b8',
            transition: 'all 0.2s',
          }}
        >
          ⚡ Quick Log
        </button>
        <button
          type="button"
          onClick={() => setExpenseMode('manual')}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: expenseMode === 'manual' ? 'rgba(167, 139, 250, 0.25)' : 'transparent',
            color: expenseMode === 'manual' ? '#a78bfa' : '#94a3b8',
            transition: 'all 0.2s',
          }}
        >
          📝 Manual Written Expense
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
        {/* Form Column */}
        <div className="glass-card" style={{ padding: 24, border: expenseMode === 'manual' ? '1px solid rgba(167, 139, 250, 0.3)' : '1px solid rgba(0, 242, 254, 0.2)' }}>
          <h2 style={{ fontSize: 18, marginBottom: 6, color: expenseMode === 'manual' ? '#a78bfa' : '#00f2fe' }}>
            {expenseMode === 'quick' ? 'Quick Expense Entry' : 'Manual Written Expense Details'}
          </h2>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
            {expenseMode === 'quick'
              ? 'Enter amount and notes, then attach receipt photo or bill upload.'
              : 'Set the specific date, bank/account name, person name, category, and receipt proof.'}
          </p>

          {expenseMode === 'manual' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Expense Date *</label>
                  <input
                    className="nexus-input"
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Account / Bank Name *</label>
                  <input
                    className="nexus-input"
                    type="text"
                    required
                    placeholder="e.g. Meezan Bank, Cash, HBL"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                <div>
                  <label className="field-label" style={{ marginBottom: 4 }}>Expense Category</label>
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
                  style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}
                />
              </div>

              <div>
                <label className="field-label" style={{ marginBottom: 4 }}>Expense Description / Notes</label>
                <textarea
                  className="nexus-textarea"
                  value={summaryNotes}
                  onChange={(e) => setSummaryNotes(e.target.value)}
                  placeholder="Details of materials, items purchased, voucher number..."
                  style={{ minHeight: 80 }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                  style={{ fontSize: 16, fontWeight: 700, color: '#00f2fe' }}
                />
              </div>

              <div>
                <label className="field-label" style={{ marginBottom: 4 }}>Expense Notes *</label>
                <textarea
                  className="nexus-textarea"
                  required
                  value={summaryNotes}
                  onChange={(e) => setSummaryNotes(e.target.value)}
                  placeholder="Site work performance notes, materials purchased..."
                  style={{ minHeight: 120 }}
                />
              </div>
            </div>
          )}

          {/* Receipt Action Buttons */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <label className="field-label" style={{ marginBottom: 8 }}>Attach Receipt / Bill Proof</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={capture}
                style={{ borderColor: 'rgba(0, 242, 254, 0.3)', color: '#00f2fe' }}
              >
                <Camera size={16} /> Capture Photo
              </button>
              <label
                className="nexus-btn nexus-btn-ghost"
                style={{ cursor: 'pointer', textAlign: 'center', borderColor: 'rgba(167, 139, 250, 0.3)', color: '#a78bfa' }}
              >
                <Upload size={16} /> Upload Receipt / Doc
                <input type="file" accept="image/*,application/pdf" hidden onChange={handleFileUpload} />
              </label>
            </div>
          </div>

          <button
            type="button"
            className="nexus-btn nexus-btn-primary"
            style={{
              width: '100%',
              marginTop: 24,
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: 700,
              background: expenseMode === 'manual' ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : undefined,
            }}
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={16} /> {saving ? 'Saving...' : (expenseMode === 'manual' ? 'Record Manual Written Expense' : 'Log Site Expense')}
          </button>
        </div>

        {/* Live Camera & Receipt Preview Column */}
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <label className="field-label" style={{ margin: 0 }}>Receipt Preview &amp; Camera Feed</label>
            {capturedImage && (
              <span style={{ fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', padding: '2px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={12} /> Receipt Attached
              </span>
            )}
          </div>

          <div style={{ borderRadius: 12, overflow: 'hidden', background: '#0a0a0c', minHeight: 320, flex: 1, border: '2px dashed rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!capturedImage ? (
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : isPdf ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <FileText size={48} color="#a78bfa" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>PDF Receipt Attached</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Ready to be submitted with expense</div>
              </div>
            ) : (
              <img src={capturedImage} alt="Receipt Preview" style={{ width: '100%', height: '100%', maxHeight: 380, objectFit: 'contain' }} />
            )}
          </div>

          {capturedImage && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                style={{ padding: '6px 12px', fontSize: 12, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                onClick={() => { setCapturedImage(null); setImageUrl(''); }}
              >
                <X size={13} /> Remove Receipt
              </button>
              {capturedImage.startsWith('http') && (
                <a
                  href={capturedImage}
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
