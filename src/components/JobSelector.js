"use client";

import React from 'react';
import { useJob } from '@/components/JobContext';

export default function JobSelector() {
  const { jobs, activeJobId, setActiveJobId, loading } = useJob();

  if (loading) return null;

  return (
    <div className="job-selector-bar">
      <span className="field-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
        Active Job
      </span>
      <select
        className="nexus-select"
        value={activeJobId || ''}
        onChange={(e) => setActiveJobId(Number(e.target.value))}
      >
        <option value="" disabled>
          Select a job...
        </option>
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.ticket?.serialNo} — {job.clientName} ({job.branchName})
          </option>
        ))}
      </select>
    </div>
  );
}
