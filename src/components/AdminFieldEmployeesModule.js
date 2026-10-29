"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  HardHat,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  Package,
  Users,
  RefreshCw,
  Download,
  Eye,
  X,
  FolderKanban,
  Filter,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import {
  PROJECT_STATUS_OPTIONS,
  DEMAND_STATUS_OPTIONS,
  buildExpenseSectionsFromEntries,
  normalizeProgressSections,
  createDefaultMaterialDemandForm,
  createDefaultPaymentDemandForm,
} from '@/lib/projectReportTemplates';
import {
  downloadProgressReportPdf,
  downloadExpenseReportPdf,
  downloadMaterialDemandPdf,
  downloadPaymentDemandPdf,
} from '@/lib/projectPdfGenerator';
import DemandFormSheet from '@/components/DemandFormSheet';

export default function AdminFieldEmployeesModule() {
  const [projects, setProjects] = useState([]);
  const [allDemands, setAllDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('ALL');
  const [demandTypeFilter, setDemandTypeFilter] = useState('ALL'); // 'ALL' | 'MATERIAL' | 'PAYMENT'
  const [demandStatusFilter, setDemandStatusFilter] = useState('ALL'); // 'ALL' | 'HOLD' | 'ACCEPT' | 'REJECT'
  const [updatingDemandId, setUpdatingDemandId] = useState(null);
  const [adminNotesDraft, setAdminNotesDraft] = useState({});
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [inspectingProject, setInspectingProject] = useState(null);
  const [inspectingDemand, setInspectingDemand] = useState(null);
  const [exportingKey, setExportingKey] = useState(null);

  const handleExportDemandPdf = async (dem) => {
    setExportingKey(dem.id);
    try {
      if (dem.type === 'PAYMENT') {
        const fallback = createDefaultPaymentDemandForm({
          branchSite: dem.branchName || dem.projectLabel || 'Site',
          siteSupervisor: dem.requestedBy || '',
          reportDate: dem.createdAt ? dem.createdAt.split('T')[0] : '',
        });
        fallback.netAmountDemanded = String(dem.amount || '');
        fallback.totalAmountRequired = String(dem.amount || '');
        fallback.purposeJustification = dem.description || '';
        await downloadPaymentDemandPdf(dem.formData || fallback);
      } else {
        const fallback = createDefaultMaterialDemandForm({
          branchSite: dem.branchName || dem.projectLabel || 'Site',
          siteSupervisor: dem.requestedBy || '',
          reportDate: dem.createdAt ? dem.createdAt.split('T')[0] : '',
        });
        fallback.purpose = dem.description || '';
        await downloadMaterialDemandPdf(dem.formData || fallback, dem.amount || 0);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Demand PDF export failed: ' + err.message });
    } finally {
      setExportingKey(null);
    }
  };

  const loadFieldData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch('/api/field-projects');
      const loadedProjects = Array.isArray(res.allProjects)
        ? res.allProjects
        : Array.isArray(res.projects)
        ? res.projects
        : [];
      setProjects(loadedProjects);

      if (Array.isArray(res.allDemands)) {
        setAllDemands(res.allDemands);
      } else {
        const flat = loadedProjects
          .flatMap((p) =>
            (p.demands || []).map((d) => ({
              ...d,
              projectLabel: p.label,
              branchName: p.branchName || d.branchName,
              jobMetadataId: p.jobMetadataId || d.jobMetadataId,
              reportId: p.reportId || d.reportId,
            }))
          )
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setAllDemands(flat);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: 'Failed to load field employees dashboard data: ' + (err.message || 'Network error'),
      });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadFieldData();
  }, []);

  const getStatusMeta = (val) =>
    PROJECT_STATUS_OPTIONS.find((s) => s.value === val) || PROJECT_STATUS_OPTIONS[0];

  // Filtered projects for the 4 Field Employee Dashboard Cards
  const scopedProjects = useMemo(() => {
    if (selectedProjectFilter === 'ALL') return projects;
    return projects.filter(
      (p) => p.key === selectedProjectFilter || p.branchName === selectedProjectFilter
    );
  }, [projects, selectedProjectFilter]);

  const dashboardCardMetrics = useMemo(() => {
    let projectExpense = 0;
    let materialExpense = 0;
    let labourExpense = 0;
    let progressSum = 0;
    let activeCount = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let onHoldCount = 0;

    scopedProjects.forEach((p) => {
      projectExpense += parseFloat(p.projectExpense) || 0;
      materialExpense += parseFloat(p.materialExpense) || 0;
      labourExpense += parseFloat(p.labourExpense) || 0;
      progressSum += parseFloat(p.overallProgressPercent) || 0;
      if (p.projectStatus === 'COMPLETED') completedCount++;
      else if (p.projectStatus === 'ON_HOLD') onHoldCount++;
      else if (p.projectStatus === 'IN_PROGRESS') inProgressCount++;
      if (p.jobMetadataId || (p.overallProgressPercent || 0) > 0 || (p.projectExpense || 0) > 0) {
        activeCount++;
      }
    });

    const avgProgress =
      scopedProjects.length > 0 ? Math.round(progressSum / scopedProjects.length) : 0;

    const singleProject = scopedProjects.length === 1 ? scopedProjects[0] : null;
    const singleStatusMeta = singleProject ? getStatusMeta(singleProject.projectStatus) : null;

    return {
      projectExpense,
      materialExpense,
      labourExpense,
      avgProgress,
      activeCount,
      completedCount,
      inProgressCount,
      onHoldCount,
      singleProject,
      singleStatusMeta,
    };
  }, [scopedProjects]);

  // Filtered Demands for Demands Management
  const filteredDemands = useMemo(() => {
    return allDemands.filter((d) => {
      if (selectedProjectFilter !== 'ALL') {
        const matchesKey = d.projectKey === selectedProjectFilter;
        const matchesBranch = d.branchName === selectedProjectFilter;
        if (!matchesKey && !matchesBranch) return false;
      }
      if (demandTypeFilter !== 'ALL' && d.type !== demandTypeFilter) return false;
      if (demandStatusFilter !== 'ALL' && d.status !== demandStatusFilter) return false;
      return true;
    });
  }, [allDemands, selectedProjectFilter, demandTypeFilter, demandStatusFilter]);

  const demandSummary = useMemo(() => {
    let materialTotal = 0;
    let materialCount = 0;
    let paymentTotal = 0;
    let paymentCount = 0;
    let holdCount = 0;
    let acceptCount = 0;
    let rejectCount = 0;
    let acceptedAmount = 0;

    allDemands.forEach((d) => {
      const amt = parseFloat(d.amount) || 0;
      if (d.type === 'PAYMENT') {
        paymentTotal += amt;
        paymentCount++;
      } else {
        materialTotal += amt;
        materialCount++;
      }
      if (d.status === 'ACCEPT') {
        acceptCount++;
        acceptedAmount += amt;
      } else if (d.status === 'REJECT') {
        rejectCount++;
      } else {
        holdCount++;
      }
    });

    return {
      materialTotal,
      materialCount,
      paymentTotal,
      paymentCount,
      holdCount,
      acceptCount,
      rejectCount,
      acceptedAmount,
    };
  }, [allDemands]);

  // Admin Action: Hold / Accept / Reject Demand
  const handleAdminDemandStatus = async (demand, nextStatus) => {
    setUpdatingDemandId(demand.id);
    setFeedback({ type: '', text: '' });

    const noteVal =
      adminNotesDraft[demand.id] !== undefined
        ? adminNotesDraft[demand.id]
        : demand.adminNote || '';

    try {
      await apiFetch('/api/field-projects', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'UPDATE_DEMAND_STATUS',
          demandId: demand.id,
          status: nextStatus,
          reportId: demand.reportId,
          jobMetadataId: demand.jobMetadataId,
          adminNote: noteVal,
        }),
      });

      // Optimistically update local state immediately
      setAllDemands((prev) =>
        prev.map((item) =>
          item.id === demand.id
            ? {
                ...item,
                status: nextStatus,
                adminNote: noteVal,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );

      await loadFieldData(true);

      const statusLabel =
        DEMAND_STATUS_OPTIONS.find((s) => s.value === nextStatus)?.label || nextStatus;
      setFeedback({
        type: 'success',
        text: `${demand.type === 'PAYMENT' ? 'Payment Demand' : 'Material Demand'} (Rs. ${(
          parseFloat(demand.amount) || 0
        ).toLocaleString()} — ${demand.branchName}) marked as "${statusLabel}".`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: 'Failed to update demand status: ' + (err.message || 'Server error'),
      });
    } finally {
      setUpdatingDemandId(null);
    }
  };

  const handleExportSiteProgressPdf = async (proj) => {
    setExportingKey(proj.key);
    try {
      const enriched = normalizeProgressSections(proj.progressSections);
      if (enriched.length > 0) {
        enriched[0].sheetMeta = {
          branchSite: proj.branchName || proj.label,
          reportDate: proj.reportDate || new Date().toISOString().split('T')[0],
          siteSupervisor: proj.siteSupervisor || '',
          targetCompletion: proj.targetCompletion || '',
          projectStatus: proj.projectStatus || 'IN_PROGRESS',
        };
      }
      await downloadProgressReportPdf({
        job: { branchName: proj.branchName || proj.label, id: proj.jobMetadataId },
        reportDate: proj.reportDate || new Date().toISOString().split('T')[0],
        sections: enriched,
        overallProgressPercent: proj.overallProgressPercent || 0,
        employeeName: proj.siteSupervisor || 'Field Supervisor',
        siteSupervisor: proj.siteSupervisor || '',
        targetCompletion: proj.targetCompletion || '',
      });
    } catch (err) {
      setFeedback({ type: 'error', text: 'PDF export failed: ' + err.message });
    } finally {
      setExportingKey(null);
    }
  };

  const handleExportSiteExpensePdf = async (proj) => {
    setExportingKey(`${proj.key}-exp`);
    try {
      const sections = buildExpenseSectionsFromEntries(proj.expenseEntries || []);
      await downloadExpenseReportPdf({
        job: { branchName: proj.branchName || proj.label, id: proj.jobMetadataId },
        reportDate: proj.reportDate || new Date().toISOString().split('T')[0],
        sections,
        totalExpenseAmount: proj.projectExpense || 0,
        materialExpense: proj.materialExpense || 0,
        labourExpense: proj.labourExpense || 0,
        paidBy: proj.paidBy || 'FES',
        employeeName: proj.siteSupervisor || 'Field Supervisor',
      });
    } catch (err) {
      setFeedback({ type: 'error', text: 'Expense PDF export failed: ' + err.message });
    } finally {
      setExportingKey(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* ── MODULE HEADER & PROJECT FILTER BAR ── */}
      <section className="glass-card" style={{ padding: '20px 24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(16, 185, 129, 0.16)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HardHat size={24} color="#34d399" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f8fafc' }}>
                Field Employees Dashboard &amp; Demands Management
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: 12.5, color: '#94a3b8' }}>
                Live view of all Field Employee Project Cards (Project Status, Project Expense, Material Expense, Labour Expense) &amp; Material / Payment Demands approval
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadFieldData()}
            className="nexus-btn nexus-btn-ghost"
            style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Data</span>
          </button>
        </div>

        {/* Project Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 700, marginRight: 4 }}>
            <Filter size={12} style={{ display: 'inline', marginRight: 4 }} />
            Project Site:
          </span>
          <button
            type="button"
            onClick={() => setSelectedProjectFilter('ALL')}
            className={`nexus-btn ${selectedProjectFilter === 'ALL' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
            style={{ padding: '6px 14px', fontSize: 12 }}
          >
            All Projects ({projects.length})
          </button>
          {projects.map((p) => {
            const active = selectedProjectFilter === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelectedProjectFilter(p.key)}
                className={`nexus-btn ${active ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  borderColor: active ? undefined : 'rgba(52, 211, 153, 0.28)',
                }}
              >
                {p.branchName && p.branchName !== 'Other' ? p.branchName : p.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Feedback Banner */}
      {feedback.text && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            fontSize: 13,
            background:
              feedback.type === 'error'
                ? 'rgba(239, 68, 68, 0.16)'
                : 'rgba(16, 185, 129, 0.16)',
            color: feedback.type === 'error' ? '#fca5a5' : '#6ee7b7',
            border: `1px solid ${
              feedback.type === 'error'
                ? 'rgba(239, 68, 68, 0.35)'
                : 'rgba(16, 185, 129, 0.35)'
            }`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback({ type: '', text: '' })}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: ALL 4 FIELD EMPLOYEES DASHBOARD CARDS                     */}
      {/* 1. Project Status | 2. Project Expense | 3. Material | 4. Labour     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))',
          gap: 16,
        }}
      >
        {/* CARD 1: PROJECT STATUS */}
        <div
          className="glass-card"
          style={{
            padding: '20px',
            border: `1px solid ${
              dashboardCardMetrics.singleStatusMeta
                ? `${dashboardCardMetrics.singleStatusMeta.color}44`
                : 'rgba(52, 211, 153, 0.32)'
            }`,
            background: 'rgba(15, 23, 42, 0.85)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8' }}>
              Project Status
            </span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: dashboardCardMetrics.singleStatusMeta?.bg || 'rgba(52, 211, 153, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={18} color={dashboardCardMetrics.singleStatusMeta?.color || '#34d399'} />
            </div>
          </div>

          {dashboardCardMetrics.singleProject ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span
                  style={{
                    fontSize: 21,
                    fontWeight: 800,
                    color: dashboardCardMetrics.singleStatusMeta.color,
                  }}
                >
                  {dashboardCardMetrics.singleStatusMeta.label}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                  {dashboardCardMetrics.singleProject.overallProgressPercent || 0}%
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 7,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 999,
                  overflow: 'hidden',
                  marginTop: 10,
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, dashboardCardMetrics.singleProject.overallProgressPercent || 0)
                    )}%`,
                    height: '100%',
                    background: dashboardCardMetrics.singleStatusMeta.color,
                  }}
                />
              </div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8 }}>
                Site: <strong>{dashboardCardMetrics.singleProject.branchName}</strong>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 21, fontWeight: 800, color: '#34d399' }}>
                  {dashboardCardMetrics.avgProgress}% Avg Progress
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 7,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 999,
                  overflow: 'hidden',
                  marginTop: 10,
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, dashboardCardMetrics.avgProgress))}%`,
                    height: '100%',
                    background: '#34d399',
                  }}
                />
              </div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8 }}>
                {dashboardCardMetrics.inProgressCount} In Progress · {dashboardCardMetrics.completedCount} Completed · {dashboardCardMetrics.onHoldCount} Delayed
              </div>
            </>
          )}
        </div>

        {/* CARD 2: PROJECT EXPENSE */}
        <div
          className="glass-card"
          style={{
            padding: '20px',
            border: '1px solid rgba(56, 189, 248, 0.32)',
            background: 'rgba(15, 23, 42, 0.85)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8' }}>
              Project Expense
            </span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign size={18} color="#38bdf8" />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8' }}>
            Rs. {dashboardCardMetrics.projectExpense.toLocaleString()}
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8 }}>
            Combined Material + Labour site expenditure
          </div>
        </div>

        {/* CARD 3: MATERIAL EXPENSE */}
        <div
          className="glass-card"
          style={{
            padding: '20px',
            border: '1px solid rgba(251, 191, 36, 0.32)',
            background: 'rgba(15, 23, 42, 0.85)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8' }}>
              Material Expense
            </span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: 'rgba(251, 191, 36, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Package size={18} color="#fbbf24" />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24' }}>
            Rs. {dashboardCardMetrics.materialExpense.toLocaleString()}
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8 }}>
            Construction &amp; branch site materials
          </div>
        </div>

        {/* CARD 4: LABOUR EXPENSE */}
        <div
          className="glass-card"
          style={{
            padding: '20px',
            border: '1px solid rgba(167, 139, 250, 0.32)',
            background: 'rgba(15, 23, 42, 0.85)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8' }}>
              Labour Expense
            </span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: 'rgba(167, 139, 250, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={18} color="#a78bfa" />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#a78bfa' }}>
            Rs. {dashboardCardMetrics.labourExpense.toLocaleString()}
          </div>
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8 }}>
            Workforce, technicians &amp; daily wages
          </div>
        </div>
      </div>

      {/* ── PER-SITE FIELD PROJECT BREAKDOWN CARDS ── */}
      <section className="glass-card" style={{ padding: '20px 24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderKanban size={19} color="#34d399" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
              Field Projects Overview (Manawala, Kanjwahl, Muradshah, Tordywala &amp; Other)
            </h3>
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            Click a site to filter cards &amp; demands or inspect its 9-page Progress Sheet
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 14,
          }}
        >
          {projects.map((proj) => {
            const stMeta = getStatusMeta(proj.projectStatus);
            const isSelected = selectedProjectFilter === proj.key;
            const projDemandsCount = (proj.demands || []).length;
            const holdDemandsCount = (proj.demands || []).filter((d) => d.status === 'HOLD').length;

            return (
              <div
                key={proj.key}
                style={{
                  padding: '16px',
                  borderRadius: 12,
                  border: isSelected
                    ? '1.5px solid #34d399'
                    : '1px solid rgba(255,255,255,0.09)',
                  background: isSelected
                    ? 'rgba(16, 185, 129, 0.08)'
                    : 'rgba(255,255,255,0.025)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedProjectFilter(isSelected ? 'ALL' : proj.key)
                      }
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        color: '#f8fafc',
                        fontSize: 16,
                        fontWeight: 800,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {proj.branchName && proj.branchName !== 'Other' ? proj.branchName : proj.label}
                    </button>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: stMeta.bg,
                        color: stMeta.color,
                      }}
                    >
                      {stMeta.label}
                    </span>
                  </div>

                  {proj.siteSupervisor && (
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                      Supervisor: <strong style={{ color: '#cbd5e1' }}>{proj.siteSupervisor}</strong>
                    </div>
                  )}

                  {/* Mini 4 Metrics */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      marginTop: 12,
                      padding: '10px',
                      borderRadius: 8,
                      background: 'rgba(2, 6, 23, 0.5)',
                      fontSize: 11.5,
                    }}
                  >
                    <div>
                      <div style={{ color: '#64748b' }}>Progress</div>
                      <div style={{ fontWeight: 800, color: '#34d399', fontSize: 13 }}>
                        {proj.overallProgressPercent || 0}%
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Project Exp.</div>
                      <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: 13 }}>
                        Rs. {(proj.projectExpense || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Material</div>
                      <div style={{ fontWeight: 700, color: '#fbbf24' }}>
                        Rs. {(proj.materialExpense || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Labour</div>
                      <div style={{ fontWeight: 700, color: '#a78bfa' }}>
                        Rs. {(proj.labourExpense || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {projDemandsCount > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: '#fbbf24', fontWeight: 600 }}>
                      Demands: {projDemandsCount} total
                      {holdDemandsCount > 0 ? ` (${holdDemandsCount} on Hold)` : ''}
                    </div>
                  )}
                </div>

                {/* Progress Sheet Inspect + PDF Buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setInspectingProject(proj)}
                    className="nexus-btn nexus-btn-ghost"
                    style={{ flex: 1, padding: '6px 10px', fontSize: 11.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  >
                    <Eye size={13} />
                    <span>Progress Sheet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportSiteProgressPdf(proj)}
                    disabled={exportingKey === proj.key}
                    className="nexus-btn nexus-btn-ghost"
                    style={{ padding: '6px 10px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5, color: '#34d399' }}
                    title="Download 9-Page Progress PDF"
                  >
                    <Download size={13} />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: DEMANDS MANAGEMENT (ALL MATERIAL & PAYMENT DEMANDS)       */}
      {/* With Admin Action Buttons: Hold | Accept | Reject on each demand     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section
        className="glass-card"
        style={{
          padding: '22px 24px',
          border: '1px solid rgba(251, 191, 36, 0.3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 14,
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <DollarSign size={22} color="#fbbf24" />
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#f8fafc' }}>
                Demands Management — Material &amp; Payment Demands
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: '#94a3b8' }}>
              Review all Material Demands and Payment Demands submitted by field employees and set each demand to <strong>Hold</strong>, <strong>Accept</strong>, or <strong>Reject</strong>.
            </p>
          </div>

          {/* Summary Totals Strip */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                fontSize: 12,
              }}
            >
              <span style={{ color: '#94a3b8' }}>Material Demands: </span>
              <strong style={{ color: '#fbbf24' }}>
                {demandSummary.materialCount} (Rs. {demandSummary.materialTotal.toLocaleString()})
              </strong>
            </div>

            <div
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontSize: 12,
              }}
            >
              <span style={{ color: '#94a3b8' }}>Payment Demands: </span>
              <strong style={{ color: '#38bdf8' }}>
                {demandSummary.paymentCount} (Rs. {demandSummary.paymentTotal.toLocaleString()})
              </strong>
            </div>
          </div>
        </div>

        {/* Demand Type & Status Filters */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 18,
            paddingBottom: 14,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Type Filter */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: `All Demands (${allDemands.length})` },
              { id: 'MATERIAL', label: `Material Demands (${demandSummary.materialCount})` },
              { id: 'PAYMENT', label: `Payment Demands (${demandSummary.paymentCount})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDemandTypeFilter(t.id)}
                className={`nexus-btn ${demandTypeFilter === t.id ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'All Statuses' },
              { id: 'HOLD', label: `Hold (${demandSummary.holdCount})` },
              { id: 'ACCEPT', label: `Accept (${demandSummary.acceptCount})` },
              { id: 'REJECT', label: `Reject (${demandSummary.rejectCount})` },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setDemandStatusFilter(s.id)}
                className={`nexus-btn ${demandStatusFilter === s.id ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Demands List */}
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
            Loading field employee demands...
          </div>
        ) : filteredDemands.length === 0 ? (
          <div
            style={{
              padding: '32px 20px',
              textAlign: 'center',
              borderRadius: 12,
              border: '1px dashed rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.02)',
              color: '#94a3b8',
              fontSize: 13.5,
            }}
          >
            No Material or Payment demands match the selected filter yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredDemands.map((dem) => {
              const isPayment = dem.type === 'PAYMENT';
              const currentStatus = ['HOLD', 'ACCEPT', 'REJECT'].includes(dem.status)
                ? dem.status
                : 'HOLD';
              const isBusy = updatingDemandId === dem.id;
              const noteValue =
                adminNotesDraft[dem.id] !== undefined
                  ? adminNotesDraft[dem.id]
                  : dem.adminNote || '';

              return (
                <div
                  key={dem.id}
                  style={{
                    padding: '18px 20px',
                    borderRadius: 12,
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 16,
                  }}
                >
                  {/* Left: Project, Employee, Demand Type, Manual Amount & Details */}
                  <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {/* Project Badge */}
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: 6,
                          background: 'rgba(16, 185, 129, 0.16)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                        }}
                      >
                        Project: {dem.branchName || dem.projectLabel || 'Site'}
                      </span>

                      {/* Demand Type Badge */}
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: 6,
                          background: isPayment
                            ? 'rgba(56, 189, 248, 0.16)'
                            : 'rgba(251, 191, 36, 0.16)',
                          color: isPayment ? '#38bdf8' : '#fbbf24',
                          border: `1px solid ${
                            isPayment
                              ? 'rgba(56, 189, 248, 0.35)'
                              : 'rgba(251, 191, 36, 0.35)'
                          }`,
                        }}
                      >
                        {isPayment ? 'Payment Demand' : 'Material Demand'}
                      </span>

                      {/* Manual Amount */}
                      <span style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc' }}>
                        Rs. {(parseFloat(dem.amount) || 0).toLocaleString()}
                      </span>
                    </div>

                    {dem.description && (
                      <div style={{ fontSize: 13.5, color: '#e2e8f0' }}>
                        {dem.description}
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>
                        Requested by: <strong style={{ color: '#cbd5e1' }}>{dem.requestedBy || 'Field Employee'}</strong>
                      </span>
                      <span>
                        • {dem.createdAt ? new Date(dem.createdAt).toLocaleString() : ''}
                      </span>
                      {dem.reviewedBy && (
                        <span style={{ color: '#a78bfa' }}>
                          • Last updated by {dem.reviewedBy}
                        </span>
                      )}
                    </div>

                    {/* Optional Admin Remark Input + View Form / Download PDF */}
                    <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="nexus-input"
                        placeholder="Add optional admin note (visible to field employee)..."
                        value={noteValue}
                        onChange={(e) =>
                          setAdminNotesDraft((prev) => ({
                            ...prev,
                            [dem.id]: e.target.value,
                          }))
                        }
                        style={{ padding: '6px 10px', fontSize: 12, flex: '1 1 240px', maxWidth: 380 }}
                      />

                      <button
                        type="button"
                        onClick={() => setInspectingDemand(dem)}
                        className="nexus-btn nexus-btn-ghost"
                        style={{ padding: '6px 12px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        <Eye size={13} />
                        <span>View Form</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportDemandPdf(dem)}
                        disabled={exportingKey === dem.id}
                        className="nexus-btn nexus-btn-ghost"
                        style={{ padding: '6px 12px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 5, color: '#38bdf8' }}
                      >
                        <Download size={13} />
                        <span>{exportingKey === dem.id ? 'Exporting...' : 'PDF'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Right: Admin Action Buttons -> HOLD | ACCEPT | REJECT */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {DEMAND_STATUS_OPTIONS.map((opt) => {
                      const isActive = currentStatus === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAdminDemandStatus(dem, opt.value)}
                          style={{
                            padding: '9px 16px',
                            borderRadius: 9,
                            fontSize: 12.5,
                            fontWeight: 800,
                            cursor: isBusy ? 'not-allowed' : 'pointer',
                            border: isActive
                              ? `2px solid ${opt.color}`
                              : '1px solid rgba(255,255,255,0.14)',
                            background: isActive ? opt.bg : 'rgba(255,255,255,0.04)',
                            color: isActive ? opt.color : '#cbd5e1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: isActive ? `0 4px 14px ${opt.bg}` : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {opt.value === 'HOLD' && <Clock size={14} color={isActive ? opt.color : '#94a3b8'} />}
                          {opt.value === 'ACCEPT' && <CheckCircle2 size={14} color={isActive ? opt.color : '#94a3b8'} />}
                          {opt.value === 'REJECT' && <X size={14} color={isActive ? opt.color : '#94a3b8'} />}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── MODAL TO INSPECT A SUBMITTED MATERIAL / PAYMENT DEMAND FORM ── */}
      {inspectingDemand && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setInspectingDemand(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 900,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '20px',
              borderRadius: 14,
              background: '#0f172a',
              border: '1px solid rgba(251, 191, 36, 0.4)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>
                  {inspectingDemand.type === 'PAYMENT'
                    ? 'Site Payment Demand Form'
                    : 'Material Demand / Requisition Form'}{' '}
                  — {inspectingDemand.branchName || inspectingDemand.projectLabel}
                </h3>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                  Requested by: <strong>{inspectingDemand.requestedBy}</strong> · Amount:{' '}
                  <strong style={{ color: '#fbbf24' }}>
                    Rs. {(parseFloat(inspectingDemand.amount) || 0).toLocaleString()}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {DEMAND_STATUS_OPTIONS.map((opt) => {
                  const active = (inspectingDemand.status || 'HOLD') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={updatingDemandId === inspectingDemand.id}
                      onClick={async () => {
                        await handleAdminDemandStatus(inspectingDemand, opt.value);
                        setInspectingDemand((prev) =>
                          prev ? { ...prev, status: opt.value } : null
                        );
                      }}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: active ? `2px solid ${opt.color}` : '1px solid rgba(255,255,255,0.16)',
                        background: active ? opt.bg : 'rgba(255,255,255,0.04)',
                        color: active ? opt.color : '#cbd5e1',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => handleExportDemandPdf(inspectingDemand)}
                  className="nexus-btn nexus-btn-primary"
                  style={{ padding: '7px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={14} />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingDemand(null)}
                  className="nexus-btn nexus-btn-ghost"
                  style={{ padding: '7px 10px' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <DemandFormSheet
              type={inspectingDemand.type}
              formData={
                inspectingDemand.formData ||
                (inspectingDemand.type === 'PAYMENT'
                  ? {
                      ...createDefaultPaymentDemandForm({
                        branchSite: inspectingDemand.branchName || '',
                        siteSupervisor: inspectingDemand.requestedBy || '',
                      }),
                      netAmountDemanded: String(inspectingDemand.amount || ''),
                      purposeJustification: inspectingDemand.description || '',
                    }
                  : {
                      ...createDefaultMaterialDemandForm({
                        branchSite: inspectingDemand.branchName || '',
                        siteSupervisor: inspectingDemand.requestedBy || '',
                      }),
                      purpose: inspectingDemand.description || '',
                    })
              }
              readOnly={true}
            />
          </div>
        </div>
      )}

      {/* ── MODAL TO INSPECT A PROJECT'S 9-PAGE PROGRESS SHEET ── */}
      {inspectingProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(2, 6, 23, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setInspectingProject(null)}
        >
          <div
            className="glass-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 960,
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: '24px',
              background: '#0f172a',
              border: '1px solid rgba(52, 211, 153, 0.4)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#f8fafc' }}>
                  {inspectingProject.branchName} — Progress Sheet &amp; Expense Breakdown
                </h3>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  Supervisor: <strong>{inspectingProject.siteSupervisor || 'N/A'}</strong> · Date:{' '}
                  <strong>{inspectingProject.reportDate || 'N/A'}</strong> · Overall Progress:{' '}
                  <strong style={{ color: '#34d399' }}>
                    {inspectingProject.overallProgressPercent || 0}%
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleExportSiteProgressPdf(inspectingProject)}
                  className="nexus-btn nexus-btn-primary"
                  style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={14} />
                  <span>Download 9-Page Progress PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportSiteExpensePdf(inspectingProject)}
                  className="nexus-btn nexus-btn-ghost"
                  style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={14} />
                  <span>Expense PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingProject(null)}
                  className="nexus-btn nexus-btn-ghost"
                  style={{ padding: '8px 10px' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* 9 Progress Sections Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {normalizeProgressSections(inspectingProject.progressSections).map((sec) => (
                <div
                  key={sec.id}
                  style={{
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#117a7a',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: 13,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>
                      {sec.sectionCode}. {sec.title}
                    </span>
                    {sec.overallSectionProgress !== '' && (
                      <span>Section Progress: {sec.overallSectionProgress}%</span>
                    )}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 55 }}>Sr#</th>
                          <th>Work Description</th>
                          <th style={{ width: 70 }}>Unit</th>
                          <th style={{ width: 95 }}>Progress</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sec.items || [])
                          .filter((it) => !it.isCustom || it.name || it.workPercent || it.remark)
                          .map((it, idx) => (
                            <tr key={idx}>
                              <td>{it.code || 'Other'}</td>
                              <td>{it.name || '—'}</td>
                              <td>{it.unit || '—'}</td>
                              <td style={{ fontWeight: 700, color: '#34d399' }}>
                                {it.workPercent !== '' && it.workPercent !== undefined
                                  ? `${it.workPercent}%`
                                  : '—'}
                              </td>
                              <td>{it.remark || '—'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
