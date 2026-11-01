"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Store,
  ShoppingBag,
  Search,
  Plus,
  Download,
  RefreshCw,
  ArrowLeft,
  Check,
  Eye,
  X,
} from 'lucide-react';
import DemandFormSheet from '@/components/DemandFormSheet';
import { useAuth } from '@/components/AuthProvider';
import { apiFetch } from '@/lib/api';
import {
  GROUND_FLOOR_STORE_CATALOG,
  MATERIAL_TYPES,
  SOURCING_MODES,
  INITIAL_RETURNABLE_TOOL_LOANS,
  searchStoreItems,
  getStoreCategories,
  getStoreStats,
} from '@/lib/storeCatalog';
import {
  FES_PROJECT_SITES,
  createDefaultMaterialDemandForm,
} from '@/lib/projectReportTemplates';
import { downloadMaterialDemandPdf } from '@/lib/projectPdfGenerator';

export default function StoreMaterialsModule({
  defaultBranch = 'Manawala',
  onBack = null,
  backLabel = 'Back',
  onDemandSubmitted = null,
}) {
  const { user } = useAuth();
  const defaultRequester =
    user?.employeeName || user?.batchLabel || (user?.role === 'FIELD_EMPLOYEE' ? 'Field Supervisor' : 'Office Staff');

  const [activeTab, setActiveTab] = useState('CATALOG'); // 'CATALOG' | 'NEW_REQUISITION' | 'RETURNABLE' | 'DEMANDS_LOG'

  // Catalog search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

  // Requisition Form State
  const initialSite = useMemo(() => {
    const clean = (defaultBranch || '').trim();
    if (!clean) return 'Manawala';
    const match = FES_PROJECT_SITES.find(
      (s) =>
        s.key !== 'other' &&
        (s.label.toLowerCase() === clean.toLowerCase() || s.key.toLowerCase() === clean.toLowerCase())
    );
    if (match) return match.label;
    if (clean.toLowerCase() === 'office store') return 'Office Store';
    return 'Other';
  }, [defaultBranch]);

  const [branchSite, setBranchSite] = useState(initialSite);
  const [customBranch, setCustomBranch] = useState(
    initialSite === 'Other' && defaultBranch && defaultBranch.toLowerCase() !== 'other' ? defaultBranch : ''
  );
  const [siteSupervisor, setSiteSupervisor] = useState(defaultRequester);
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [materialForm, setMaterialForm] = useState(() =>
    createDefaultMaterialDemandForm({
      branchSite: defaultBranch || 'Manawala',
      siteSupervisor: defaultRequester,
      requisitionNo: `REQ-${Date.now().toString().slice(-4)}`,
    })
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState(null);

  // Returnable tools state (synced with DB)
  const [returnableTools, setReturnableTools] = useState(INITIAL_RETURNABLE_TOOL_LOANS);
  const [loanFilter, setLoanFilter] = useState('ALL'); // 'ALL' | 'IN_FIELD' | 'RETURNED' | 'MINE'
  const [toolIssueModalOpen, setToolIssueModalOpen] = useState(false);
  const [submittingTool, setSubmittingTool] = useState(false);
  const returnableCatalogItems = useMemo(
    () => GROUND_FLOOR_STORE_CATALOG.filter((i) => i.type === MATERIAL_TYPES.RETURNABLE),
    []
  );
  const [newToolLoan, setNewToolLoan] = useState({
    toolName: 'Gas Cylinder',
    issuedTo: defaultRequester,
    site: defaultBranch || 'Manawala',
    dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
    condition: 'Issued in working condition from Ground Floor Store',
  });

  // Demands / Sourcing Log state (synced with DB)
  const [recentDemands, setRecentDemands] = useState([]);
  const [sourcingFilter, setSourcingFilter] = useState('ALL'); // 'ALL' | 'STORE' | 'SELF_BUY' | 'MINE'
  const [loadingData, setLoadingData] = useState(false);
  const [inspectingDemand, setInspectingDemand] = useState(null);
  const [downloadingDemandId, setDownloadingDemandId] = useState(null);

  useEffect(() => {
    if (defaultRequester && (!siteSupervisor || siteSupervisor === 'Office Staff' || siteSupervisor === 'Field Supervisor')) {
      setSiteSupervisor(defaultRequester);
      setNewToolLoan((prev) => ({ ...prev, issuedTo: prev.issuedTo || defaultRequester }));
    }
  }, [defaultRequester]);

  useEffect(() => {
    if (defaultBranch) {
      const clean = defaultBranch.trim();
      const match = FES_PROJECT_SITES.find(
        (s) =>
          s.key !== 'other' &&
          (s.label.toLowerCase() === clean.toLowerCase() || s.key.toLowerCase() === clean.toLowerCase())
      );
      if (match) {
        setBranchSite(match.label);
      } else if (clean.toLowerCase() === 'office store') {
        setBranchSite('Office Store');
      } else {
        setBranchSite('Other');
        if (clean.toLowerCase() !== 'other') setCustomBranch(clean);
      }
      setMaterialForm((prev) => ({
        ...prev,
        projectBranchName: clean,
        siteLocation: clean,
      }));
    }
  }, [defaultBranch]);

  const stats = getStoreStats();
  const categories = getStoreCategories();
  const filteredCatalog = searchStoreItems(searchQuery, selectedCategory, selectedType);

  const fetchLiveStoreData = async () => {
    setLoadingData(true);
    try {
      const data = await apiFetch(`/api/field-projects?t=${Date.now()}`);
      if (Array.isArray(data.allDemands)) {
        setRecentDemands(data.allDemands.filter((d) => d.type !== 'PAYMENT'));
      } else {
        const fallback = [];
        (data.projects || []).forEach((p) => {
          (p.demands || []).forEach((d) => {
            if (d.type !== 'PAYMENT') {
              fallback.push({ ...d, projectTitle: p.label || p.branchName });
            }
          });
        });
        setRecentDemands(fallback);
      }

      if (Array.isArray(data.allToolLoans) && data.allToolLoans.length > 0) {
        setReturnableTools(data.allToolLoans);
      }
    } catch (err) {
      console.error('Failed to load store & material records:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchLiveStoreData();
  }, []);

  // Quick Action: Add catalog item into Requisition Maker with chosen sourcing mode
  const handleQuickDemandItem = (item, sourcingChoice = SOURCING_MODES.STORE) => {
    const existingItems = Array.isArray(materialForm.items) ? materialForm.items : [];
    const firstEmptyIdx = existingItems.findIndex((r) => !(r.description || '').trim());
    let nextItems;
    if (firstEmptyIdx >= 0) {
      nextItems = existingItems.map((r, i) =>
        i === firstEmptyIdx
          ? {
              ...r,
              description: item.name,
              requiredQty: r.requiredQty || '1',
              unit: item.unit || '',
              availableStock: sourcingChoice === SOURCING_MODES.SELF_BUY ? 'N/A' : item.stock || '',
              materialType: item.type || MATERIAL_TYPES.CONSUMABLE,
              sourcingMode: sourcingChoice,
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
          availableStock: sourcingChoice === SOURCING_MODES.SELF_BUY ? 'N/A' : item.stock || '',
          materialType: item.type || MATERIAL_TYPES.CONSUMABLE,
          sourcingMode: sourcingChoice,
        },
      ];
    }

    const activeBranch = branchSite === 'Other' ? customBranch || 'Other' : branchSite;
    setMaterialForm((prev) => ({
      ...prev,
      projectBranchName: prev.projectBranchName || activeBranch,
      siteLocation: prev.siteLocation || activeBranch,
      requestedBy: prev.requestedBy || siteSupervisor,
      requestedByName: prev.requestedByName || siteSupervisor,
      items: nextItems,
    }));
    setActiveTab('NEW_REQUISITION');
  };

  // Submit Requisition to Database
  const handleSubmitRequisition = async (e) => {
    e?.preventDefault();
    setIsSubmitting(true);
    setSubmitFeedback(null);
    try {
      const activeBranch = branchSite === 'Other' ? (customBranch || 'Office Store').trim() : branchSite;
      const matchedStandard = FES_PROJECT_SITES.find(
        (s) => s.key !== 'other' && s.label.toLowerCase() === activeBranch.toLowerCase()
      );
      const resolvedKey = matchedStandard ? matchedStandard.key : 'other';

      const filledItems = (materialForm.items || []).filter(
        (it) => (it.description || '').trim() || (it.requiredQty || '').toString().trim()
      );
      const storeCount = filledItems.filter(
        (i) => !(i.sourcingMode || '').toLowerCase().includes('self')
      ).length;
      const selfCount = filledItems.filter((i) =>
        (i.sourcingMode || '').toLowerCase().includes('self')
      ).length;

      const summaryParts = [];
      if (filledItems.length > 0) {
        summaryParts.push(
          filledItems
            .slice(0, 3)
            .map(
              (it) =>
                `${it.description || 'Item'}${it.requiredQty ? ` (${it.requiredQty}${it.unit ? ' ' + it.unit : ''})` : ''} [${(it.sourcingMode || '').toLowerCase().includes('self') ? 'Self Buy' : 'Store'}]`
            )
            .join(', ')
        );
      }
      if (storeCount > 0 || selfCount > 0) {
        summaryParts.push(`(Store: ${storeCount}, Self Buy: ${selfCount})`);
      }

      await apiFetch('/api/field-projects', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'CREATE_DEMAND',
          projectKey: resolvedKey,
          branchName: activeBranch,
          demandType: 'MATERIAL',
          amount: parseFloat(estimatedAmount) || 0,
          description: summaryParts.join(' ') || materialForm.purpose || 'Material Requisition',
          siteSupervisor: siteSupervisor || defaultRequester,
          formData: {
            ...materialForm,
            projectBranchName: materialForm.projectBranchName || activeBranch,
            siteLocation: materialForm.siteLocation || activeBranch,
            requestedBy: materialForm.requestedBy || siteSupervisor || defaultRequester,
            requestedByName: materialForm.requestedByName || siteSupervisor || defaultRequester,
          },
        }),
      });

      setSubmitFeedback({
        type: 'SUCCESS',
        msg: `Material Requisition #${materialForm.requisitionNo || 'MR-NEW'} for "${activeBranch}" submitted! Store items & Returnable tools have been logged.`,
      });

      await fetchLiveStoreData();
      if (onDemandSubmitted) {
        onDemandSubmitted();
      }

      setEstimatedAmount('');
      setMaterialForm(
        createDefaultMaterialDemandForm({
          branchSite: activeBranch,
          siteSupervisor: siteSupervisor || defaultRequester,
          requisitionNo: `REQ-${Date.now().toString().slice(-4)}`,
        })
      );
    } catch (err) {
      setSubmitFeedback({ type: 'ERROR', msg: err.message || 'Failed to submit requisition' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download Current Requisition Form PDF
  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const activeBranch = branchSite === 'Other' ? customBranch || 'Office Store' : branchSite;
      await downloadMaterialDemandPdf(
        {
          ...materialForm,
          projectBranchName: materialForm.projectBranchName || activeBranch,
          siteLocation: materialForm.siteLocation || activeBranch,
          requestedBy: materialForm.requestedBy || siteSupervisor || defaultRequester,
        },
        parseFloat(estimatedAmount) || 0
      );
    } catch (err) {
      setSubmitFeedback({ type: 'ERROR', msg: `Could not generate PDF: ${err.message}` });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Download Existing Submitted Requisition PDF
  const handleDownloadExistingDemandPdf = async (dem) => {
    setDownloadingDemandId(dem.id);
    try {
      const fallback = createDefaultMaterialDemandForm({
        branchSite: dem.branchName || dem.projectLabel || 'Site',
        siteSupervisor: dem.requestedBy || '',
        reportDate: dem.createdAt ? dem.createdAt.split('T')[0] : '',
      });
      fallback.purpose = dem.description || '';
      await downloadMaterialDemandPdf(dem.formData || fallback, dem.amount || 0);
    } catch (err) {
      alert(`PDF generation error: ${err.message}`);
    } finally {
      setDownloadingDemandId(null);
    }
  };

  // Mark Returnable Tool Returned (DB persisted)
  const handleMarkToolReturned = async (toolId) => {
    const prev = returnableTools;
    setReturnableTools((list) =>
      list.map((t) =>
        t.id === toolId
          ? {
              ...t,
              status: 'RETURNED',
              returnDate: new Date().toISOString().split('T')[0],
              condition: `Returned & Verified (${defaultRequester})`,
            }
          : t
      )
    );
    try {
      await apiFetch('/api/field-projects', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'RETURN_TOOL_LOAN',
          loanId: toolId,
          conditionNote: `Returned & Verified (${defaultRequester})`,
        }),
      });
      await fetchLiveStoreData();
    } catch (err) {
      setReturnableTools(prev);
      alert(`Failed to update return status: ${err.message}`);
    }
  };

  // Issue / Borrow Returnable Tool (DB persisted)
  const handleCreateToolLoan = async (e) => {
    e.preventDefault();
    if (!newToolLoan.issuedTo.trim()) {
      alert('Please enter employee name.');
      return;
    }
    setSubmittingTool(true);
    try {
      const res = await apiFetch('/api/field-projects', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'CREATE_TOOL_LOAN',
          toolName: newToolLoan.toolName,
          issuedTo: newToolLoan.issuedTo.trim(),
          site: newToolLoan.site || 'Manawala',
          dueDate: newToolLoan.dueDate,
          condition: newToolLoan.condition || 'Issued from Ground Floor Store',
        }),
      });
      if (res?.toolLoan) {
        setReturnableTools((prev) => [res.toolLoan, ...prev]);
      }
      setToolIssueModalOpen(false);
      await fetchLiveStoreData();
    } catch (err) {
      alert(`Failed to issue tool loan: ${err.message}`);
    } finally {
      setSubmittingTool(false);
    }
  };

  const filteredLoans = useMemo(() => {
    return returnableTools.filter((loan) => {
      if (loanFilter === 'IN_FIELD' && loan.status === 'RETURNED') return false;
      if (loanFilter === 'RETURNED' && loan.status !== 'RETURNED') return false;
      if (loanFilter === 'MINE') {
        const myName = (user?.employeeName || '').toLowerCase().trim();
        if (myName && !(loan.issuedTo || '').toLowerCase().includes(myName)) return false;
      }
      return true;
    });
  }, [returnableTools, loanFilter, user?.employeeName]);

  const filteredDemandsLog = useMemo(() => {
    return recentDemands.filter((dem) => {
      const items = Array.isArray(dem.formData?.items)
        ? dem.formData.items.filter((i) => (i.description || '').trim())
        : [];
      const hasStore = items.some((i) => !(i.sourcingMode || '').toLowerCase().includes('self'));
      const hasSelf = items.some((i) => (i.sourcingMode || '').toLowerCase().includes('self'));

      if (sourcingFilter === 'STORE' && !hasStore && items.length > 0) return false;
      if (sourcingFilter === 'SELF_BUY' && !hasSelf) return false;
      if (sourcingFilter === 'MINE') {
        const myName = (user?.employeeName || '').toLowerCase().trim();
        if (myName && !(dem.requestedBy || '').toLowerCase().includes(myName)) return false;
      }
      return true;
    });
  }, [recentDemands, sourcingFilter, user?.employeeName]);

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', paddingBottom: 60 }}>
      {/* Optional Back Navigation Button */}
      {onBack && (
        <div style={{ marginBottom: 14 }}>
          <button
            type="button"
            onClick={onBack}
            className="nexus-btn nexus-btn-ghost"
            style={{
              padding: '8px 14px',
              fontSize: 12.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ArrowLeft size={15} />
            <span>{backLabel}</span>
          </button>
        </div>
      )}

      {/* ── HEADER BANNER ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '22px 26px',
          marginBottom: 22,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
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
            <h1 style={{ fontSize: 21, fontWeight: 800, color: '#f8fafc', letterSpacing: -0.3, margin: 0 }}>
              STORE &amp; MATERIAL MANAGEMENT
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
            {user?.role === 'FIELD_EMPLOYEE' && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                }}
              >
                Field Employee Access
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
            3-Tier Material System (<strong>Fixed Material</strong>, <strong>Consumable Material</strong>, and <strong>Returnable Material</strong>) with <strong>Buy from Store</strong> vs <strong>Self Buy</strong> sourcing.
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

      {/* ── 4 KPI METRIC CARDS (CLICKABLE SHORTCUTS) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 14,
          marginBottom: 22,
        }}
      >
        <div
          onClick={() => {
            setSelectedType('ALL');
            setActiveTab('CATALOG');
          }}
          style={{
            background: '#111827',
            border: '1px solid #1e293b',
            borderRadius: 12,
            padding: 16,
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase' }}>
            Total Store Catalog
          </div>
          <div style={{ fontSize: 23, fontWeight: 800, color: '#f8fafc' }}>
            460+ Units ({stats.total} SKUs)
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Electrical, Plumbing, Wires, Hardware &amp; Tools
          </div>
        </div>

        <div
          onClick={() => {
            setSelectedType(MATERIAL_TYPES.FIXED);
            setActiveTab('CATALOG');
          }}
          style={{
            background: '#111827',
            border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: 12,
            padding: 16,
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', marginBottom: 4, textTransform: 'uppercase' }}>
            1. Fixed Material
          </div>
          <div style={{ fontSize: 23, fontWeight: 800, color: '#a78bfa' }}>
            {stats.fixed} Store Assets
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            Welding plant, Drill machines, Motors, Inverters
          </div>
        </div>

        <div
          onClick={() => {
            setSelectedType(MATERIAL_TYPES.CONSUMABLE);
            setActiveTab('CATALOG');
          }}
          style={{
            background: '#111827',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 12,
            padding: 16,
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', marginBottom: 4, textTransform: 'uppercase' }}>
            2. Consumable Material
          </div>
          <div style={{ fontSize: 23, fontWeight: 800, color: '#34d399' }}>
            {stats.consumable} Site SKUs
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            Wires, Cables, Pipes, Breakers, Screws, Tiles
          </div>
        </div>

        <div
          onClick={() => setActiveTab('RETURNABLE')}
          style={{
            background: '#111827',
            border: '1px solid rgba(56,189,248,0.3)',
            borderRadius: 12,
            padding: 16,
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 4, textTransform: 'uppercase' }}>
            3. Returnable Material
          </div>
          <div style={{ fontSize: 23, fontWeight: 800, color: '#38bdf8' }}>
            {returnableTools.filter((t) => t.status !== 'RETURNED').length} In Field · {stats.returnable} SKUs
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            Cylinders, Clamp meters, Pressure gauges, Spanners
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
          { id: 'NEW_REQUISITION', label: '📝 Material Requisition (Store / Self Buy)', count: null },
          {
            id: 'RETURNABLE',
            label: '🔄 Returnable Tools & Loan Tracker',
            count: returnableTools.filter((t) => t.status !== 'RETURNED').length,
          },
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
                padding: '9px 16px',
                fontSize: 12.5,
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
                placeholder="Search Ground Floor Store by item name, cable size, spanner, motor, breaker, pipe..."
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

            {/* 3 Material Classifications Filter */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {[
                { id: 'ALL', label: 'All 3 Material Parts' },
                { id: MATERIAL_TYPES.FIXED, label: '🟣 Fixed Material (Company Store)' },
                { id: MATERIAL_TYPES.CONSUMABLE, label: '🟢 Consumable Material (Site Used)' },
                { id: MATERIAL_TYPES.RETURNABLE, label: '🔵 Returnable Material (Field Tools)' },
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

            {/* Category Pills */}
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
                    <th style={{ padding: '12px 14px', width: 88 }}>Code</th>
                    <th style={{ padding: '12px 14px' }}>Item Name (Ground Floor Store)</th>
                    <th style={{ padding: '12px 14px', width: 145 }}>Category</th>
                    <th style={{ padding: '12px 14px', width: 135 }}>Material Type</th>
                    <th style={{ padding: '12px 14px', width: 135 }}>Store Stock</th>
                    <th style={{ padding: '12px 14px', width: 155 }}>Location</th>
                    <th style={{ padding: '12px 14px', width: 215, textAlign: 'center' }}>Sourcing Action</th>
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
                        <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>
                          {item.category}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: isFixed
                                ? 'rgba(168,85,247,0.15)'
                                : isRet
                                ? 'rgba(56,189,248,0.15)'
                                : 'rgba(16,185,129,0.15)',
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
                          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleQuickDemandItem(item, SOURCING_MODES.STORE)}
                              title="Request from Company Store"
                              style={{
                                background: 'rgba(56,189,248,0.15)',
                                border: '1px solid #38bdf8',
                                color: '#38bdf8',
                                borderRadius: 6,
                                padding: '5px 9px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Store size={11} /> Buy from Store
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickDemandItem(item, SOURCING_MODES.SELF_BUY)}
                              title="Purchase locally / Self Buy"
                              style={{
                                background: 'rgba(245,158,11,0.15)',
                                border: '1px solid #f59e0b',
                                color: '#fbbf24',
                                borderRadius: 6,
                                padding: '5px 9px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <ShoppingBag size={11} /> Self Buy
                            </button>
                          </div>
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
          TAB 2: MATERIAL REQUISITION MAKER (BUY FROM STORE VS SELF BUY)
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'NEW_REQUISITION' && (
        <div>
          {submitFeedback && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                marginBottom: 16,
                background:
                  submitFeedback.type === 'SUCCESS' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                border: `1px solid ${submitFeedback.type === 'SUCCESS' ? '#059669' : '#dc2626'}`,
                color: submitFeedback.type === 'SUCCESS' ? '#34d399' : '#f87171',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{submitFeedback.msg}</span>
              <button
                type="button"
                onClick={() => setSubmitFeedback(null)}
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>
          )}

          <div
            style={{
              background: '#111827',
              border: '1px solid #1e293b',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  Project / Office Site:
                </label>
                <select
                  value={branchSite}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBranchSite(val);
                    if (val !== 'Other') {
                      setMaterialForm((prev) => ({
                        ...prev,
                        projectBranchName: val,
                        siteLocation: val,
                      }));
                    }
                  }}
                  style={{
                    background: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    padding: '7px 10px',
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  {FES_PROJECT_SITES.filter((s) => s.key !== 'other').map((s) => (
                    <option key={s.key} value={s.label}>
                      Project: {s.label}
                    </option>
                  ))}
                  <option value="Office Store">Office / Ground Floor Store</option>
                  <option value="Other">Other Custom Site</option>
                </select>
              </div>

              {branchSite === 'Other' && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    Custom Site Name:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Faisalabad Main Branch"
                    value={customBranch}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCustomBranch(v);
                      setMaterialForm((prev) => ({
                        ...prev,
                        projectBranchName: v,
                        siteLocation: v,
                      }));
                    }}
                    style={{
                      background: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '7px 10px',
                      fontSize: 12.5,
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  Requested By (Employee):
                </label>
                <input
                  type="text"
                  value={siteSupervisor}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSiteSupervisor(v);
                    setMaterialForm((prev) => ({
                      ...prev,
                      requestedBy: v,
                      requestedByName: v,
                    }));
                  }}
                  style={{
                    background: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    padding: '7px 10px',
                    fontSize: 12.5,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', display: 'block', marginBottom: 4 }}>
                  Est. Self-Buy Cash (PKR, Optional):
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0 for Store Issue"
                  value={estimatedAmount}
                  onChange={(e) => setEstimatedAmount(e.target.value)}
                  style={{
                    width: 155,
                    background: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    padding: '7px 10px',
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                RETURNABLE TOOLS &amp; EQUIPMENT TRACKER
              </h3>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0 0' }}>
                Field &amp; Office tools checked out from Ground Floor Store. Automatically synced when Returnable items are requested.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { id: 'ALL', label: 'All Tools' },
                { id: 'IN_FIELD', label: '🟡 In Field' },
                { id: 'RETURNED', label: '🟢 Returned' },
                { id: 'MINE', label: '👤 My Borrowed Tools' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setLoanFilter(f.id)}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: loanFilter === f.id ? '#38bdf8' : '#334155',
                    background: loanFilter === f.id ? 'rgba(56,189,248,0.16)' : 'rgba(255,255,255,0.03)',
                    color: loanFilter === f.id ? '#38bdf8' : '#94a3b8',
                  }}
                >
                  {f.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setToolIssueModalOpen(true)}
                style={{
                  background: '#38bdf8',
                  color: '#090d16',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={14} /> Borrow / Issue Tool
              </button>
            </div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#38bdf8', textAlign: 'left', fontWeight: 700 }}>
                    <th style={{ padding: '12px 14px', width: 105 }}>Loan ID</th>
                    <th style={{ padding: '12px 14px' }}>Returnable Tool / Material</th>
                    <th style={{ padding: '12px 14px' }}>Issued To (Employee)</th>
                    <th style={{ padding: '12px 14px' }}>Project / Office Site</th>
                    <th style={{ padding: '12px 14px', width: 110 }}>Issue Date</th>
                    <th style={{ padding: '12px 14px', width: 110 }}>Due Date</th>
                    <th style={{ padding: '12px 14px', width: 135 }}>Status</th>
                    <th style={{ padding: '12px 14px', width: 135, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>
                        No returnable tool records match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map((loan, idx) => {
                      const isReturned = loan.status === 'RETURNED';
                      return (
                        <tr
                          key={loan.id || idx}
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
                          <td style={{ padding: '10px 14px', color: '#cbd5e1', fontWeight: 600 }}>
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
                                Return to Store
                              </button>
                            ) : (
                              <span style={{ fontSize: 11, color: '#64748b' }}>
                                Returned {loan.returnDate || ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal to Issue / Borrow Returnable Tool */}
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
                  BORROW / ISSUE RETURNABLE MATERIAL
                </h3>
                <form onSubmit={handleCreateToolLoan}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                      Select Returnable Tool from Store:
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
                      {returnableCatalogItems.map((it) => (
                        <option key={it.id} value={it.name}>
                          {it.name} ({it.stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                      Employee Name (Field / Office):
                    </label>
                    <input
                      type="text"
                      placeholder="Employee Name"
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
                      required
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                      Project / Site Name:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Manawala, Kanjwahl, Office"
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
                      Expected Return Date:
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
                        padding: '7px 14px',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingTool}
                      style={{
                        background: '#38bdf8',
                        color: '#090d16',
                        border: 'none',
                        borderRadius: 6,
                        padding: '7px 16px',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {submittingTool ? 'Saving...' : 'Confirm Tool Issue'}
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
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                MATERIAL SOURCING &amp; GATE PASS LEDGER
              </h3>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0 0' }}>
                Live log of Field &amp; Office Material Requisitions showing <strong>Buy from Store</strong> vs <strong>Self Buy</strong> items.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { id: 'ALL', label: 'All Requisitions' },
                { id: 'STORE', label: '🏪 Buy from Store' },
                { id: 'SELF_BUY', label: '🛒 Self Buy' },
                { id: 'MINE', label: '👤 My Requests' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSourcingFilter(f.id)}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: sourcingFilter === f.id ? '#38bdf8' : '#334155',
                    background: sourcingFilter === f.id ? 'rgba(56,189,248,0.16)' : 'rgba(255,255,255,0.03)',
                    color: sourcingFilter === f.id ? '#38bdf8' : '#94a3b8',
                  }}
                >
                  {f.label}
                </button>
              ))}

              <button
                type="button"
                onClick={fetchLiveStoreData}
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
                <RefreshCw size={13} className={loadingData ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#38bdf8', textAlign: 'left', fontWeight: 700 }}>
                    <th style={{ padding: '12px 14px', width: 110 }}>Req / Gate #</th>
                    <th style={{ padding: '12px 14px' }}>Project / Site</th>
                    <th style={{ padding: '12px 14px' }}>Requested By</th>
                    <th style={{ padding: '12px 14px' }}>Materials Summary</th>
                    <th style={{ padding: '12px 14px', width: 155 }}>Sourcing Breakdown</th>
                    <th style={{ padding: '12px 14px', width: 105 }}>Status</th>
                    <th style={{ padding: '12px 14px', width: 145, textAlign: 'center' }}>Form / PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDemandsLog.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                        No material requisitions found. Create a new requisition using the tab above.
                      </td>
                    </tr>
                  ) : (
                    filteredDemandsLog.map((dem, idx) => {
                      const items = (dem.formData?.items || []).filter((i) => (i.description || '').trim());
                      const storeCount = items.filter(
                        (i) => !(i.sourcingMode || '').toLowerCase().includes('self')
                      ).length;
                      const selfCount = items.filter((i) =>
                        (i.sourcingMode || '').toLowerCase().includes('self')
                      ).length;
                      return (
                        <tr
                          key={dem.id || idx}
                          style={{
                            borderBottom: '1px solid #1e293b',
                            background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#94a3b8' }}>
                            {dem.formData?.requisitionNo || (dem.id || '').slice(0, 10)}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#f8fafc' }}>
                            {dem.branchName || dem.projectLabel || 'Site'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                            {dem.requestedBy || 'Staff'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>
                            {dem.description || 'Material Requisition'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {storeCount > 0 && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    background: 'rgba(56,189,248,0.15)',
                                    color: '#38bdf8',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                  }}
                                >
                                  🏪 Store: {storeCount}
                                </span>
                              )}
                              {selfCount > 0 && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    background: 'rgba(245,158,11,0.15)',
                                    color: '#fbbf24',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                  }}
                                >
                                  🛒 Self: {selfCount}
                                </span>
                              )}
                              {storeCount === 0 && selfCount === 0 && (
                                <span style={{ fontSize: 11, color: '#64748b' }}>Standard</span>
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
                                background:
                                  dem.status === 'ACCEPT'
                                    ? 'rgba(16,185,129,0.15)'
                                    : dem.status === 'REJECT'
                                    ? 'rgba(239,68,68,0.15)'
                                    : 'rgba(245,158,11,0.15)',
                                color:
                                  dem.status === 'ACCEPT'
                                    ? '#34d399'
                                    : dem.status === 'REJECT'
                                    ? '#f87171'
                                    : '#fbbf24',
                              }}
                            >
                              {dem.status || 'HOLD'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => setInspectingDemand(dem)}
                                style={{
                                  background: 'rgba(255,255,255,0.06)',
                                  border: '1px solid #334155',
                                  color: '#e2e8f0',
                                  borderRadius: 6,
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Eye size={12} /> View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadExistingDemandPdf(dem)}
                                disabled={downloadingDemandId === dem.id}
                                style={{
                                  background: 'rgba(56,189,248,0.14)',
                                  border: '1px solid rgba(56,189,248,0.4)',
                                  color: '#38bdf8',
                                  borderRadius: 6,
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Download size={12} /> PDF
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Read-only Demand Form Preview Modal */}
          {inspectingDemand && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 6, 23, 0.85)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 18,
              }}
            >
              <div
                style={{
                  background: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 14,
                  width: '100%',
                  maxWidth: 960,
                  maxHeight: '92vh',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                    Material Requisition Preview — {inspectingDemand.branchName || 'Site'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleDownloadExistingDemandPdf(inspectingDemand)}
                      style={{
                        background: '#38bdf8',
                        color: '#090d16',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Download size={13} /> Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectingDemand(null)}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        color: '#f8fafc',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div style={{ padding: 20, overflowY: 'auto' }}>
                  <DemandFormSheet
                    type="MATERIAL"
                    formData={
                      inspectingDemand.formData ||
                      createDefaultMaterialDemandForm({
                        branchSite: inspectingDemand.branchName || '',
                        siteSupervisor: inspectingDemand.requestedBy || '',
                      })
                    }
                    readOnly={true}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
