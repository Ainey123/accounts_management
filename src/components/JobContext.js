"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

const JobContext = createContext({
  jobs: [],
  activeJobId: null,
  activeJob: null,
  setActiveJobId: () => {},
  refreshJobs: async () => {},
  loading: false,
});

export const useJob = () => useContext(JobContext);

export default function JobProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const [activeJobId, setActiveJobIdState] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('nexus_active_job');
    if (stored) setActiveJobIdState(Number(stored));
  }, []);

  const setActiveJobId = useCallback((id) => {
    setActiveJobIdState(id);
    if (id) {
      localStorage.setItem('nexus_active_job', String(id));
    } else {
      localStorage.removeItem('nexus_active_job');
    }
  }, []);

  const refreshJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { jobs: fetched } = await apiFetch('/api/jobs');
      setJobs(fetched || []);
      if ((fetched || []).length && !activeJobId) {
        setActiveJobId(fetched[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeJobId, setActiveJobId]);

  useEffect(() => {
    // Only fetch jobs if the user is actually logged in (has auth cookie)
    // This prevents 401 errors on the login page which cause the redirect loop
    const hasCookie = document.cookie.split('; ').some((c) => c.startsWith('nexus_user='));
    if (hasCookie) {
      refreshJobs();
    }
  }, []);

  const activeJob = (jobs || []).find((j) => j.id === activeJobId) || null;

  return (
    <JobContext.Provider
      value={{ jobs, activeJobId, activeJob, setActiveJobId, refreshJobs, loading }}
    >
      {children}
    </JobContext.Provider>
  );
}
