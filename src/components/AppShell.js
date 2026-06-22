"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const isLogin = pathname === '/';

  if (isLogin) {
    return <div className="login-screen">{children}</div>;
  }

  return (
    <div className="app-frame">
      <Sidebar />
      <main className="content-panel">{children}</main>
    </div>
  );
}
