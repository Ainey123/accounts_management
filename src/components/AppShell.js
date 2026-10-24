"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/AuthProvider';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isLogin = pathname === '/';
  const isFieldPortal = pathname.startsWith('/field') || user?.role === 'FIELD_EMPLOYEE';

  if (isLogin) {
    return <div className="login-screen">{children}</div>;
  }

  if (isFieldPortal) {
    return (
      <div
        className="field-portal-frame"
        style={{
          width: '100%',
          minHeight: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          background: '#0b0f19',
          color: '#f8fafc',
        }}
      >
        <main style={{ minHeight: '100vh', padding: 0 }}>{children}</main>
      </div>
    );
  }

  return (
    <div className="app-frame">
      <Sidebar />
      <main className="content-panel">{children}</main>
    </div>
  );
}
