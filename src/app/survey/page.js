"use client";

import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import JobSelector from '@/components/JobSelector';
import { useJob } from '@/components/JobContext';
import { apiFetch } from '@/lib/api';

export default function SurveyCanvasPage() {
  const { activeJobId } = useJob();
  const [reportText, setReportText] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeJobId) return;
    apiFetch(`/api/survey?jobMetadataId=${activeJobId}`)
      .then(({ report }) => {
        if (report) setReportText(report.reportText);
        else setReportText('');
      })
      .catch(console.error);
  }, [activeJobId]);

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
        body: JSON.stringify({ jobMetadataId: activeJobId, reportText }),
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

      <textarea
        className="nexus-textarea survey-canvas"
        value={reportText}
        onChange={(e) => setReportText(e.target.value)}
        placeholder="Begin typing your comprehensive site survey report..."
      />
    </div>
  );
}
