"use client";

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  BarChart2, FileEdit, FileText, Briefcase, Landmark,
  Camera, DollarSign, Settings, LogOut, Receipt, Mail, Download,
  Users, Eye, FileSearch, ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const NAV_ITEMS = [
  { name: 'Operations Feed', href: '/dashboard', icon: BarChart2 },
  { name: 'Gmail Connection', href: '/gmail', icon: Mail, adminOnly: true },
  { name: 'Job Intake Grid', href: '/intake', icon: FileEdit },
  { name: 'Survey Canvas', href: '/survey', icon: FileText },
  { name: 'Quotation Studio', href: '/quotation', icon: Briefcase },
  { name: 'Bank Approval Console', href: '/approval', icon: Landmark },
  { name: 'Invoice Studio', href: '/invoice', icon: Receipt },
  { name: 'Documents Download', href: '/quotation', icon: Download },
  { name: 'Site Expense Log', href: '/site', icon: Camera },
  { name: 'Financial Ledger', href: '/ledger', icon: DollarSign, adminOnly: true },
  { name: 'Admin Command Center', href: '/admin/dashboard', icon: Settings, adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const visibleItems = user?.role === 'ADMIN' ? [
    { name: 'Admin Dashboard', href: '/admin/dashboard', icon: Settings },
    { name: 'All Tickets Inbox', href: '/admin/dashboard', icon: Mail },
    { name: 'Employee Monitor', href: '/admin/dashboard', icon: Users },
    { name: 'Financial Overview', href: '/ledger', icon: DollarSign },
    { name: 'All Documents', href: '/quotation', icon: FileText },
    { name: 'Gmail Inboxes', href: '/gmail', icon: Mail },
  ] : NAV_ITEMS.filter(item => !item.adminOnly);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">NEXUS<br />OPERATIONS</h1>
      </div>

      <nav className="sidebar-nav">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href === '/admin/dashboard' && pathname.startsWith('/admin'));
          return (
            <button
              key={item.name}
              type="button"
              className={`nav-panel ${isActive ? 'active' : ''}`}
              onClick={() => router.push(item.href)}
            >
              <Icon size={18} className="nav-icon" />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {user && (
          <div style={{ marginBottom: 16, padding: '0 4px' }}>
            <span className="field-label">Session</span>
            <div style={{ fontSize: 13, fontWeight: 600, color: user.role === 'ADMIN' ? '#a78bfa' : '#00f2fe' }}>
              {user.employeeName || user.role}
            </div>
          </div>
        )}
        <button type="button" className="nav-panel" onClick={logout} style={{ color: '#ef4444' }}>
          <LogOut size={18} className="nav-icon" />
          <span>Secure Logout</span>
        </button>
      </div>
    </aside>
  );
}
