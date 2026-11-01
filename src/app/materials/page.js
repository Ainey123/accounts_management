"use client";

import React, { useState, useEffect } from 'react';
import {
  Package, Store, ShoppingBag, Search, Plus, Download, CheckCircle2,
  Clock, AlertTriangle, ArrowRight, RefreshCw, HardHat, ShieldCheck,
  Briefcase, Wrench, FileText, Check, Filter, Layers, ExternalLink
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import DemandFormSheet from '@/components/DemandFormSheet';
import { useAuth } from '@/components/AuthProvider';
import {
  GROUND_FLOOR_STORE_CATALOG,
  MATERIAL_TYPES,
  SOURCING_MODES,
  searchStoreItems,
  getStoreCategories,
  getStoreStats,
} from '@/lib/storeCatalog';
import { createDefaultMaterialDemandForm } from '@/lib/projectReportTemplates';
import { downloadMaterialDemandPdf } from '@/lib/projectPdfGenerator';

const INITIAL_RETURNABLE_TOOLS = [
  {
    id: 'RET-001',
    toolName: 'Gas Cylinder (LPG 15kg)',
    issuedTo: 'Ali Shehzad (Batch 1)',
    site: 'BOP Manawala Floor Overhaul',
    issueDate: '2026-10-28',
    dueDate: '2026-11-03',
    returnDate: null,
    status: 'IN_FIELD',
    condition: 'Active at Site',
  },
  {
    id: 'RET-002',
    toolName: 'Clamp Meter (Fluke 302+)',
    issuedTo: 'Shah Zaib (Batch 3)',
    site: 'MCB Chiniot ATM Cabling',
    issueDate: '2026-10-29',
    dueDate: '2026-11-01',
    returnDate: '2026-11-01',
    status: 'RETURNED',
    condition: 'Verified Good Condition',
  },
  {
    id: 'RET-003',
    toolName: 'PSI Presure Gage',
    issuedTo: 'Ali Shehzad (Batch 1)',
    site: 'BOP Manawala Floor Overhaul',
    issueDate: '2026-11-01',
    dueDate: '2026-11-04',
    returnDate: null,
    status: 'IN_FIELD',
    condition: 'Testing Compressor Pressure',
  },
  {
    id: 'RET-004',
    toolName: 'Drill Machine (Bosch Impact 13mm)',
    issuedTo: 'Muhammad Ibrahim (Batch 2)',
    site: 'HBL Burewala Data Rack',
    issueDate: '2026-11-02',
    dueDate: '2026-11-05',
    returnDate: null,
    status: 'IN_FIELD',
    condition: 'Anchor Fixing on Trays',
  },
];

export default function MaterialsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('CATALOG'); // 'CATALOG' | 'NEW_REQUISITION' | 'RETURNABLE' | 'DEMANDS_LOG'

  // Catalog search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

  // New Requisition Form State
  const [branchSite, setBranchSite] = useState('Manawala');
  const [customBranch, setCustomBranch] = useState('');
  const [siteSupervisor, setSiteSupervisor] = useState(user?.employeeName || 'Office Staff');
  const [materialForm, setMaterialForm] = useState(() =>
    createDefaultMaterialDemandForm({
      branchSite: 'Manawala',
      siteSupervisor: user?.employeeName || 'Office Staff',
      requisitionNo: `REQ-${Date.now().toString().slice(-4)}`,
    })
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState(null);

  // Returnable tools state
  const [returnableTools, setReturnableTools] = useState(INITIAL_RETURNABLE_TOOLS);
  const [toolIssueModalOpen, setToolIssueModalOpen] = useState(false);
  const [newToolLoan, setNewToolLoan] = useState({
    toolName: 'Gas Cylinder',
    issuedTo: '',
    site: 'Manawala',
    dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
  });

  // Recent demands fetched from API
  const [recentDemands, setRecentDemands] = useState([]);
  const [loadingDemands, setLoadingDemands] = useState(false);

  const stats = getStoreStats();
  const categories = getStoreCategories();
  const filteredCatalog = searchStoreItems(searchQuery, selectedCategory, selectedType);

  // Fetch live demands
  const fetchDemands = async () => {
    setLoadingDemands(true);
    try {
      const res = await fetch(`/api/field-projects?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const allDemands = [];
        (data.projects || []).forEach((p) => {
          (p.demands || []).forEach((d) => {
            allDemands.push({ ...d, projectTitle: p.siteName || p.branchName });
          });
        });
        setRecentDemands(allDemands);
      }
    } catch (err) {
      console.error('Failed to load demands', err);
    } finally {
      setLoadingDemands(false);
    }
  };

  useEffect(() => {
    fetchDemands();
  }, []);

  // Quick Action: Pre-populate item in Requisition Maker
  const handleQuickDemandItem = (item) => {
    const existingItems = Array.isArray(materialForm.items) ? materialForm.items : [];
    const firstEmptyIdx = existingItems.findIndex((r) => !(r.description || '').trim());
    let nextItems;
    if (firstEmptyIdx >= 0) {
      nextItems = existingItems.map((r, i) =>
        i === firstEmptyIdx
          ? {
              ...r,
              description: item.name,
              unit: item.unit || '',
              availableStock: item.stock || '',
              materialType: item.type || MATERIAL_TYPES.CONSUMABLE,
              sourcingMode: SOURCING_MODES.STORE,
            }
          : r
      );
    } else {
      nextItems = [
        ...existingItems,
        {
          srNo: String(existingItems.length + 1),
          description: item.name,
          requiredQty: '1',
          unit: item.unit || '',
          availableStock: item.stock || '',
          materialType: item.type || MATERIAL_TYPES.CONSUMABLE,
          sourcingMode: SOURCING_MODES.STORE,
        },
      ];
    }
    setMaterialForm({ ...materialForm, items: nextItems });
    setActiveTab('NEW_REQUISITION');
  };

  // Submit Requisition to Database
  const handleSubmitRequisition = async (e) => {
    e?.preventDefault();
    setIsSubmitting(true);
    setSubmitFeedback(null);
    try {
      const activeBranch = branchSite === 'Other' ? (customBranch || 'Office Store') : branchSite;
      const res = await fetch('/api/field-projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_DEMAND',
          projectKey: (activeBranch || '').toLowerCase().replace(/\s+/g, '-'),
          branchName: activeBranch,
          demandType: 'MATERIAL',
          amount: 0,
          description: `Material Requisition (${materialForm.items?.filter((i) => i.description).length || 0} items)`,
          siteSupervisor: siteSupervisor || user?.employeeName || 'Office Staff',
          formData: {
            ...materialForm,
            projectBranchName: activeBranch,
            requestedBy: siteSupervisor,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit material requisition');

      setSubmitFeedback({
        type: 'SUCCESS',
        msg: `Requisition submitted successfully! Gate Pass / Requisition #${materialForm.requisitionNo || 'MR-NEW'} has been recorded.`,
      });
      fetchDemands();
      // Reset form
      setMaterialForm(
        createDefaultMaterialDemandForm({
          branchSite: activeBranch,
          siteSupervisor,
          requisitionNo: `REQ-${Date.now().toString().slice(-4)}`,
        })
      );
    } catch (err) {
      setSubmitFeedback({ type: 'ERROR', msg: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const activeBranch = branchSite === 'Other' ? (customBranch || 'Office Store') : branchSite;
      await downloadMaterialDemandPdf(
        {
          ...materialForm,
          projectBranchName: activeBranch,
          requestedBy: siteSupervisor,
        },
        0
      );
    } catch (err) {
      alert(`Could not generate PDF: ${err.message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Returnable Tool Handlers
  const handleMarkToolReturned = (toolId) => {
    setReturnableTools((prev) =>
      prev.map((t) =>
        t.id === toolId
          ? {
              ...t,
              status: 'RETURNED',
              returnDate: new Date().toISOString().split('T')[0],
              condition: 'Verified by Storekeeper',
            }
          : t
      )
    );
  };

  const handleCreateToolLoan = (e) => {
    e.preventDefault();
    if (!newToolLoan.issuedTo.trim()) {
      alert('Please enter employee name.');
      return;
    }
    const newEntry = {
      id: `RET-${Date.now().toString().slice(-3)}`,
      toolName: newToolLoan.toolName,
      issuedTo: newToolLoan.issuedTo,
      site: newToolLoan.site,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: newToolLoan.dueDate,
      returnDate: null,
      status: 'IN_FIELD',
      condition: 'Issued to Custodian',
    };
    setReturnableTools([newEntry, ...returnableTools]);
    setToolIssueModalOpen(false);
    setNewToolLoan({
      toolName: 'Gas Cylinder',
      issuedTo: '',
      site: 'Manawala',
      dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
    });
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 1300, margin: '0 auto', paddingBottom: 60 }}>
        {/* ── HEADER BANNER ── */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: '24px 28px',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid #38bdf8',
                  borderRadius: 10,
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Package size={22} color="#38bdf8" />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', letterSpacing: -0.3 }}>
                STORE & MATERIAL MANAGEMENT
              </h1>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid #059669',
                }}
              >
                Ground Floor Store Active
              </span>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>
              Complete 3-tier inventory (Fixed Assets, Consumables, and Returnable Tools) with instant sourcing options (Buy from Store vs Self Buy).
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActiveTab('NEW_REQUISITION')}
              style={{
                background: '#38bdf8',
                color: '#090d16',
                border: 'none',
                padding: '10px 18px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Plus size={16} /> New Material Requisition
            </button>
            <button
              type="button"
              onClick={() => {
                const link = document.createElement('a');
                link.href = '/Material_Management_Master_System.xlsx';
                link.download = 'Material_Management_Master_System.xlsx';
                link.click();
              }}
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: '#f8fafc',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Download size={15} /> Export Store Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* ── KPI METRICS CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 24 }}>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase' }}>
              Total Cataloged SKUs
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc' }}>
              {stats.total}+ Items
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Ground Floor Electrical, Plumbing, Wires & Tools
            </div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase' }}>
              Fixed Store Assets
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#a78bfa' }}>
              {stats.fixed} Equipment
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Welding plant, Drill machines, Motors, Inverters
            </div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase' }}>
              Returnable Active Tools
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8' }}>
              {returnableTools.filter((t) => t.status === 'IN_FIELD').length} in Field
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Cylinders, Clamp meters, Pressure gauges, Spanners
            </div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase' }}>
              Consumable Site Materials
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#34d399' }}>
              {stats.consumable} Materials
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Wires, Cables, Pipes, Breakers, Screws, Tiles
            </div>
          </div>
        </div>

        {/* ── NAVIGATION TABS ── */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            borderBottom: '1px solid #334155',
            paddingBottom: 10,
            marginBottom: 20,
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'CATALOG', label: '📦 Store Inventory Master', count: stats.total },
            { id: 'NEW_REQUISITION', label: '📝 Material Requisition Maker', count: null },
            { id: 'RETURNABLE', label: '🔄 Returnable Tools & Loan Tracker', count: returnableTools.filter((t) => t.status === 'IN_FIELD').length },
            { id: 'DEMANDS_LOG', label: '🚚 Sourcing & Gate Pass Log', count: recentDemands.length },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: isActive ? '#38bdf8' : 'rgba(255,255,255,0.04)',
                  color: isActive ? '#090d16' : '#94a3b8',
                  border: '1px solid',
                  borderColor: isActive ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    style={{
                      background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)',
                      color: isActive ? '#090d16' : '#cbd5e1',
                      padding: '1px 6px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 1: STORE INVENTORY MASTER
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'CATALOG' && (
          <div>
            {/* Filters */}
            <div
              style={{
                background: '#111827',
                border: '1px solid #1e293b',
                borderRadius: 12,
                padding: '16px 20px',
                marginBottom: 18,
              }}
            >
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={16} color="#64748b" style={{ position: 'absolute', left: 14, top: 12 }} />
                <input
                  type="text"
                  placeholder="Quick search store inventory by item name, cable gauge, spanner, motor, breaker, pipe..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 40px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f8fafc',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Classification filter */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {[
                  { id: 'ALL', label: 'All 3 Classifications' },
                  { id: MATERIAL_TYPES.CONSUMABLE, label: '🟢 Consumable Material (Site Installed)' },
                  { id: MATERIAL_TYPES.RETURNABLE, label: '🔵 Returnable Material (Field Tools & Kits)' },
                  { id: MATERIAL_TYPES.FIXED, label: '🟣 Fixed Material (Company Assets)' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedType(t.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: selectedType === t.id ? '#38bdf8' : '#334155',
                      background: selectedType === t.id ? 'rgba(56,189,248,0.15)' : 'transparent',
                      color: selectedType === t.id ? '#38bdf8' : '#94a3b8',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Category pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedCategory(c)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: selectedCategory === c ? '#0284c7' : '#1e293b',
                      background: selectedCategory === c ? '#0284c7' : 'rgba(255,255,255,0.03)',
                      color: selectedCategory === c ? '#ffffff' : '#64748b',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Table */}
            <div
              style={{
                background: '#111827',
                border: '1px solid #1e293b',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#38bdf8', textAlign: 'left', fontWeight: 700 }}>
                      <th style={{ padding: '12px 14px', width: 90 }}>Code</th>
                      <th style={{ padding: '12px 14px' }}>Item Name (Ground Floor Store)</th>
                      <th style={{ padding: '12px 14px', width: 150 }}>Category</th>
                      <th style={{ padding: '12px 14px', width: 140 }}>Classification</th>
                      <th style={{ padding: '12px 14px', width: 140 }}>Current Stock</th>
                      <th style={{ padding: '12px 14px', width: 160 }}>Location</th>
                      <th style={{ padding: '12px 14px', width: 140, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalog.map((item, idx) => {
                      const isFixed = item.type === MATERIAL_TYPES.FIXED;
                      const isRet = item.type === MATERIAL_TYPES.RETURNABLE;
                      return (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid #1e293b',
                            background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#94a3b8' }}>
                            {item.id}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#f8fafc', fontWeight: 600 }}>
                            {item.name}
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{item.desc}</div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                            {item.category}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: isFixed ? 'rgba(168,85,247,0.15)' : isRet ? 'rgba(56,189,248,0.15)' : 'rgba(16,185,129,0.15)',
                                color: isFixed ? '#c084fc' : isRet ? '#38bdf8' : '#34d399',
                                border: `1px solid ${isFixed ? '#a855f7' : isRet ? '#38bdf8' : '#10b981'}`,
                              }}
                            >
                              {item.type.replace(' Material', '')}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#34d399' }}>
                            {item.stock}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>
                            {item.location}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleQuickDemandItem(item)}
                              style={{
                                background: 'rgba(56,189,248,0.15)',
                                border: '1px solid #38bdf8',
                                color: '#38bdf8',
                                borderRadius: 6,
                                padding: '5px 10px',
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Plus size={12} /> Demand
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 2: MATERIAL REQUISITION MAKER (DEMAND FORM)
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'NEW_REQUISITION' && (
          <div>
            {submitFeedback && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  marginBottom: 16,
                  background: submitFeedback.type === 'SUCCESS' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  border: `1px solid ${submitFeedback.type === 'SUCCESS' ? '#059669' : '#dc2626'}`,
                  color: submitFeedback.type === 'SUCCESS' ? '#34d399' : '#f87171',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {submitFeedback.msg}
              </div>
            )}

            {/* Requisition Meta Bar */}
            <div
              style={{
                background: '#111827',
                border: '1px solid #1e293b',
                borderRadius: 12,
                padding: '16px 20px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    Project / Branch Site:
                  </label>
                  <select
                    value={branchSite}
                    onChange={(e) => setBranchSite(e.target.value)}
                    style={{
                      background: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
                  >
                    <option value="Manawala">Manawala (BOP)</option>
                    <option value="Chiniot">Chiniot (MCB)</option>
                    <option value="Burewala">Burewala (HBL)</option>
                    <option value="Sammundri">Sammundri (BAHL)</option>
                    <option value="Mailsi">Mailsi (ABL)</option>
                    <option value="Office Store">Office / General Store</option>
                    <option value="Other">Other Custom Site</option>
                  </select>
                </div>

                {branchSite === 'Other' && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                      Specify Site Name:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Faisalabad Main Branch"
                      value={customBranch}
                      onChange={(e) => setCustomBranch(e.target.value)}
                      style={{
                        background: '#0f172a',
                        color: '#f8fafc',
                        border: '1px solid #334155',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: 12.5,
                      }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    Requested By (Supervisor / Employee):
                  </label>
                  <input
                    type="text"
                    value={siteSupervisor}
                    onChange={(e) => setSiteSupervisor(e.target.value)}
                    style={{
                      background: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 12.5,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: '#f8fafc',
                    border: '1px solid rgba(255,255,255,0.15)',
                    padding: '8px 14px',
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Download size={14} /> {isDownloadingPdf ? 'Generating PDF...' : 'Download Official PDF'}
                </button>
                <button
                  type="button"
                  onClick={handleSubmitRequisition}
                  disabled={isSubmitting}
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Check size={14} /> {isSubmitting ? 'Submitting...' : 'Submit Requisition & Issue Gate Pass'}
                </button>
              </div>
            </div>

            {/* Editable Official Demand Sheet */}
            <DemandFormSheet
              type="MATERIAL"
              formData={materialForm}
              onChange={setMaterialForm}
              readOnly={false}
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 3: RETURNABLE TOOLS & LOAN TRACKER
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'RETURNABLE' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                  ACTIVE RETURNABLE EQUIPMENT & TOOLS
                </h3>
                <p style={{ fontSize: 12, color: '#94a3b8' }}>
                  Tools on temporary loan to technicians. Must be returned to Ground Floor store upon project completion.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToolIssueModalOpen(true)}
                style={{
                  background: '#38bdf8',
                  color: '#090d16',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 14px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={14} /> Issue New Tool Loan
              </button>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#38bdf8', textAlign: 'left', fontWeight: 700 }}>
                      <th style={{ padding: '12px 14px', width: 100 }}>Loan ID</th>
                      <th style={{ padding: '12px 14px' }}>Tool / Equipment Description</th>
                      <th style={{ padding: '12px 14px' }}>Issued To (Custodian)</th>
                      <th style={{ padding: '12px 14px' }}>Project Site</th>
                      <th style={{ padding: '12px 14px', width: 110 }}>Issue Date</th>
                      <th style={{ padding: '12px 14px', width: 110 }}>Due Date</th>
                      <th style={{ padding: '12px 14px', width: 140 }}>Status</th>
                      <th style={{ padding: '12px 14px', width: 120, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnableTools.map((loan, idx) => {
                      const isReturned = loan.status === 'RETURNED';
                      return (
                        <tr
                          key={loan.id}
                          style={{
                            borderBottom: '1px solid #1e293b',
                            background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#94a3b8' }}>
                            {loan.id}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#f8fafc' }}>
                            {loan.toolName}
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{loan.condition}</div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                            {loan.issuedTo}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                            {loan.site}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#94a3b8' }}>
                            {loan.issueDate}
                          </td>
                          <td style={{ padding: '10px 14px', color: isReturned ? '#94a3b8' : '#f59e0b', fontWeight: 600 }}>
                            {loan.dueDate}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: isReturned ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                color: isReturned ? '#34d399' : '#fbbf24',
                                border: `1px solid ${isReturned ? '#059669' : '#d97706'}`,
                              }}
                            >
                              {isReturned ? '🟢 RETURNED' : '🟡 IN FIELD'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {!isReturned ? (
                              <button
                                type="button"
                                onClick={() => handleMarkToolReturned(loan.id)}
                                style={{
                                  background: 'rgba(16,185,129,0.15)',
                                  border: '1px solid #059669',
                                  color: '#34d399',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Mark Returned
                              </button>
                            ) : (
                              <span style={{ fontSize: 11, color: '#64748b' }}>Restocked</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal to Issue New Tool Loan */}
            {toolIssueModalOpen && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(15,23,42,0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    background: '#1e293b',
                    borderRadius: 12,
                    padding: 24,
                    width: '100%',
                    maxWidth: 480,
                    border: '1px solid #334155',
                  }}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginBottom: 14 }}>
                    ISSUE RETURNABLE TOOL LOAN
                  </h3>
                  <form onSubmit={handleCreateToolLoan}>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                        Tool Name:
                      </label>
                      <select
                        value={newToolLoan.toolName}
                        onChange={(e) => setNewToolLoan({ ...newToolLoan, toolName: e.target.value })}
                        style={{
                          width: '100%',
                          background: '#0f172a',
                          color: '#fff',
                          border: '1px solid #334155',
                          borderRadius: 6,
                          padding: '8px 10px',
                          fontSize: 12.5,
                        }}
                      >
                        <option value="Gas Cylinder (LPG 15kg)">Gas Cylinder (LPG 15kg)</option>
                        <option value="Oxygen Cylinder">Oxygen Cylinder</option>
                        <option value="Clamp Meter (Fluke 302+)">Clamp Meter (Fluke 302+)</option>
                        <option value="PSI Presure Gage">PSI Presure Gage</option>
                        <option value="Drill Machine (Bosch Impact)">Drill Machine (Bosch Impact)</option>
                        <option value="Tube Cutter">Tube Cutter</option>
                        <option value="Flaring Toll">Flaring Toll</option>
                        <option value="Spanner Set (10-24)">Spanner Set (10-24)</option>
                        <option value="Bearing Puller">Bearing Puller</option>
                        <option value="Welding Torch + gage + pipe">Welding Torch + gage + pipe</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                        Issued To (Employee Name):
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ali Shehzad"
                        value={newToolLoan.issuedTo}
                        onChange={(e) => setNewToolLoan({ ...newToolLoan, issuedTo: e.target.value })}
                        style={{
                          width: '100%',
                          background: '#0f172a',
                          color: '#fff',
                          border: '1px solid #334155',
                          borderRadius: 6,
                          padding: '8px 10px',
                          fontSize: 12.5,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                        Project Site:
                      </label>
                      <input
                        type="text"
                        value={newToolLoan.site}
                        onChange={(e) => setNewToolLoan({ ...newToolLoan, site: e.target.value })}
                        style={{
                          width: '100%',
                          background: '#0f172a',
                          color: '#fff',
                          border: '1px solid #334155',
                          borderRadius: 6,
                          padding: '8px 10px',
                          fontSize: 12.5,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: 18 }}>
                      <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                        Return Due Date:
                      </label>
                      <input
                        type="date"
                        value={newToolLoan.dueDate}
                        onChange={(e) => setNewToolLoan({ ...newToolLoan, dueDate: e.target.value })}
                        style={{
                          width: '100%',
                          background: '#0f172a',
                          color: '#fff',
                          border: '1px solid #334155',
                          borderRadius: 6,
                          padding: '8px 10px',
                          fontSize: 12.5,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setToolIssueModalOpen(false)}
                        style={{
                          background: 'transparent',
                          color: '#94a3b8',
                          border: '1px solid #334155',
                          borderRadius: 6,
                          padding: '6px 14px',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        style={{
                          background: '#38bdf8',
                          color: '#090d16',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 16px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Confirm Issue
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 4: SOURCING & GATE PASS LOG
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'DEMANDS_LOG' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                  MATERIAL SOURCING & REQUISITION LEDGER
                </h3>
                <p style={{ fontSize: 12, color: '#94a3b8' }}>
                  Live tracking of Store Dispatches (Gate Passes) vs Self-Purchased items claimed through cash advances.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchDemands}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#38bdf8', textAlign: 'left', fontWeight: 700 }}>
                      <th style={{ padding: '12px 14px', width: 110 }}>Requisition #</th>
                      <th style={{ padding: '12px 14px' }}>Project / Site</th>
                      <th style={{ padding: '12px 14px' }}>Requested By</th>
                      <th style={{ padding: '12px 14px' }}>Items Summary</th>
                      <th style={{ padding: '12px 14px', width: 130 }}>Sourcing Nature</th>
                      <th style={{ padding: '12px 14px', width: 120 }}>Status</th>
                      <th style={{ padding: '12px 14px', width: 110 }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDemands.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                          No requisitions recorded yet. Create a new requisition using the tab above.
                        </td>
                      </tr>
                    ) : (
                      recentDemands.map((dem, idx) => {
                        const items = dem.formData?.items || [];
                        const storeCount = items.filter((i) => (i.sourcingMode || 'Buy from Store') === 'Buy from Store').length;
                        const selfCount = items.filter((i) => (i.sourcingMode || '') === 'Self Buy').length;
                        return (
                          <tr
                            key={dem.id || idx}
                            style={{
                              borderBottom: '1px solid #1e293b',
                              background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#94a3b8' }}>
                              {dem.formData?.requisitionNo || dem.id.slice(0, 10)}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#f8fafc' }}>
                              {dem.branchName || dem.projectTitle || 'Site'}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                              {dem.requestedBy || 'Staff'}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>
                              {dem.description || 'Material items'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {storeCount > 0 && (
                                  <span style={{ fontSize: 10.5, fontWeight: 700, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '2px 6px', borderRadius: 4 }}>
                                    Store: {storeCount}
                                  </span>
                                )}
                                {selfCount > 0 && (
                                  <span style={{ fontSize: 10.5, fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '2px 6px', borderRadius: 4 }}>
                                    Self: {selfCount}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: dem.status === 'ACCEPT' ? 'rgba(16,185,129,0.15)' : dem.status === 'REJECT' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                  color: dem.status === 'ACCEPT' ? '#34d399' : dem.status === 'REJECT' ? '#f87171' : '#fbbf24',
                                }}
                              >
                                {dem.status || 'HOLD'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 11.5 }}>
                              {dem.createdAt ? new Date(dem.createdAt).toLocaleDateString() : 'Today'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
