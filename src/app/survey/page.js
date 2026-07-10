"use client";

import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import JobSelector from '@/components/JobSelector';
import { useJob } from '@/components/JobContext';
import { apiFetch } from '@/lib/api';

export default function SurveyCanvasPage() {
  const { activeJobId } = useJob();
  const [reportText, setReportText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dloxdnqfm';

  useEffect(() => {
    if (!activeJobId) return;
    apiFetch(`/api/survey?jobMetadataId=${activeJobId}`)
      .then(({ report }) => {
        if (report) {
          setReportText(report.reportText);
          setImageUrl(report.imageUrl || '');
        } else {
          setReportText('');
          setImageUrl('');
        }
      })
      .catch(console.error);
  }, [activeJobId]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setMessage('Uploading photo...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'unsigned-preset');
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dpqj7b0k7'; // Fallback
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
      setImageUrl(data.secure_url);
      setMessage('Screenshot uploaded successfully.');
    } catch (err) {
      setMessage('Upload error: ' + err.message);
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
      await apiFetch('/api/survey', {
        method: 'POST',
        body: JSON.stringify({ jobMetadataId: activeJobId, reportText, imageUrl }),
      });
      setMessage('Survey report saved.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1>Survey Canvas</h1>
          <p>Full-page markdown field observations and site notes.</p>
        </div>
        <button type="button" className="nexus-btn nexus-btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={18} /> {saving ? 'Saving...' : 'Save Report'}
        </button>
      </header>

      <JobSelector />
      {message && <div className={message.includes('saved') ? 'alert-success' : 'alert-error'} style={{ marginBottom: 20 }}>{message}</div>}

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Attach Photo or PDF Document (Optional)</label>
        <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="nexus-input" />
        {imageUrl && (
          <div style={{ marginTop: 8 }}>
            <a href={imageUrl} target="_blank" rel="noreferrer" style={{ color: '#00f2fe', fontSize: 13 }}>View Attached Document/Photo</a>
          </div>
        )}
      </div>

      <textarea
        className="nexus-textarea survey-canvas"
        value={reportText}
        onChange={(e) => setReportText(e.target.value)}
        placeholder="Begin typing your comprehensive site survey report..."
      />
    </div>
  );
}
