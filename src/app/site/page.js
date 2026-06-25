"use client";

import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, Save } from 'lucide-react';
import JobSelector from '@/components/JobSelector';
import { useJob } from '@/components/JobContext';
import { apiFetch } from '@/lib/api';

export default function SiteExpensePage() {
  const { activeJobId } = useJob();
  const [amount, setAmount] = useState('');
  const [summaryNotes, setSummaryNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const webcamRef = useRef(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  const uploadToCloudinary = async (file) => {
    if (!cloudName) {
      throw new Error('Cloudinary not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME env var.');
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'unsigned-preset');
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
    if (shot) setCapturedImage(shot);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadToCloudinary(file);
      setImageUrl(url);
      setCapturedImage(url);
      setMessage('Image uploaded to Cloudinary.');
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleSave = async () => {
    if (!activeJobId) {
      setMessage('Select an active job first.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      let finalUrl = imageUrl;
      if (capturedImage && capturedImage.startsWith('data:')) {
        const blob = await fetch(capturedImage).then((r) => r.blob());
        finalUrl = await uploadToCloudinary(blob);
        setImageUrl(finalUrl);
        setCapturedImage(finalUrl);
      }
      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          jobMetadataId: activeJobId,
          amount: parseFloat(amount) || 0,
          imageUrl: finalUrl || null,
          summaryNotes,
        }),
      });
      setMessage('Expense logged successfully.');
      setAmount('');
      setSummaryNotes('');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="page-header">
        <h1>Site Expense Log</h1>
        <p>On-site confirmation with Cloudinary receipt capture.</p>
      </header>

      <JobSelector />
      {message && <div className={message.includes('success') || message.includes('uploaded') ? 'alert-success' : 'alert-error'} style={{ marginBottom: 20 }}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        <div className="glass-card">
          <label className="field-label">Summary Notes</label>
          <textarea
            className="nexus-textarea"
            style={{ minHeight: 160, marginBottom: 20 }}
            value={summaryNotes}
            onChange={(e) => setSummaryNotes(e.target.value)}
            placeholder="Site work performance notes..."
          />

          <label className="field-label">Amount (Rs.)</label>
          <input
            className="nexus-input"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            style={{ marginBottom: 20 }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button type="button" className="nexus-btn nexus-btn-ghost" onClick={capture}>
              <Camera size={16} /> Capture Photo
            </button>
            <label className="nexus-btn nexus-btn-ghost" style={{ cursor: 'pointer' }}>
              <Upload size={16} /> Upload File
              <input type="file" accept="image/*" hidden onChange={handleFileUpload} />
            </label>
          </div>

          <button type="button" className="nexus-btn nexus-btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Log Expense'}
          </button>
        </div>

        <div className="glass-card">
          <label className="field-label">Live Camera Feed</label>
          <div style={{ borderRadius: 12, overflow: 'hidden', background: '#1a1c23', minHeight: 300, border: '2px dashed rgba(255,255,255,0.08)' }}>
            {!capturedImage ? (
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img src={capturedImage} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
          {capturedImage && (
            <button type="button" className="nexus-btn nexus-btn-ghost" style={{ marginTop: 12 }} onClick={() => { setCapturedImage(null); setImageUrl(''); }}>
              Retake
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
