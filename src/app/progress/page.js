"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import PersonProgressSummary from '@/components/PersonProgressSummary';

export default function ProgressPage() {
  const { user, isHydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && user && user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [user, isHydrated, router]);

  if (!isHydrated || !user || user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div style={{ padding: '8px 0 32px' }}>
      <PersonProgressSummary />
    </div>
  );
}
