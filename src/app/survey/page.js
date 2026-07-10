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

  const isPdfUrl = (url) => {
    const cleanUrl = (url || '').split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.pdf') || (url || '').toLowerCase().includes('/pdf/');
  };

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
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      setMessage(`Uploading ${files.length} file(s)...`);
      const newUrls = [];
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dpqj7b0k7'; // Fallback
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'unsigned-preset');
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
        newUrls.push(data.secure_url);
      }
      setImageUrl(prev => prev ? `${prev},${newUrls.join(',')}` : newUrls.join(','));
      setMessage('Files uploaded successfully.');
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
        <input type="file" accept="image/*,application/pdf" multiple onChange={handleFileUpload} className="nexus-input" />
        {imageUrl && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {imageUrl.split(',').map((url, i) => {
              const isPdf = isPdfUrl(url);
              return (
                <div key={i} style={{ padding: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
                  <a href={url} target="_blank" rel="noreferrer" style={{ color: '#00f2fe', fontSize: 13 }}>
                    View Attached {isPdf ? 'PDF' : 'Document/Photo'} {imageUrl.includes(',') ? i + 1 : ''}
                  </a>
                  {isPdf ? (
                    <iframe
                      src={url}
                      title={`Survey PDF ${i + 1}`}
                      style={{ width: '100%', height: 420, marginTop: 10, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: '#0a0a0c' }}
                    />
                  ) : (
                    <img
                      src={url}
                      alt={`Survey attachment ${i + 1}`}
                      style={{ display: 'block', maxWidth: '100%', maxHeight: 320, marginTop: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  )}
                </div>
              );
            })}
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
