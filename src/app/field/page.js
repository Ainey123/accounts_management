"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  HardHat,
  FolderKanban,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  Package,
  Users,
  Plus,
  Trash2,
  Save,
  Send,
  Download,
  RefreshCw,
  LogOut,
  ChevronRight,
  Upload,
  FileText,
  X,
  Edit3,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { apiFetch } from '@/lib/api';
import {
  FES_PROJECT_SITES,
  PROJECT_STATUS_OPTIONS,
  DEMAND_TYPE_OPTIONS,
  DEMAND_STATUS_OPTIONS,
  cloneFreshProgressTemplate,
  normalizeProgressSections,
} from '@/lib/projectReportTemplates';
import {
  downloadProgressReportPdf,
  downloadExpenseReportPdf,
} from '@/lib/projectPdfGenerator';
import { buildExpenseSectionsFromEntries } from '@/lib/projectReportTemplates';

export default function FieldPortalPage() {
  const { user, logout } = useAuth();

  // Navigation flow:
  // 'home' -> Only "Project" option shown upon login
  // 'select-project' -> Options: Manawala, Kanjwahl, Muradshah, Tordywala, Other
  // 'dashboard' -> Cards (Project Status, Project Expense, Material Expense, Labour Expense) + Editable FES Progress Sheet
  const [portalStep, setPortalStep] = useState('home');
  const [projectsMap, setProjectsMap] = useState({});
  const [otherProjectsList, setOtherProjectsList] = useState([]);
  const [selectedProjectKey, setSelectedProjectKey] = useState(null);
  const [showOtherPrompt, setShowOtherPrompt] = useState(false);
  const [customOtherName, setCustomOtherName] = useState('');

  // Loading & feedback states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [banner, setBanner] = useState({ type: '', text: '' });

  // Active Project Dashboard Editable State
  const [jobMetadataId, setJobMetadataId] = useState(null);
  const [branchSite, setBranchSite] = useState('');
  const [projectStatus, setProjectStatus] = useState('IN_PROGRESS');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [siteSupervisor, setSiteSupervisor] = useState('');
  const [targetCompletion, setTargetCompletion] = useState('');
  const [paidBy, setPaidBy] = useState('FES');
  const [progressSections, setProgressSections] = useState(() => cloneFreshProgressTemplate());
  const [expenseEntries, setExpenseEntries] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [reportStatus, setReportStatus] = useState(null);
  const [reviewerNotes, setReviewerNotes] = useState(null);
  const [demandsList, setDemandsList] = useState([]);

  // Dashboard UI controls
  const [activePageFilter, setActivePageFilter] = useState('ALL'); // 'ALL' or 0..8
  const [expensePanelOpen, setExpensePanelOpen] = useState(false);
  const [demandsPanelOpen, setDemandsPanelOpen] = useState(false);
  const [activeDemandType, setActiveDemandType] = useState('MATERIAL'); // 'MATERIAL' | 'PAYMENT'
  const [demandAmount, setDemandAmount] = useState('');
  const [demandDescription, setDemandDescription] = useState('');
  const [submittingDemand, setSubmittingDemand] = useState(false);
  const [newExpenseForm, setNewExpenseForm] = useState({
    type: 'MATERIAL',
    name: '',
    qty: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paidBy: 'FES',
    remarks: '',
    receiptUrl: '',
  });

  const receiptInputRef = useRef(null);
  const demandsSectionRef = useRef(null);
  const demandAmountInputRef = useRef(null);

  const fetchProjectsData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch('/api/field-projects');
      const map = {};
      (res.projects || []).forEach((p) => {
        map[p.key] = p;
      });
      setProjectsMap(map);
      setOtherProjectsList(res.otherProjects || []);
      return { map, otherList: res.otherProjects || [] };
    } catch (err) {
      console.error('Failed to load field projects:', err);
      // Fallback offline map so UI never blocks
      const fallback = {};
      FES_PROJECT_SITES.forEach((site) => {
        fallback[site.key] = {
          key: site.key,
          label: site.label,
          branchName: site.branchName,
          jobMetadataId: null,
          projectStatus: 'NOT_STARTED',
          overallProgressPercent: 0,
          projectExpense: 0,
          materialExpense: 0,
          labourExpense: 0,
          expenseEntries: [],
          progressSections: cloneFreshProgressTemplate(),
          reportDate: new Date().toISOString().split('T')[0],
          siteSupervisor: user?.employeeName || '',
          targetCompletion: '',
          paidBy: 'FES',
          attachments: [],
        };
      });
      setProjectsMap((prev) => (Object.keys(prev).length > 0 ? prev : fallback));
      return { map: fallback, otherList: [] };
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectsData();
  }, []);

  const hydrateProjectIntoWorkspace = (projData, overrideBranch = '') => {
    const cleanBranch = overrideBranch || projData?.branchName || 'Project Site';
    setJobMetadataId(projData?.jobMetadataId || null);
    setBranchSite(cleanBranch);
    setProjectStatus(projData?.projectStatus || 'IN_PROGRESS');
    setReportDate(projData?.reportDate || new Date().toISOString().split('T')[0]);
    setSiteSupervisor(projData?.siteSupervisor || user?.employeeName || '');
    setTargetCompletion(projData?.targetCompletion || '');
    setPaidBy(projData?.paidBy || 'FES');
    setProgressSections(normalizeProgressSections(projData?.progressSections));
    setExpenseEntries(Array.isArray(projData?.expenseEntries) ? projData.expenseEntries : []);
    setAttachments(Array.isArray(projData?.attachments) ? projData.attachments : []);
    setDemandsList(Array.isArray(projData?.demands) ? projData.demands : []);
    setReportStatus(projData?.reportStatus || null);
    setReviewerNotes(projData?.reviewerNotes || null);
    setActivePageFilter('ALL');
    setExpensePanelOpen(false);
    setDemandsPanelOpen(false);
    setActiveDemandType('MATERIAL');
    setDemandAmount('');
    setDemandDescription('');
    setBanner({ type: '', text: '' });
  };

  const handleSelectProject = (siteKey, customSiteProject = null) => {
    if (siteKey === 'other' && !customSiteProject) {
      setShowOtherPrompt(true);
      const existingOther = projectsMap.other;
      setCustomOtherName(
        existingOther?.branchName && existingOther.branchName !== 'Other'
          ? existingOther.branchName
          : ''
      );
      return;
    }

    setShowOtherPrompt(false);
    setSelectedProjectKey(siteKey);

    if (customSiteProject) {
      hydrateProjectIntoWorkspace(customSiteProject, customSiteProject.branchName);
    } else {
      const found = projectsMap[siteKey];
      const siteDef = FES_PROJECT_SITES.find((s) => s.key === siteKey);
      if (found) {
        hydrateProjectIntoWorkspace(found);
      } else {
        hydrateProjectIntoWorkspace(
          {
            branchName: siteDef?.branchName || siteKey,
            projectStatus: 'NOT_STARTED',
            progressSections: cloneFreshProgressTemplate(),
            expenseEntries: [],
          },
          siteDef?.branchName || siteKey
        );
      }
    }

    setPortalStep('dashboard');
  };

  const handleOpenOtherProject = (existingOtherProj = null) => {
    if (existingOtherProj) {
      setSelectedProjectKey('other');
      setShowOtherPrompt(false);
      hydrateProjectIntoWorkspace(existingOtherProj, existingOtherProj.branchName);
      setPortalStep('dashboard');
      return;
    }

    const desiredName = customOtherName.trim() || 'Other';
    const matchedSaved = otherProjectsList.find(
      (p) => (p.branchName || '').trim().toLowerCase() === desiredName.toLowerCase()
    );

    setSelectedProjectKey('other');
    setShowOtherPrompt(false);

    if (matchedSaved) {
      hydrateProjectIntoWorkspace(matchedSaved, matchedSaved.branchName);
    } else {
      hydrateProjectIntoWorkspace(
        {
          jobMetadataId: null,
          branchName: desiredName,
          projectStatus: 'NOT_STARTED',
          progressSections: cloneFreshProgressTemplate(),
          expenseEntries: [],
          siteSupervisor: user?.employeeName || '',
        },
        desiredName
      );
    }

    setPortalStep('dashboard');
  };

  // Live Computed Metrics for the 4 Dashboard Cards
  const liveTotals = useMemo(() => {
    let material = 0;
    let labour = 0;
    let other = 0;
    let matCount = 0;
    let labCount = 0;

    expenseEntries.forEach((entry) => {
      const amt = parseFloat(entry.amount) || 0;
      if (amt <= 0) return;
      if (entry.type === 'LABOUR') {
        labour += amt;
        labCount++;
      } else if (entry.type === 'MATERIAL') {
        material += amt;
        matCount++;
      } else {
        other += amt;
      }
    });

    let pctSum = 0;
    let pctCount = 0;
    progressSections.forEach((sec) => {
      (sec.items || []).forEach((it) => {
        const val = parseFloat(it.workPercent);
        if (!isNaN(val)) {
          pctSum += val;
          pctCount++;
        }
      });
    });

    const overallProgress = pctCount > 0 ? Math.round(pctSum / pctCount) : 0;

    return {
      materialExpense: material,
      labourExpense: labour,
      otherExpense: other,
      projectExpense: material + labour + other,
      materialCount: matCount,
      labourCount: labCount,
      overallProgress,
    };
  }, [expenseEntries, progressSections]);

  // Persist helper (saves status, expenses, and progress sheet to DB)
  const saveProjectWorkspace = async ({
    submitAction = 'DRAFT',
    overrideStatus,
    overrideEntries,
    successText,
  } = {}) => {
    const isSubmit = submitAction === 'SUBMIT';
    if (isSubmit) setSubmitting(true);
    else setSaving(true);
    setBanner({ type: '', text: '' });

    const statusToSave = overrideStatus || projectStatus;
    const entriesToSave = overrideEntries || expenseEntries;

    try {
      const res = await apiFetch('/api/field-projects', {
        method: 'POST',
        body: JSON.stringify({
          projectKey: selectedProjectKey || 'manawala',
          jobMetadataId,
          branchName: branchSite.trim() || 'Project Site',
          projectStatus: statusToSave,
          reportDate,
          siteSupervisor: siteSupervisor || user?.employeeName || '',
          targetCompletion,
          progressSections,
          expenseEntries: entriesToSave,
          paidBy,
          attachments,
          submitAction,
        }),
      });

      if (res.project) {
        setJobMetadataId(res.project.jobMetadataId);
        setReportStatus(res.project.reportStatus);
        if (Array.isArray(res.project.demands)) {
          setDemandsList(res.project.demands);
        }
        setProjectsMap((prev) => ({
          ...prev,
          [selectedProjectKey || 'manawala']: res.project,
        }));
      }

      await fetchProjectsData(true);

      setBanner({
        type: 'success',
        text:
          successText ||
          (isSubmit
            ? `Progress sheet & expenses for "${branchSite}" submitted successfully!`
            : `Changes saved for "${branchSite}".`),
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: 'Failed to save: ' + (err.message || 'Network error'),
      });
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  // Status Card Change
  const handleStatusChange = async (nextStatus) => {
    setProjectStatus(nextStatus);
    await saveProjectWorkspace({
      submitAction: 'STATUS_UPDATE',
      overrideStatus: nextStatus,
      successText: `Project status updated to "${
        PROJECT_STATUS_OPTIONS.find((o) => o.value === nextStatus)?.label || nextStatus
      }".`,
    });
  };

  // Expense Handlers
  const openExpenseAdder = (defaultType = 'MATERIAL') => {
    setNewExpenseForm((prev) => ({
      ...prev,
      type: defaultType,
    }));
    setExpensePanelOpen(true);
  };

  const handleReceiptUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setNewExpenseForm((prev) => ({ ...prev, receiptUrl: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddExpenseEntry = async (e) => {
    e.preventDefault();
    const amt = parseFloat(newExpenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setBanner({ type: 'error', text: 'Please enter a valid expense amount greater than 0.' });
      return;
    }

    const newItem = {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: newExpenseForm.type, // 'MATERIAL' | 'LABOUR'
      name:
        newExpenseForm.name.trim() ||
        (newExpenseForm.type === 'LABOUR' ? 'Site Labour Work' : 'Site Material Purchase'),
      qty: newExpenseForm.qty.trim(),
      amount: amt,
      date: newExpenseForm.date || reportDate,
      paidBy: newExpenseForm.paidBy || 'FES',
      remarks: newExpenseForm.remarks.trim(),
      receiptUrl: newExpenseForm.receiptUrl || '',
    };

    const updatedEntries = [newItem, ...expenseEntries];
    setExpenseEntries(updatedEntries);
    setNewExpenseForm({
      type: newExpenseForm.type,
      name: '',
      qty: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paidBy: newExpenseForm.paidBy || 'FES',
      remarks: '',
      receiptUrl: '',
    });

    await saveProjectWorkspace({
      submitAction: 'EXPENSE_UPDATE',
      overrideEntries: updatedEntries,
      successText: `${
        newItem.type === 'LABOUR' ? 'Labour' : 'Material'
      } expense of Rs. ${amt.toLocaleString()} added & saved!`,
    });
  };

  const handleUpdateExpenseEntry = (id, field, value) => {
    setExpenseEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteExpenseEntry = async (id) => {
    const updated = expenseEntries.filter((item) => item.id !== id);
    setExpenseEntries(updated);
    await saveProjectWorkspace({
      submitAction: 'EXPENSE_UPDATE',
      overrideEntries: updated,
      successText: 'Expense entry removed and totals updated.',
    });
  };

  // Demands Feature Handlers (Material Demand & Payment Demand)
  const handleOpenDemandsSection = () => {
    setDemandsPanelOpen(true);
    setTimeout(() => {
      demandsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleSelectDemandOption = (type) => {
    setActiveDemandType(type);
    setTimeout(() => {
      demandAmountInputRef.current?.focus();
    }, 50);
  };

  const handleSubmitDemand = async (e) => {
    e.preventDefault();
    const amt = parseFloat(demandAmount);
    if (isNaN(amt) || amt <= 0) {
      setBanner({ type: 'error', text: 'Please enter a valid demand amount greater than 0.' });
      return;
    }

    setSubmittingDemand(true);
    setBanner({ type: '', text: '' });
    try {
      const res = await apiFetch('/api/field-projects', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'CREATE_DEMAND',
          projectKey: selectedProjectKey || 'manawala',
          jobMetadataId,
          branchName: branchSite.trim() || 'Project Site',
          demandType: activeDemandType,
          amount: amt,
          description: demandDescription.trim(),
          siteSupervisor: siteSupervisor || user?.employeeName || '',
        }),
      });

      if (res.project) {
        setJobMetadataId(res.project.jobMetadataId);
        setDemandsList(Array.isArray(res.project.demands) ? res.project.demands : []);
        setProjectsMap((prev) => ({
          ...prev,
          [selectedProjectKey || 'manawala']: res.project,
        }));
      } else if (res.demand) {
        setDemandsList((prev) => [res.demand, ...prev]);
      }

      setDemandAmount('');
      setDemandDescription('');
      await fetchProjectsData(true);

      setBanner({
        type: 'success',
        text: `${
          activeDemandType === 'PAYMENT' ? 'Payment Demand' : 'Material Demand'
        } of Rs. ${amt.toLocaleString()} submitted! Current status: Hold (awaiting Admin review).`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: 'Failed to submit demand: ' + (err.message || 'Network error'),
      });
    } finally {
      setSubmittingDemand(false);
    }
  };

  const handleRefreshDemands = async () => {
    const { map, otherList } = await fetchProjectsData(true);
    if (selectedProjectKey === 'other' && jobMetadataId) {
      const matchedOther = otherList.find((p) => Number(p.jobMetadataId) === Number(jobMetadataId));
      if (matchedOther && Array.isArray(matchedOther.demands)) {
        setDemandsList(matchedOther.demands);
        return;
      }
    }
    const latest = map[selectedProjectKey || 'manawala'];
    if (latest && Array.isArray(latest.demands)) {
      setDemandsList(latest.demands);
    }
  };

  // Progress Sheet Edit Handlers
  const handleItemChange = (secIdx, itemIdx, field, value) => {
    setProgressSections((prev) => {
      const next = [...prev];
      const sec = { ...next[secIdx] };
      const items = [...(sec.items || [])];
      items[itemIdx] = { ...items[itemIdx], [field]: value };
      sec.items = items;
      next[secIdx] = sec;
      return next;
    });
  };

  const handleSectionFooterChange = (secIdx, field, value) => {
    setProgressSections((prev) => {
      const next = [...prev];
      next[secIdx] = { ...next[secIdx], [field]: value };
      return next;
    });
  };

  const handleAddCustomWorkRow = (secIdx) => {
    setProgressSections((prev) => {
      const next = [...prev];
      const sec = { ...next[secIdx] };
      sec.items = [
        ...(sec.items || []),
        {
          code: '',
          name: '',
          unit: 'Job',
          workPercent: '',
          remark: '',
          others: '',
          isCustom: true,
        },
      ];
      next[secIdx] = sec;
      return next;
    });
  };

  // PDF Exports
  const handleExportProgressPdf = async () => {
    setDownloadingPdf(true);
    try {
      const enriched = normalizeProgressSections(progressSections);
      if (enriched.length > 0) {
        enriched[0].sheetMeta = {
          branchSite: branchSite || 'Project Site',
          reportDate,
          siteSupervisor: siteSupervisor || user?.employeeName || '',
          targetCompletion,
          projectStatus,
        };
      }
      await downloadProgressReportPdf({
        job: { branchName: branchSite || 'Project Site', id: jobMetadataId },
        reportDate,
        sections: enriched,
        overallProgressPercent: liveTotals.overallProgress,
        employeeName: user?.employeeName,
        siteSupervisor: siteSupervisor || user?.employeeName || '',
        targetCompletion,
      });
    } catch (err) {
      setBanner({ type: 'error', text: 'PDF export failed: ' + err.message });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleExportExpensePdf = async () => {
    setDownloadingPdf(true);
    try {
      const sections = buildExpenseSectionsFromEntries(expenseEntries);
      await downloadExpenseReportPdf({
        job: { branchName: branchSite || 'Project Site', id: jobMetadataId },
        reportDate,
        sections,
        totalExpenseAmount: liveTotals.projectExpense,
        materialExpense: liveTotals.materialExpense,
        labourExpense: liveTotals.labourExpense,
        paidBy,
        employeeName: siteSupervisor || user?.employeeName || '',
      });
    } catch (err) {
      setBanner({ type: 'error', text: 'Expense PDF export failed: ' + err.message });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getStatusMeta = (statusVal) => {
    return (
      PROJECT_STATUS_OPTIONS.find((s) => s.value === statusVal) || PROJECT_STATUS_OPTIONS[0]
    );
  };

  const currentStatusMeta = getStatusMeta(projectStatus);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#0b0f19',
        color: '#f8fafc',
        flexDirection: 'column',
      }}
    >
      {/* ── TOP PORTAL BAR (ONLY PROJECT OPTION + LOGOUT) ── */}
      <header
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Brand + FES Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#ffffff',
              padding: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
            }}
          >
            <img
              src="/fes-logo-cropped.png"
              alt="FES Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.4, color: '#f8fafc' }}>
              FAST ENGINEERING SOLUTIONS
            </div>
            <div style={{ fontSize: 11, color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
              Field Employee Portal · {user?.employeeName || 'Field Supervisor'}
            </div>
          </div>
        </div>

        {/* Single Navigation Option: PROJECT (+ Logout) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              setShowOtherPrompt(false);
              setPortalStep('select-project');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 10,
              border:
                portalStep !== 'home'
                  ? '1px solid rgba(52, 211, 153, 0.6)'
                  : '1px solid rgba(255,255,255,0.14)',
              background:
                portalStep !== 'home'
                  ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                  : 'rgba(16, 185, 129, 0.14)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: portalStep !== 'home' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
            }}
          >
            <FolderKanban size={16} />
            <span>Project</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="nexus-btn nexus-btn-ghost"
            style={{
              padding: '9px 14px',
              fontSize: 12,
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* ── MAIN PORTAL CONTENT ── */}
      <div style={{ flex: 1, maxWidth: 1180, width: '100%', margin: '0 auto', padding: '24px 16px 80px 16px' }}>
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 1: INITIAL PORTAL SCREEN — ONLY "PROJECT" OPTION             */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {portalStep === 'home' && (
          <div
            style={{
              maxWidth: 560,
              margin: '48px auto',
              textAlign: 'center',
            }}
          >
            <div
              className="glass-card"
              style={{
                padding: '40px 32px',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                background: 'rgba(15, 23, 42, 0.8)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
              }}
            >
              <div
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: 18,
                  background: '#ffffff',
                  padding: 6,
                  margin: '0 auto 18px auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                }}
              >
                <img
                  src="/fes-logo-cropped.png"
                  alt="FES"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', margin: '0 0 6px 0' }}>
                Welcome, {user?.employeeName || 'Field Supervisor'}
              </h1>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 28px 0' }}>
                Fast Engineering Solutions — Construction Site Monitoring &amp; Progress Portal
              </p>

              {/* THE ONLY OPTION: PROJECT */}
              <button
                type="button"
                onClick={() => setPortalStep('select-project')}
                style={{
                  width: '100%',
                  padding: '22px 24px',
                  borderRadius: 14,
                  border: '1px solid rgba(52, 211, 153, 0.5)',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 10px 28px rgba(16, 185, 129, 0.35)',
                  transition: 'transform 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FolderKanban size={26} color="#ffffff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.3 }}>
                      Project
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.88)', marginTop: 2 }}>
                      Click to select site project &amp; open dashboard
                    </div>
                  </div>
                </div>
                <ChevronRight size={24} color="#ffffff" />
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 2: SELECT ONE PROJECT (Manawala, Kanjwahl, Muradshah, etc.)  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {portalStep === 'select-project' && (
          <div style={{ maxWidth: 920, margin: '12px auto' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f8fafc' }}>
                  Select Project
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#94a3b8' }}>
                  Choose your construction site / branch project to open its dashboard &amp; progress sheet
                </p>
              </div>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={() => fetchProjectsData()}
                style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {/* 5 Project Selection Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(255px, 1fr))',
                gap: 16,
              }}
            >
              {FES_PROJECT_SITES.map((site) => {
                const pData = projectsMap[site.key];
                const stMeta = getStatusMeta(pData?.projectStatus || 'NOT_STARTED');
                const pct = pData?.overallProgressPercent || 0;
                const exp = pData?.projectExpense || 0;

                return (
                  <button
                    key={site.key}
                    type="button"
                    onClick={() => handleSelectProject(site.key)}
                    className="glass-card"
                    style={{
                      padding: '22px 20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      border:
                        site.key === 'other' && showOtherPrompt
                          ? '2px solid #34d399'
                          : '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(15, 23, 42, 0.82)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 16,
                      transition: 'transform 0.15s, border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <HardHat size={22} color="#34d399" />
                        </div>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>
                            {site.label}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            {site.subtitle}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={20} color="#34d399" />
                    </div>

                    <div
                      style={{
                        width: '100%',
                        paddingTop: 12,
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                      }}
                    >
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: 6,
                          background: stMeta.bg,
                          color: stMeta.color,
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        {stMeta.label} ({pct}%)
                      </span>
                      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                        Rs. {exp.toLocaleString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Inline Prompt when "Other" is clicked */}
            {showOtherPrompt && (
              <div
                className="glass-card"
                style={{
                  marginTop: 20,
                  padding: 22,
                  border: '1px solid rgba(52, 211, 153, 0.45)',
                  background: 'rgba(16, 185, 129, 0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                    Other Project — Enter Site / Branch Name
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowOtherPrompt(false)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    className="nexus-input"
                    placeholder="Enter custom site / branch name (or leave blank for 'Other')..."
                    value={customOtherName}
                    onChange={(e) => setCustomOtherName(e.target.value)}
                    style={{ flex: 1, minWidth: 240 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleOpenOtherProject(null)}
                    className="nexus-btn"
                    style={{
                      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      border: 'none',
                      padding: '10px 20px',
                      cursor: 'pointer',
                    }}
                  >
                    Open Dashboard
                  </button>
                </div>

                {otherProjectsList.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>
                      Previously Saved Other Projects:
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {otherProjectsList.map((op) => (
                        <button
                          key={op.jobMetadataId || op.branchName}
                          type="button"
                          onClick={() => handleOpenOtherProject(op)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            background: 'rgba(56, 189, 248, 0.1)',
                            color: '#38bdf8',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {op.branchName} ({op.overallProgressPercent}%)
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 3: SELECTED PROJECT DASHBOARD + OFFICIAL FES PROGRESS SHEET  */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {portalStep === 'dashboard' && (
          <div>
            {/* Top Project Bar & Quick Switcher */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setPortalStep('select-project')}
                  className="nexus-btn nexus-btn-ghost"
                  style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <ArrowLeft size={15} />
                  <span>Projects</span>
                </button>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f8fafc' }}>
                      {branchSite || 'Project'} — Dashboard
                    </h2>
                    {reportStatus && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontWeight: 700,
                          background:
                            reportStatus === 'APPROVED'
                              ? 'rgba(52, 211, 153, 0.2)'
                              : reportStatus === 'CORRECTION_REQUIRED'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(56, 189, 248, 0.2)',
                          color:
                            reportStatus === 'APPROVED'
                              ? '#34d399'
                              : reportStatus === 'CORRECTION_REQUIRED'
                              ? '#f87171'
                              : '#38bdf8',
                        }}
                      >
                        {reportStatus}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    Project Status, Expense Summary Cards, Editable Progress Sheet &amp; Demands
                  </div>
                </div>
              </div>

              {/* Project Switcher Dropdown + Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <select
                  className="nexus-select"
                  value={selectedProjectKey || 'manawala'}
                  onChange={(e) => handleSelectProject(e.target.value)}
                  style={{ fontSize: 12, padding: '8px 12px', minWidth: 150, fontWeight: 700 }}
                >
                  {FES_PROJECT_SITES.map((s) => (
                    <option key={s.key} value={s.key}>
                      Project: {s.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => openExpenseAdder('MATERIAL')}
                  className="nexus-btn"
                  style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#38bdf8',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={14} />
                  <span>Add Expense</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenDemandsSection}
                  className="nexus-btn"
                  style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    background: 'rgba(251, 191, 36, 0.16)',
                    border: '1px solid rgba(251, 191, 36, 0.45)',
                    color: '#fbbf24',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <DollarSign size={14} />
                  <span>Demands ({demandsList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportProgressPdf}
                  disabled={downloadingPdf}
                  className="nexus-btn nexus-btn-ghost"
                  style={{ padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={14} />
                  <span>{downloadingPdf ? 'Exporting...' : 'Progress PDF'}</span>
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {banner.text && (
              <div
                style={{
                  marginBottom: 18,
                  padding: '12px 16px',
                  borderRadius: 10,
                  fontSize: 13,
                  background:
                    banner.type === 'error'
                      ? 'rgba(239, 68, 68, 0.16)'
                      : 'rgba(16, 185, 129, 0.16)',
                  color: banner.type === 'error' ? '#fca5a5' : '#6ee7b7',
                  border: `1px solid ${
                    banner.type === 'error'
                      ? 'rgba(239, 68, 68, 0.35)'
                      : 'rgba(16, 185, 129, 0.35)'
                  }`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{banner.text}</span>
                <button
                  type="button"
                  onClick={() => setBanner({ type: '', text: '' })}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Reviewer Feedback Banner if Office Requested Correction */}
            {reportStatus === 'CORRECTION_REQUIRED' && reviewerNotes && (
              <div
                style={{
                  marginBottom: 18,
                  padding: '14px 16px',
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.14)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#fca5a5',
                  fontSize: 13,
                }}
              >
                <strong style={{ color: '#f87171' }}>Correction Requested by Office: </strong>
                {reviewerNotes}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* THE 4 DASHBOARD SUMMARY CARDS                                  */}
            {/* 1. Project Status | 2. Project Expense | 3. Material | 4. Labour */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 16,
                marginBottom: 24,
              }}
            >
              {/* CARD 1: PROJECT STATUS */}
              <div
                className="glass-card"
                style={{
                  padding: '20px',
                  border: `1px solid ${currentStatusMeta.color}44`,
                  background: 'rgba(15, 23, 42, 0.85)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8' }}>
                    Project Status
                  </span>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: currentStatusMeta.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {projectStatus === 'COMPLETED' ? (
                      <CheckCircle2 size={18} color={currentStatusMeta.color} />
                    ) : projectStatus === 'ON_HOLD' ? (
                      <AlertTriangle size={18} color={currentStatusMeta.color} />
                    ) : (
                      <Clock size={18} color={currentStatusMeta.color} />
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: currentStatusMeta.color }}>
                      {currentStatusMeta.label}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
                      {liveTotals.overallProgress}%
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div
                    style={{
                      width: '100%',
                      height: 7,
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 999,
                      overflow: 'hidden',
                      marginTop: 8,
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, liveTotals.overallProgress))}%`,
                        height: '100%',
                        background: currentStatusMeta.color,
                        borderRadius: 999,
                        transition: 'width 0.25s ease',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <select
                    className="nexus-select"
                    value={projectStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    style={{ width: '100%', fontSize: 12, padding: '6px 10px', height: 32 }}
                  >
                    {PROJECT_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        Status: {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CARD 2: PROJECT EXPENSE */}
              <div
                className="glass-card"
                style={{
                  padding: '20px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  background: 'rgba(15, 23, 42, 0.85)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8' }}>
                    Project Expense
                  </span>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: 'rgba(56, 189, 248, 0.16)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <DollarSign size={18} color="#38bdf8" />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc' }}>
                    Rs. {liveTotals.projectExpense.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    Total Material + Labour Cost ({expenseEntries.length} entries)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setExpensePanelOpen(!expensePanelOpen)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: 7,
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      background: 'rgba(56, 189, 248, 0.12)',
                      color: '#38bdf8',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {expensePanelOpen ? 'Hide Breakdown' : 'Manage Expenses'}
                  </button>
                  {expenseEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportExpensePdf}
                      disabled={downloadingPdf}
                      title="Download Expense PDF"
                      style={{
                        padding: '6px 10px',
                        borderRadius: 7,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#cbd5e1',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <Download size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* CARD 3: MATERIAL EXPENSE */}
              <div
                className="glass-card"
                style={{
                  padding: '20px',
                  border: '1px solid rgba(167, 139, 250, 0.3)',
                  background: 'rgba(15, 23, 42, 0.85)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8' }}>
                    Material Expense
                  </span>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: 'rgba(167, 139, 250, 0.16)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Package size={18} color="#a78bfa" />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#c4b5fd' }}>
                    Rs. {liveTotals.materialExpense.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    {liveTotals.materialCount} material purchase {liveTotals.materialCount === 1 ? 'entry' : 'entries'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openExpenseAdder('MATERIAL')}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 7,
                    border: '1px solid rgba(167, 139, 250, 0.35)',
                    background: 'rgba(167, 139, 250, 0.12)',
                    color: '#c4b5fd',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Add / Edit Material Expense
                </button>
              </div>

              {/* CARD 4: LABOUR EXPENSE */}
              <div
                className="glass-card"
                style={{
                  padding: '20px',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  background: 'rgba(15, 23, 42, 0.85)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8' }}>
                    Labour Expense
                  </span>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: 'rgba(52, 211, 153, 0.16)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Users size={18} color="#34d399" />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#6ee7b7' }}>
                    Rs. {liveTotals.labourExpense.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    {liveTotals.labourCount} labour wage {liveTotals.labourCount === 1 ? 'entry' : 'entries'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openExpenseAdder('LABOUR')}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 7,
                    border: '1px solid rgba(52, 211, 153, 0.35)',
                    background: 'rgba(52, 211, 153, 0.12)',
                    color: '#6ee7b7',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Add / Edit Labour Expense
                </button>
              </div>
            </div>

            {/* ── COLLAPSIBLE EXPENSE MANAGER PANEL (Material & Labour) ── */}
            {expensePanelOpen && (
              <div
                className="glass-card"
                style={{
                  marginBottom: 26,
                  padding: 20,
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  background: 'rgba(15, 23, 42, 0.92)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                      Log &amp; Edit Project Expenses ({branchSite})
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#94a3b8' }}>
                      Add Material Expense or Labour Expense items below — cards update automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpensePanelOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <form
                  onSubmit={handleAddExpenseEntry}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 10,
                    padding: 14,
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 10,
                    marginBottom: 16,
                    alignItems: 'end',
                  }}
                >
                  <div>
                    <label className="field-label" style={{ fontSize: 11 }}>Expense Type</label>
                    <select
                      className="nexus-select"
                      value={newExpenseForm.type}
                      onChange={(e) => setNewExpenseForm((p) => ({ ...p, type: e.target.value }))}
                      style={{ fontSize: 12, height: 36 }}
                    >
                      <option value="MATERIAL">Material Expense</option>
                      <option value="LABOUR">Labour Expense</option>
                    </select>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="field-label" style={{ fontSize: 11 }}>Description / Item</label>
                    <input
                      className="nexus-input"
                      placeholder={
                        newExpenseForm.type === 'LABOUR'
                          ? 'e.g. Mason & helper daily wages'
                          : 'e.g. Cement bags, PPRC pipe, Cables'
                      }
                      value={newExpenseForm.name}
                      onChange={(e) => setNewExpenseForm((p) => ({ ...p, name: e.target.value }))}
                      style={{ fontSize: 12, height: 36 }}
                      required
                    />
                  </div>

                  <div>
                    <label className="field-label" style={{ fontSize: 11 }}>Qty / Days</label>
                    <input
                      className="nexus-input"
                      placeholder="e.g. 10 bags / 3 days"
                      value={newExpenseForm.qty}
                      onChange={(e) => setNewExpenseForm((p) => ({ ...p, qty: e.target.value }))}
                      style={{ fontSize: 12, height: 36 }}
                    />
                  </div>

                  <div>
                    <label className="field-label" style={{ fontSize: 11 }}>Amount (Rs.)</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      className="nexus-input"
                      placeholder="0"
                      value={newExpenseForm.amount}
                      onChange={(e) => setNewExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                      style={{ fontSize: 12, height: 36, fontWeight: 700 }}
                      required
                    />
                  </div>

                  <div>
                    <label className="field-label" style={{ fontSize: 11 }}>Remarks</label>
                    <input
                      className="nexus-input"
                      placeholder="Optional note / bill #"
                      value={newExpenseForm.remarks}
                      onChange={(e) => setNewExpenseForm((p) => ({ ...p, remarks: e.target.value }))}
                      style={{ fontSize: 12, height: 36 }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      ref={receiptInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => receiptInputRef.current?.click()}
                      title="Attach Bill Photo"
                      className="nexus-btn nexus-btn-ghost"
                      style={{
                        height: 36,
                        padding: '0 10px',
                        fontSize: 11,
                        borderColor: newExpenseForm.receiptUrl ? '#34d399' : undefined,
                        color: newExpenseForm.receiptUrl ? '#34d399' : '#cbd5e1',
                      }}
                    >
                      <Upload size={14} />
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="nexus-btn"
                      style={{
                        flex: 1,
                        height: 36,
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      + Save
                    </button>
                  </div>
                </form>

                {/* Logged Expense Items List */}
                {expenseEntries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', fontSize: 12, color: '#64748b' }}>
                    No Material or Labour expenses recorded for {branchSite} yet.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textAlign: 'left' }}>
                          <th style={{ padding: '8px 6px' }}>Category</th>
                          <th style={{ padding: '8px 6px' }}>Description</th>
                          <th style={{ padding: '8px 6px', width: 100 }}>Qty</th>
                          <th style={{ padding: '8px 6px', width: 130 }}>Amount (Rs.)</th>
                          <th style={{ padding: '8px 6px' }}>Remarks</th>
                          <th style={{ padding: '8px 6px', width: 50 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseEntries.map((item) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '6px' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 5,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background:
                                    item.type === 'LABOUR'
                                      ? 'rgba(52, 211, 153, 0.16)'
                                      : 'rgba(167, 139, 250, 0.16)',
                                  color: item.type === 'LABOUR' ? '#6ee7b7' : '#c4b5fd',
                                }}
                              >
                                {item.type === 'LABOUR' ? 'LABOUR' : 'MATERIAL'}
                              </span>
                            </td>
                            <td style={{ padding: '6px' }}>
                              {item.fromStandaloneExpense ? (
                                <span style={{ color: '#cbd5e1' }}>{item.name}</span>
                              ) : (
                                <input
                                  className="nexus-input"
                                  style={{ height: 28, fontSize: 12, padding: '2px 8px' }}
                                  value={item.name}
                                  onChange={(e) => handleUpdateExpenseEntry(item.id, 'name', e.target.value)}
                                />
                              )}
                            </td>
                            <td style={{ padding: '6px' }}>
                              {item.fromStandaloneExpense ? (
                                <span style={{ color: '#94a3b8' }}>{item.qty || '—'}</span>
                              ) : (
                                <input
                                  className="nexus-input"
                                  style={{ height: 28, fontSize: 12, padding: '2px 8px' }}
                                  value={item.qty || ''}
                                  onChange={(e) => handleUpdateExpenseEntry(item.id, 'qty', e.target.value)}
                                />
                              )}
                            </td>
                            <td style={{ padding: '6px' }}>
                              {item.fromStandaloneExpense ? (
                                <strong style={{ color: '#38bdf8' }}>Rs. {Number(item.amount).toLocaleString()}</strong>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  className="nexus-input"
                                  style={{ height: 28, fontSize: 12, padding: '2px 8px', fontWeight: 700, color: '#38bdf8' }}
                                  value={item.amount}
                                  onChange={(e) => handleUpdateExpenseEntry(item.id, 'amount', e.target.value)}
                                />
                              )}
                            </td>
                            <td style={{ padding: '6px' }}>
                              {item.fromStandaloneExpense ? (
                                <span style={{ color: '#94a3b8' }}>Office/Direct Log</span>
                              ) : (
                                <input
                                  className="nexus-input"
                                  style={{ height: 28, fontSize: 12, padding: '2px 8px' }}
                                  value={item.remarks || ''}
                                  onChange={(e) => handleUpdateExpenseEntry(item.id, 'remarks', e.target.value)}
                                />
                              )}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>
                              {!item.fromStandaloneExpense && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExpenseEntry(item.id)}
                                  style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                                  title="Delete entry"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          saveProjectWorkspace({
                            submitAction: 'EXPENSE_UPDATE',
                            successText: 'Updated expense entries saved!',
                          })
                        }
                        className="nexus-btn"
                        style={{
                          padding: '7px 16px',
                          fontSize: 12,
                          background: 'rgba(56, 189, 248, 0.2)',
                          border: '1px solid rgba(56, 189, 248, 0.45)',
                          color: '#38bdf8',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Save size={13} style={{ display: 'inline', marginRight: 5 }} />
                        Save Edited Expense Rows
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* OFFICIAL EDITABLE FES PROGRESS SHEET (EXACT 9-PAGE PDF MATCH)  */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <div style={{ marginTop: 8 }}>
              {/* Sheet Controls & Quick Section Tabs */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={18} color="#34d399" />
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                    Editable Site Progress Sheet (Pages 1–9)
                  </span>
                </div>

                {/* Page Filter Pills */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setActivePageFilter('ALL')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 7,
                      fontSize: 11,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: activePageFilter === 'ALL' ? '#117a7a' : 'rgba(255,255,255,0.08)',
                      color: activePageFilter === 'ALL' ? '#ffffff' : '#cbd5e1',
                    }}
                  >
                    All 9 Pages
                  </button>
                  {progressSections.map((sec, idx) => (
                    <button
                      key={sec.id || idx}
                      type="button"
                      onClick={() => setActivePageFilter(idx)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 7,
                        fontSize: 11,
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        background: activePageFilter === idx ? '#117a7a' : 'rgba(255,255,255,0.08)',
                        color: activePageFilter === idx ? '#ffffff' : '#cbd5e1',
                      }}
                    >
                      {sec.sectionCode || `0${idx + 1}`} {sec.title.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Render Official FES Pages */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {progressSections.map((sec, secIdx) => {
                  if (activePageFilter !== 'ALL' && activePageFilter !== secIdx) return null;

                  const secCode = sec.sectionCode || String(sec.id || secIdx + 1).padStart(2, '0');
                  const standardItems = (sec.items || []).filter((it) => !it.isCustom);
                  const customItems = (sec.items || []).filter((it) => it.isCustom);

                  let secPctSum = 0;
                  let secPctCount = 0;
                  (sec.items || []).forEach((it) => {
                    const p = parseFloat(it.workPercent);
                    if (!isNaN(p)) {
                      secPctSum += p;
                      secPctCount++;
                    }
                  });
                  const computedSecAvg = secPctCount > 0 ? Math.round(secPctSum / secPctCount) : '';

                  return (
                    <div
                      key={sec.id || secIdx}
                      style={{
                        background: '#ffffff',
                        color: '#0f172a',
                        borderRadius: 10,
                        overflow: 'hidden',
                        boxShadow: '0 14px 36px rgba(0, 0, 0, 0.45)',
                        border: '1px solid #cbd5e1',
                        fontFamily: 'Arial, Helvetica, sans-serif',
                      }}
                    >
                      {/* OFFICIAL DARK NAVY FES HEADER BANNER WITH LOGO */}
                      <div
                        style={{
                          background: '#162d4c',
                          color: '#ffffff',
                          padding: '20px 28px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 16,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 800,
                              letterSpacing: 0.6,
                              lineHeight: 1.15,
                            }}
                          >
                            FAST ENGINEERING SOLUTIONS
                          </div>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: '#cbd5e1',
                              marginTop: 5,
                              letterSpacing: 0.5,
                              fontWeight: 700,
                            }}
                          >
                            CONSTRUCTION SITE / BANK BRANCH PROGRESS REPORT
                          </div>
                        </div>

                        <div
                          style={{
                            background: '#ffffff',
                            borderRadius: 10,
                            padding: 4,
                            width: 72,
                            height: 72,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src="/fes-logo-cropped.png"
                            alt="FES Logo"
                            style={{ width: 66, height: 66, objectFit: 'contain' }}
                          />
                        </div>
                      </div>

                      {/* SHEET BODY */}
                      <div style={{ padding: '22px 28px 18px 28px' }}>
                        {/* Editable Top Metadata Fields (Synced across all 9 pages) */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                            gap: '12px 32px',
                            marginBottom: 18,
                            fontSize: 13,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ whiteSpace: 'nowrap', color: '#0f172a' }}>Branch / Site:</strong>
                            <input
                              type="text"
                              value={branchSite}
                              onChange={(e) => setBranchSite(e.target.value)}
                              placeholder="Site / Branch Name"
                              style={{
                                flex: 1,
                                border: 'none',
                                borderBottom: '1.5px solid #475569',
                                background: 'transparent',
                                color: '#0f172a',
                                fontWeight: 700,
                                fontSize: 13,
                                padding: '3px 6px',
                                outline: 'none',
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ whiteSpace: 'nowrap', color: '#0f172a' }}>Report Date:</strong>
                            <input
                              type="date"
                              value={reportDate}
                              onChange={(e) => setReportDate(e.target.value)}
                              style={{
                                flex: 1,
                                border: 'none',
                                borderBottom: '1.5px solid #475569',
                                background: 'transparent',
                                color: '#0f172a',
                                fontWeight: 600,
                                fontSize: 13,
                                padding: '3px 6px',
                                outline: 'none',
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ whiteSpace: 'nowrap', color: '#0f172a' }}>Site Supervisor:</strong>
                            <input
                              type="text"
                              value={siteSupervisor}
                              onChange={(e) => setSiteSupervisor(e.target.value)}
                              placeholder="Supervisor Name"
                              style={{
                                flex: 1,
                                border: 'none',
                                borderBottom: '1.5px solid #475569',
                                background: 'transparent',
                                color: '#0f172a',
                                fontSize: 13,
                                padding: '3px 6px',
                                outline: 'none',
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ whiteSpace: 'nowrap', color: '#0f172a' }}>Target Completion:</strong>
                            <input
                              type="text"
                              value={targetCompletion}
                              onChange={(e) => setTargetCompletion(e.target.value)}
                              placeholder="e.g. 30-11-2026"
                              style={{
                                flex: 1,
                                border: 'none',
                                borderBottom: '1.5px solid #475569',
                                background: 'transparent',
                                color: '#0f172a',
                                fontSize: 13,
                                padding: '3px 6px',
                                outline: 'none',
                              }}
                            />
                          </div>
                        </div>

                        {/* TEAL SECTION BANNER */}
                        <div
                          style={{
                            background: '#117a7a',
                            color: '#ffffff',
                            padding: '10px 16px',
                            borderRadius: 6,
                            fontWeight: 800,
                            fontSize: 15,
                            letterSpacing: 0.4,
                            marginBottom: 14,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span>
                            {secCode} &nbsp;&nbsp; {sec.title}
                          </span>
                          {computedSecAvg !== '' && (
                            <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.18)', padding: '2px 10px', borderRadius: 999 }}>
                              Avg: {computedSecAvg}%
                            </span>
                          )}
                        </div>

                        {/* PROGRESS REGISTER TABLE */}
                        <div style={{ overflowX: 'auto' }}>
                          <table
                            style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              border: '1px solid #9eb3b3',
                              fontSize: 12.5,
                            }}
                          >
                            <thead>
                              <tr
                                style={{
                                  background: '#d9ebeb',
                                  borderBottom: '1px solid #9eb3b3',
                                  color: '#0f172a',
                                  fontWeight: 700,
                                }}
                              >
                                <th style={{ padding: '8px 10px', width: 46, textAlign: 'left', borderRight: '1px solid #9eb3b3' }}>
                                  No.
                                </th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', minWidth: 210, borderRight: '1px solid #9eb3b3' }}>
                                  Description of Work
                                </th>
                                <th style={{ padding: '8px 10px', width: 78, textAlign: 'left', borderRight: '1px solid #9eb3b3' }}>
                                  Unit
                                </th>
                                <th style={{ padding: '8px 10px', width: 96, textAlign: 'center', borderRight: '1px solid #9eb3b3' }}>
                                  Done %
                                </th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', minWidth: 180 }}>
                                  Remarks
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Standard Numbered Rows */}
                              {standardItems.map((item, sIdx) => {
                                const realIdx = sec.items.indexOf(item);
                                const rowBg = sIdx % 2 === 1 ? '#edf6f6' : '#ffffff';
                                return (
                                  <tr
                                    key={`std-${sIdx}`}
                                    style={{ background: rowBg, borderBottom: '1px solid #b6c8c8' }}
                                  >
                                    <td style={{ padding: '6px 10px', borderRight: '1px solid #b6c8c8', color: '#334155', fontWeight: 600 }}>
                                      {item.code || sIdx + 1}
                                    </td>
                                    <td style={{ padding: '6px 12px', borderRight: '1px solid #b6c8c8', color: '#0f172a', fontWeight: 500 }}>
                                      {item.name}
                                    </td>
                                    <td style={{ padding: '4px 8px', borderRight: '1px solid #b6c8c8' }}>
                                      <input
                                        type="text"
                                        value={item.unit || ''}
                                        onChange={(e) => handleItemChange(secIdx, realIdx, 'unit', e.target.value)}
                                        style={{
                                          width: '100%',
                                          border: 'none',
                                          background: 'transparent',
                                          color: '#1e293b',
                                          fontSize: 12.5,
                                          padding: '2px 4px',
                                          outline: 'none',
                                        }}
                                      />
                                    </td>
                                    <td style={{ padding: '4px 8px', borderRight: '1px solid #b6c8c8' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          placeholder="—"
                                          value={item.workPercent}
                                          onChange={(e) => handleItemChange(secIdx, realIdx, 'workPercent', e.target.value)}
                                          style={{
                                            width: 58,
                                            textAlign: 'center',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: 4,
                                            background: '#ffffff',
                                            color: '#0f766e',
                                            fontWeight: 700,
                                            fontSize: 12.5,
                                            padding: '3px 4px',
                                            outline: 'none',
                                          }}
                                        />
                                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>%</span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '4px 10px' }}>
                                      <input
                                        type="text"
                                        placeholder="Enter remarks..."
                                        value={item.remark || ''}
                                        onChange={(e) => handleItemChange(secIdx, realIdx, 'remark', e.target.value)}
                                        style={{
                                          width: '100%',
                                          border: 'none',
                                          borderBottom: '1px dashed transparent',
                                          background: 'transparent',
                                          color: '#0f172a',
                                          fontSize: 12.5,
                                          padding: '3px 4px',
                                          outline: 'none',
                                        }}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* "Other / additional work:" Divider Row */}
                              <tr style={{ background: '#ffffff', borderBottom: '1px solid #b6c8c8' }}>
                                <td style={{ padding: '7px 10px', borderRight: '1px solid #b6c8c8' }} />
                                <td
                                  style={{
                                    padding: '7px 12px',
                                    borderRight: '1px solid #b6c8c8',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <span>Other / additional work:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddCustomWorkRow(secIdx)}
                                    style={{
                                      background: '#eef6f6',
                                      border: '1px solid #117a7a',
                                      color: '#117a7a',
                                      borderRadius: 4,
                                      padding: '2px 8px',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    + Add Row
                                  </button>
                                </td>
                                <td style={{ padding: '7px 10px', borderRight: '1px solid #b6c8c8' }} />
                                <td style={{ padding: '7px 10px', borderRight: '1px solid #b6c8c8' }} />
                                <td style={{ padding: '7px 12px' }} />
                              </tr>

                              {/* Editable Custom / Additional Rows */}
                              {customItems.map((cItem, cIdx) => {
                                const realIdx = sec.items.indexOf(cItem);
                                const rowBg = cIdx % 2 === 0 ? '#edf6f6' : '#ffffff';
                                return (
                                  <tr
                                    key={`cust-${cIdx}`}
                                    style={{ background: rowBg, borderBottom: '1px solid #b6c8c8' }}
                                  >
                                    <td style={{ padding: '5px 10px', borderRight: '1px solid #b6c8c8', color: '#64748b' }}>
                                      {cItem.name ? standardItems.length + cIdx + 1 : ''}
                                    </td>
                                    <td style={{ padding: '4px 10px', borderRight: '1px solid #b6c8c8' }}>
                                      <input
                                        type="text"
                                        placeholder="Additional work description..."
                                        value={cItem.name || ''}
                                        onChange={(e) => handleItemChange(secIdx, realIdx, 'name', e.target.value)}
                                        style={{
                                          width: '100%',
                                          border: 'none',
                                          background: 'transparent',
                                          color: '#0f172a',
                                          fontSize: 12.5,
                                          padding: '3px 4px',
                                          outline: 'none',
                                        }}
                                      />
                                    </td>
                                    <td style={{ padding: '4px 8px', borderRight: '1px solid #b6c8c8' }}>
                                      <input
                                        type="text"
                                        placeholder="Job / sft"
                                        value={cItem.unit || ''}
                                        onChange={(e) => handleItemChange(secIdx, realIdx, 'unit', e.target.value)}
                                        style={{
                                          width: '100%',
                                          border: 'none',
                                          background: 'transparent',
                                          color: '#1e293b',
                                          fontSize: 12.5,
                                          padding: '3px 4px',
                                          outline: 'none',
                                        }}
                                      />
                                    </td>
                                    <td style={{ padding: '4px 8px', borderRight: '1px solid #b6c8c8' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          placeholder="—"
                                          value={cItem.workPercent}
                                          onChange={(e) => handleItemChange(secIdx, realIdx, 'workPercent', e.target.value)}
                                          style={{
                                            width: 58,
                                            textAlign: 'center',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: 4,
                                            background: '#ffffff',
                                            color: '#0f766e',
                                            fontWeight: 700,
                                            fontSize: 12.5,
                                            padding: '3px 4px',
                                            outline: 'none',
                                          }}
                                        />
                                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>%</span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '4px 10px' }}>
                                      <input
                                        type="text"
                                        placeholder="Enter remarks..."
                                        value={cItem.remark || ''}
                                        onChange={(e) => handleItemChange(secIdx, realIdx, 'remark', e.target.value)}
                                        style={{
                                          width: '100%',
                                          border: 'none',
                                          background: 'transparent',
                                          color: '#0f172a',
                                          fontSize: 12.5,
                                          padding: '3px 4px',
                                          outline: 'none',
                                        }}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* OFFICIAL SECTION BOTTOM SUMMARY & SIGNATURES */}
                        <div style={{ marginTop: 18, fontSize: 12.5, color: '#0f172a' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 16,
                              marginBottom: 12,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong>Overall Section Progress:</strong>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder={computedSecAvg !== '' ? String(computedSecAvg) : '0'}
                                value={sec.overallSectionProgress ?? ''}
                                onChange={(e) =>
                                  handleSectionFooterChange(secIdx, 'overallSectionProgress', e.target.value)
                                }
                                style={{
                                  width: 64,
                                  textAlign: 'center',
                                  border: 'none',
                                  borderBottom: '1.5px solid #475569',
                                  background: 'transparent',
                                  color: '#0f766e',
                                  fontWeight: 800,
                                  fontSize: 13,
                                  padding: '2px 4px',
                                  outline: 'none',
                                }}
                              />
                              <strong>%</strong>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240, maxWidth: 420 }}>
                              <strong style={{ whiteSpace: 'nowrap' }}>Pending / Delayed Items:</strong>
                              <input
                                type="text"
                                value={sec.pendingItems || ''}
                                onChange={(e) => handleSectionFooterChange(secIdx, 'pendingItems', e.target.value)}
                                placeholder="None / Specify delayed items"
                                style={{
                                  flex: 1,
                                  border: 'none',
                                  borderBottom: '1.5px solid #475569',
                                  background: 'transparent',
                                  color: '#0f172a',
                                  fontSize: 12.5,
                                  padding: '2px 6px',
                                  outline: 'none',
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <strong style={{ whiteSpace: 'nowrap' }}>Site Issues / Material Required:</strong>
                            <input
                              type="text"
                              value={sec.siteIssues || ''}
                              onChange={(e) => handleSectionFooterChange(secIdx, 'siteIssues', e.target.value)}
                              placeholder="Enter any site issues or materials required..."
                              style={{
                                flex: 1,
                                border: 'none',
                                borderBottom: '1.5px solid #475569',
                                background: 'transparent',
                                color: '#0f172a',
                                fontSize: 12.5,
                                padding: '2px 6px',
                                outline: 'none',
                              }}
                            />
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                              gap: '12px 32px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <strong style={{ whiteSpace: 'nowrap' }}>Supervisor Signature:</strong>
                              <input
                                type="text"
                                value={sec.supervisorSignature || ''}
                                onChange={(e) =>
                                  handleSectionFooterChange(secIdx, 'supervisorSignature', e.target.value)
                                }
                                placeholder={siteSupervisor || 'Sign / Name'}
                                style={{
                                  flex: 1,
                                  border: 'none',
                                  borderBottom: '1.5px solid #475569',
                                  background: 'transparent',
                                  color: '#0f172a',
                                  fontSize: 12.5,
                                  padding: '2px 6px',
                                  outline: 'none',
                                }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <strong style={{ whiteSpace: 'nowrap' }}>Verified By:</strong>
                              <input
                                type="text"
                                value={sec.verifiedBy || ''}
                                onChange={(e) => handleSectionFooterChange(secIdx, 'verifiedBy', e.target.value)}
                                placeholder="Project Manager / Verifier"
                                style={{
                                  flex: 1,
                                  border: 'none',
                                  borderBottom: '1.5px solid #475569',
                                  background: 'transparent',
                                  color: '#0f172a',
                                  fontSize: 12.5,
                                  padding: '2px 6px',
                                  outline: 'none',
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* OFFICIAL PAGE FOOTER */}
                        <div
                          style={{
                            marginTop: 20,
                            paddingTop: 10,
                            borderTop: '1px solid #cbd5e1',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 11,
                            color: '#64748b',
                          }}
                        >
                          <span>FES | Site Monitoring &amp; Documentation | Manual Progress Register</span>
                          <span>Page {secIdx + 1} of {progressSections.length}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* FEATURE AFTER PROGRESS SHEET: DEMANDS                          */}
            {/* Click -> Material Demand & Payment Demand -> Manual Amount Box */}
            {/* Submit -> Shows Hold, Accept, Reject                           */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <div ref={demandsSectionRef} style={{ marginTop: 28 }}>
              <div
                className="glass-card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  border: demandsPanelOpen
                    ? '1px solid rgba(251, 191, 36, 0.55)'
                    : '1px solid rgba(251, 191, 36, 0.3)',
                  background: 'rgba(15, 23, 42, 0.9)',
                  boxShadow: '0 14px 36px rgba(0,0,0,0.4)',
                }}
              >
                {/* Clickable Demands Header Card */}
                <button
                  type="button"
                  onClick={() => setDemandsPanelOpen((prev) => !prev)}
                  style={{
                    width: '100%',
                    padding: '20px 24px',
                    background: demandsPanelOpen
                      ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(15, 23, 42, 0.95) 100%)'
                      : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)',
                    border: 'none',
                    borderBottom: demandsPanelOpen ? '1px solid rgba(251, 191, 36, 0.25)' : 'none',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 14,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: 'rgba(251, 191, 36, 0.18)',
                        border: '1px solid rgba(251, 191, 36, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <DollarSign size={24} color="#fbbf24" />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 19, fontWeight: 800, color: '#f8fafc' }}>
                          Demands
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: 'rgba(251, 191, 36, 0.18)',
                            color: '#fbbf24',
                            border: '1px solid rgba(251, 191, 36, 0.35)',
                          }}
                        >
                          {demandsList.length} Submitted
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 3 }}>
                        Click here to select <strong>Material Demand</strong> or <strong>Payment Demand</strong>, enter manual amount &amp; track <strong>Hold / Accept / Reject</strong> status
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 16px',
                      borderRadius: 10,
                      background: demandsPanelOpen
                        ? 'rgba(255,255,255,0.08)'
                        : 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    <span>{demandsPanelOpen ? 'Hide Demands' : 'Open Demands'}</span>
                    <ChevronRight
                      size={16}
                      style={{
                        transform: demandsPanelOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  </div>
                </button>

                {/* Expanded Demands Workspace */}
                {demandsPanelOpen && (
                  <div style={{ padding: '24px' }}>
                    {/* 1. TWO DEMAND OPTIONS: MATERIAL DEMAND & PAYMENT DEMAND */}
                    <div style={{ marginBottom: 18 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                          color: '#94a3b8',
                          marginBottom: 10,
                        }}
                      >
                        1. Select Demand Type
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                          gap: 14,
                        }}
                      >
                        {DEMAND_TYPE_OPTIONS.map((opt) => {
                          const isSelected = activeDemandType === opt.value;
                          const IconComp = opt.value === 'MATERIAL' ? Package : DollarSign;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleSelectDemandOption(opt.value)}
                              style={{
                                padding: '18px 20px',
                                borderRadius: 12,
                                border: isSelected
                                  ? `2px solid ${opt.color}`
                                  : '1px solid rgba(255,255,255,0.12)',
                                background: isSelected
                                  ? opt.bg
                                  : 'rgba(255,255,255,0.03)',
                                color: '#f8fafc',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                transition: 'all 0.15s ease',
                                boxShadow: isSelected ? `0 8px 24px ${opt.bg}` : 'none',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div
                                  style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 10,
                                    background: isSelected ? opt.bg : 'rgba(255,255,255,0.06)',
                                    border: `1px solid ${isSelected ? opt.border : 'rgba(255,255,255,0.1)'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <IconComp size={22} color={opt.color} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 16, fontWeight: 800, color: isSelected ? opt.color : '#f8fafc' }}>
                                    {opt.label}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                                    {opt.subtitle}
                                  </div>
                                </div>
                              </div>
                              {isSelected && <CheckCircle2 size={20} color={opt.color} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. MANUAL AMOUNT INPUT BOX + SUBMIT DEMAND */}
                    <form
                      onSubmit={handleSubmitDemand}
                      style={{
                        padding: '20px',
                        borderRadius: 12,
                        background: 'rgba(2, 6, 23, 0.65)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        marginBottom: 24,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                          color: activeDemandType === 'PAYMENT' ? '#38bdf8' : '#fbbf24',
                          marginBottom: 12,
                        }}
                      >
                        2. Enter {activeDemandType === 'PAYMENT' ? 'Payment Demand' : 'Material Demand'} Amount Manually
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: 14,
                          alignItems: 'end',
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#e2e8f0',
                              marginBottom: 6,
                            }}
                          >
                            Amount (Rs.) *
                          </label>
                          <input
                            ref={demandAmountInputRef}
                            type="number"
                            min="1"
                            step="any"
                            required
                            className="nexus-input"
                            placeholder="Enter demand amount manually (e.g. 25000)"
                            value={demandAmount}
                            onChange={(e) => setDemandAmount(e.target.value)}
                            style={{
                              width: '100%',
                              fontSize: 15,
                              fontWeight: 800,
                              padding: '11px 14px',
                              borderColor:
                                activeDemandType === 'PAYMENT'
                                  ? 'rgba(56, 189, 248, 0.45)'
                                  : 'rgba(251, 191, 36, 0.45)',
                            }}
                          />
                        </div>

                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#94a3b8',
                              marginBottom: 6,
                            }}
                          >
                            Details / Purpose (Optional)
                          </label>
                          <input
                            type="text"
                            className="nexus-input"
                            placeholder={
                              activeDemandType === 'PAYMENT'
                                ? 'e.g. Weekly mason & electrician payment...'
                                : 'e.g. Cement bags, electrical cable, tiles...'
                            }
                            value={demandDescription}
                            onChange={(e) => setDemandDescription(e.target.value)}
                            style={{ width: '100%', padding: '11px 14px', fontSize: 13 }}
                          />
                        </div>

                        <div>
                          <button
                            type="submit"
                            disabled={submittingDemand}
                            className="nexus-btn"
                            style={{
                              width: '100%',
                              padding: '12px 20px',
                              borderRadius: 10,
                              border: 'none',
                              fontWeight: 800,
                              fontSize: 13.5,
                              color: '#0f172a',
                              background:
                                activeDemandType === 'PAYMENT'
                                  ? 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)'
                                  : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                              cursor: submittingDemand ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                              boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
                            }}
                          >
                            <Send size={15} />
                            <span>
                              {submittingDemand
                                ? 'Submitting Demand...'
                                : `Submit ${activeDemandType === 'PAYMENT' ? 'Payment' : 'Material'} Demand`}
                            </span>
                          </button>
                        </div>
                      </div>
                    </form>

                    {/* 3. SUBMITTED DEMANDS LIST (SHOWING HOLD, ACCEPT, REJECT) */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 10,
                          marginBottom: 12,
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
                          Submitted Demands &amp; Approval Status ({demandsList.length})
                        </div>
                        <button
                          type="button"
                          onClick={handleRefreshDemands}
                          className="nexus-btn nexus-btn-ghost"
                          style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <RefreshCw size={13} />
                          <span>Refresh Status</span>
                        </button>
                      </div>

                      {demandsList.length === 0 ? (
                        <div
                          style={{
                            padding: '24px 16px',
                            borderRadius: 10,
                            border: '1px dashed rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.02)',
                            textAlign: 'center',
                            color: '#94a3b8',
                            fontSize: 13,
                          }}
                        >
                          No demands submitted for <strong>{branchSite}</strong> yet. Select <strong>Material Demand</strong> or <strong>Payment Demand</strong> above, enter an amount, and click Submit.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {demandsList.map((dem) => {
                            const isPayment = dem.type === 'PAYMENT';
                            const currentStatus = ['HOLD', 'ACCEPT', 'REJECT'].includes(dem.status)
                              ? dem.status
                              : 'HOLD';

                            return (
                              <div
                                key={dem.id}
                                style={{
                                  padding: '16px 18px',
                                  borderRadius: 12,
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.09)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: 14,
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <span
                                      style={{
                                        fontSize: 11,
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

                                    <span style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>
                                      Rs. {(parseFloat(dem.amount) || 0).toLocaleString()}
                                    </span>

                                    <span style={{ fontSize: 11.5, color: '#64748b' }}>
                                      • {dem.createdAt ? new Date(dem.createdAt).toLocaleString() : 'Just now'}
                                    </span>
                                  </div>

                                  {dem.description && (
                                    <div style={{ fontSize: 13, color: '#cbd5e1' }}>
                                      {dem.description}
                                    </div>
                                  )}

                                  {dem.adminNote && (
                                    <div style={{ fontSize: 12, color: '#a78bfa' }}>
                                      <strong>Admin Note:</strong> {dem.adminNote}
                                    </div>
                                  )}
                                </div>

                                {/* STATUS PILLS: HOLD | ACCEPT | REJECT */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  {DEMAND_STATUS_OPTIONS.map((st) => {
                                    const active = currentStatus === st.value;
                                    return (
                                      <span
                                        key={st.value}
                                        style={{
                                          padding: '6px 14px',
                                          borderRadius: 8,
                                          fontSize: 12,
                                          fontWeight: active ? 800 : 600,
                                          letterSpacing: 0.3,
                                          background: active ? st.bg : 'rgba(255,255,255,0.03)',
                                          color: active ? st.color : '#64748b',
                                          border: active
                                            ? `1.5px solid ${st.color}`
                                            : '1px solid rgba(255,255,255,0.08)',
                                          opacity: active ? 1 : 0.55,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 5,
                                          boxShadow: active ? `0 0 14px ${st.bg}` : 'none',
                                        }}
                                      >
                                        {active && st.value === 'HOLD' && <Clock size={13} color={st.color} />}
                                        {active && st.value === 'ACCEPT' && <CheckCircle2 size={13} color={st.color} />}
                                        {active && st.value === 'REJECT' && <X size={13} color={st.color} />}
                                        <span>{st.label}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── STICKY BOTTOM SAVE / SUBMIT BAR ── */}
            <div
              style={{
                position: 'sticky',
                bottom: 14,
                zIndex: 40,
                marginTop: 28,
                padding: '14px 20px',
                borderRadius: 12,
                background: 'rgba(15, 23, 42, 0.96)',
                border: '1px solid rgba(52, 211, 153, 0.35)',
                backdropFilter: 'blur(14px)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
                <span>
                  <span style={{ color: '#94a3b8' }}>Project: </span>
                  <strong style={{ color: '#f8fafc' }}>{branchSite}</strong>
                </span>
                <span>
                  <span style={{ color: '#94a3b8' }}>Progress: </span>
                  <strong style={{ color: '#34d399' }}>{liveTotals.overallProgress}%</strong>
                </span>
                <span>
                  <span style={{ color: '#94a3b8' }}>Project Expense: </span>
                  <strong style={{ color: '#38bdf8' }}>Rs. {liveTotals.projectExpense.toLocaleString()}</strong>
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleExportProgressPdf}
                  disabled={downloadingPdf}
                  className="nexus-btn nexus-btn-ghost"
                  style={{ padding: '9px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={14} />
                  <span>{downloadingPdf ? 'Generating PDF...' : 'Download 9-Page PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => saveProjectWorkspace({ submitAction: 'DRAFT' })}
                  disabled={saving || submitting}
                  className="nexus-btn nexus-btn-ghost"
                  style={{ padding: '9px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={14} />
                  <span>{saving ? 'Saving...' : 'Save Progress'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => saveProjectWorkspace({ submitAction: 'SUBMIT' })}
                  disabled={submitting || saving}
                  className="nexus-btn"
                  style={{
                    padding: '9px 20px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#ffffff',
                    border: 'none',
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <Send size={14} />
                  <span>{submitting ? 'Submitting...' : 'Submit Progress Sheet'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
