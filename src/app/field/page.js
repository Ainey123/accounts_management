"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  HardHat, Briefcase, Mail, Phone, Calendar, Clock,
  CheckCircle2, AlertTriangle, FileText, DollarSign, Upload,
  Camera, Download, RefreshCw, LogOut, ChevronRight, ArrowLeft,
  Save, Send, ShieldAlert, History, Paperclip, Eye, X, AlertCircle,
  Building, Plus, PlusCircle, Receipt, User, Search
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { apiFetch } from '@/lib/api';
import { PROJECT_EXPENSE_TEMPLATE, PROJECT_PROGRESS_TEMPLATE } from '@/lib/projectReportTemplates';
import { downloadExpenseReportPdf, downloadProgressReportPdf } from '@/lib/projectPdfGenerator';
import ProjectReportModal from '@/components/ProjectReportModal';

export default function FieldPortalPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState('jobs'); // 'jobs' | 'history'
  const [selectedJob, setSelectedJob] = useState(null);
  const [reportTab, setReportTab] = useState('progress'); // 'progress' | 'expense' | 'attachments' | 'audit'

  // Form State
  const [progressSections, setProgressSections] = useState([]);
  const [expenseSections, setExpenseSections] = useState([]);
  const [paidBy, setPaidBy] = useState('FES');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [attachments, setAttachments] = useState([]);
  const [existingReport, setExistingReport] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [intakeCategoryPreviewTab, setIntakeCategoryPreviewTab] = useState('progress');
  const [studioCategoryTab, setStudioCategoryTab] = useState('progress');
  const [studioProjectBranch, setStudioProjectBranch] = useState('UBL Bank Mall Road Branch');
  const [studioProjectClient, setStudioProjectClient] = useState('UBL Bank');
  const [studioProjectPoc, setStudioProjectPoc] = useState('Branch Manager');

  // ── Job Intake State ──
  const [allTickets, setAllTickets] = useState([]);
  const [pendingTickets, setPendingTickets] = useState([]);
  const [gmailSearchTerm, setGmailSearchTerm] = useState('');
  const [gmailFilterType, setGmailFilterType] = useState('all'); // 'all' | 'pending' | 'taken'
  const [allEmployees, setAllEmployees] = useState([]);
  const [intakeTicketId, setIntakeTicketId] = useState('');
  const [intakeTicketSearch, setIntakeTicketSearch] = useState('');
  const [intakeFilterType, setIntakeFilterType] = useState('all'); // 'all' | 'taken' | 'pending'
  const [showQuickPickGrid, setShowQuickPickGrid] = useState(true);
  const [intakeForm, setIntakeForm] = useState({
    clientName: '',
    branchName: '',
    personOfContact: '',
    workNature: '',
    assignedEmployeeId: '',
    manualEnteredBy: '',
  });
  const [submittingIntake, setSubmittingIntake] = useState(false);
  const [showManualTicketModal, setShowManualTicketModal] = useState(false);
  const [manualTicketSubject, setManualTicketSubject] = useState('');
  const [manualTicketSender, setManualTicketSender] = useState('');
  const [creatingManualTicket, setCreatingManualTicket] = useState(false);

  // ── Prompt for Both PDFs on Project Option ──
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [modalJobForReport, setModalJobForReport] = useState(null);

  // ── Direct Log Field Expense Modal State ──
  const [isLogExpenseModalOpen, setIsLogExpenseModalOpen] = useState(false);
  const [submittingFieldExpense, setSubmittingFieldExpense] = useState(false);
  const [logExpenseForm, setLogExpenseForm] = useState({
    jobMetadataId: '',
    category: 'Site Expense',
    amount: '',
    paidBy: 'FES',
    expenseDate: new Date().toISOString().split('T')[0],
    expenseTime: new Date().toTimeString().slice(0, 5),
    billNumber: '',
    summaryNotes: '',
    imageUrl: '',
  });

  const fileInputRef = useRef(null);
  const expenseFileInputRef = useRef(null);

  // Initialize form templates
  const initTemplates = (report = null) => {
    if (report && report.progressData) {
      try {
        const parsed = JSON.parse(report.progressData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed.map((sec) => ({
            ...sec,
            items: (sec.items || []).map((it) => (it.unit === 'Jop' ? { ...it, unit: 'Job' } : it)),
          }));
          setProgressSections(normalized);
        } else {
          setProgressSections(JSON.parse(JSON.stringify(PROJECT_PROGRESS_TEMPLATE)));
        }
      } catch {
        setProgressSections(JSON.parse(JSON.stringify(PROJECT_PROGRESS_TEMPLATE)));
      }
    } else {
      setProgressSections(JSON.parse(JSON.stringify(PROJECT_PROGRESS_TEMPLATE)));
    }

    if (report && report.expenseData) {
      try {
        const parsed = JSON.parse(report.expenseData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExpenseSections(parsed);
        } else {
          setExpenseSections(JSON.parse(JSON.stringify(PROJECT_EXPENSE_TEMPLATE)));
        }
      } catch {
        setExpenseSections(JSON.parse(JSON.stringify(PROJECT_EXPENSE_TEMPLATE)));
      }
    } else {
      setExpenseSections(JSON.parse(JSON.stringify(PROJECT_EXPENSE_TEMPLATE)));
    }

    if (report && report.attachments) {
      try {
        const parsed = JSON.parse(report.attachments);
        setAttachments(Array.isArray(parsed) ? parsed : []);
      } catch {
        setAttachments([]);
      }
    } else {
      setAttachments([]);
    }

    if (report && report.paidBy) {
      setPaidBy(report.paidBy);
    } else {
      setPaidBy('FES');
    }

    if (report && report.reportDate) {
      try {
        setReportDate(new Date(report.reportDate).toISOString().split('T')[0]);
      } catch {}
    } else {
      setReportDate(new Date().toISOString().split('T')[0]);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setActionMessage({ type: '', text: '' });
    try {
      const [jobsRes, reportsRes, ticketsRes, usersRes] = await Promise.all([
        apiFetch('/api/jobs'),
        apiFetch('/api/project-reports?myReports=true'),
        apiFetch('/api/tickets?limit=250').catch(() => ({ tickets: [] })),
        apiFetch('/api/users').catch(() => ({ users: [] })),
      ]);
      const fetchedJobs = jobsRes.jobs || [];
      const fetchedReports = reportsRes.reports || [];
      const fetchedTickets = ticketsRes.tickets || [];
      setJobs(fetchedJobs);
      setMySubmissions(fetchedReports);
      setAllTickets(fetchedTickets);
      setPendingTickets(fetchedTickets.filter((t) => !t.jobMetadata));
      setAllEmployees((usersRes.users || []).filter((u) => u.role !== 'ADMIN'));

      // If active job is open, refresh its report
      if (selectedJob) {
        const matched = fetchedReports.find((r) => r.jobMetadataId === selectedJob.id);
        setExistingReport(matched || null);
      }
    } catch (err) {
      console.error('Failed to load field portal data:', err);
      setActionMessage({ type: 'error', text: 'Failed to sync latest jobs: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    initTemplates();
  }, []);

  // ── Open Log Field Expense Modal ──
  const openLogExpenseModal = (job = null) => {
    const targetJobId = job ? String(job.id) : (jobs[0]?.id ? String(jobs[0].id) : '');
    setLogExpenseForm({
      jobMetadataId: targetJobId,
      category: 'Site Expense',
      amount: '',
      paidBy: 'FES',
      expenseDate: new Date().toISOString().split('T')[0],
      expenseTime: new Date().toTimeString().slice(0, 5),
      billNumber: '',
      summaryNotes: '',
      imageUrl: '',
    });
    setIsLogExpenseModalOpen(true);
  };

  const handleExpenseFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogExpenseForm((prev) => ({ ...prev, imageUrl: event.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleLogExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!logExpenseForm.jobMetadataId) {
      setActionMessage({ type: 'error', text: 'Please select a job for this expense.' });
      return;
    }
    const amt = parseFloat(logExpenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setActionMessage({ type: 'error', text: 'Please enter a valid expense amount.' });
      return;
    }
    setSubmittingFieldExpense(true);
    setActionMessage({ type: '', text: '' });
    try {
      const payload = {
        jobMetadataId: Number(logExpenseForm.jobMetadataId),
        amount: amt,
        category: logExpenseForm.category || 'Site Expense',
        paidBy: logExpenseForm.paidBy || 'FES',
        expenseDate: logExpenseForm.expenseDate,
        expenseTime: logExpenseForm.expenseTime,
        billNumber: logExpenseForm.billNumber,
        summaryNotes: logExpenseForm.summaryNotes,
        imageUrl: logExpenseForm.imageUrl,
        isFieldWork: true,
        source: 'field',
      };
      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setIsLogExpenseModalOpen(false);
      setActionMessage({
        type: 'success',
        text: `Rs. ${amt.toLocaleString()} field expense logged successfully! Automatically submitted and visible to office operations for that Gmail account.`,
      });
      await loadData();
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Failed to log expense: ' + err.message });
    } finally {
      setSubmittingFieldExpense(false);
    }
  };

  // ── Intake Ticket Change ──
  const handleIntakeTicketChange = (ticketId) => {
    setIntakeTicketId(ticketId);
    if (!ticketId) return;
    const ticket = (allTickets || []).find((t) => String(t.id) === String(ticketId));
    if (ticket) {
      if (ticket.jobMetadata) {
        setIntakeForm((prev) => ({
          ...prev,
          clientName: ticket.jobMetadata.clientName || prev.clientName,
          branchName: ticket.jobMetadata.branchName || prev.branchName,
          personOfContact: ticket.jobMetadata.personOfContact || prev.personOfContact,
          workNature: ticket.jobMetadata.workNature || 'PROJECT',
        }));
        const taker = ticket.jobMetadata.createdBy?.employeeName || ticket.jobMetadata.manualEnteredBy || 'Office Staff';
        setActionMessage({
          type: 'success',
          text: `ℹ️ Email #${ticket.serialNo} was taken by ${taker}. You can attach your Project Progress & Expenses to this job directly!`,
        });
      } else {
        const senderName = ticket.sender?.split('@')[0] || '';
        setIntakeForm((prev) => ({
          ...prev,
          clientName: prev.clientName || senderName,
          branchName: prev.branchName || ticket.subject || '',
        }));
      }
    }
  };

  // ── Create Manual Ticket ──
  const handleCreateManualTicket = async (e) => {
    e.preventDefault();
    setCreatingManualTicket(true);
    try {
      const { ticket } = await apiFetch('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: manualTicketSubject,
          sender: manualTicketSender || 'Field Site Entry',
          createdById: user?.id,
        }),
      });
      setPendingTickets((prev) => [ticket, ...prev]);
      setAllTickets((prev) => [ticket, ...prev]);
      setIntakeTicketId(String(ticket.id));
      setShowManualTicketModal(false);
      setManualTicketSubject('');
      setManualTicketSender('');
      setActionMessage({ type: 'success', text: `Manual ticket #${ticket.serialNo} created.` });
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Failed to create manual ticket: ' + err.message });
    } finally {
      setCreatingManualTicket(false);
    }
  };

  // ── Save Job Intake ──
  const handleIntakeSubmit = async (e) => {
    e.preventDefault();
    if (!intakeTicketId) {
      setActionMessage({ type: 'error', text: 'Select an incoming ticket first to link this job.' });
      return;
    }
    setSubmittingIntake(true);
    setActionMessage({ type: '', text: '' });
    try {
      const res = await apiFetch('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          ticketId: Number(intakeTicketId),
          clientName: intakeForm.clientName,
          branchName: intakeForm.branchName,
          personOfContact: intakeForm.personOfContact,
          workNature: intakeForm.workNature,
          assignedEmployeeId: intakeForm.assignedEmployeeId ? Number(intakeForm.assignedEmployeeId) : user?.id,
          manualEnteredBy: user?.employeeName || 'Field Staff',
        }),
      });

      const savedJob = res.job;
      const isProject = intakeForm.workNature === 'PROJECT';

      // Reset form
      setIntakeForm({
        clientName: '',
        branchName: '',
        personOfContact: '',
        workNature: '',
        assignedEmployeeId: '',
        manualEnteredBy: '',
      });
      setIntakeTicketId('');

      await loadData();

      // IF WORK NATURE IS PROJECT: Immediately open prompt of both PDFs!
      if (isProject && savedJob) {
        setActionMessage({
          type: 'success',
          text: `🎉 Job Serial #${savedJob.ticket?.serialNo || savedJob.id} generated! Please fill out the Project Daily Progress and Expense reports below.`,
        });
        setModalJobForReport(savedJob);
        setIsReportModalOpen(true);
      } else {
        setActionMessage({
          type: 'success',
          text: `🎉 Job Serial #${savedJob?.ticket?.serialNo || savedJob?.id} created successfully and added to your portal.`,
        });
        setActiveTab('jobs');
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Failed to save job metadata: ' + err.message });
    } finally {
      setSubmittingIntake(false);
    }
  };

  const handleOpenProjectForTicket = (ticket) => {
    if (ticket.jobMetadata) {
      const job = {
        ...ticket.jobMetadata,
        ticket,
      };
      setSelectedJob(job);
      const matched = (mySubmissions || []).find((r) => r.jobMetadataId === job.id);
      const rep = matched || (ticket.jobMetadata.projectReports?.[0] || null);
      setExistingReport(rep);
      initTemplates(rep);
      setStudioProjectBranch(job.branchName);
      setStudioProjectClient(job.clientName);
      setStudioProjectPoc(job.personOfContact);
      setModalJobForReport(job);
      setIsReportModalOpen(true);
      const creatorName = ticket.jobMetadata.createdBy?.employeeName || ticket.jobMetadata.manualEnteredBy || 'Office Staff';
      setActionMessage({
        type: 'success',
        text: `⭐ Email taken by ${creatorName} linked! Fill in your 9 Progress & 11 Expense Categories below. ${creatorName} will be automatically notified upon submission.`,
      });
    } else {
      const senderName = ticket.sender?.split('@')[0] || 'Client';
      const defaultBranch = ticket.subject || 'Site Project';
      const projectJob = {
        id: Date.now(),
        ticketId: ticket.id,
        clientName: senderName,
        branchName: defaultBranch,
        personOfContact: user?.employeeName || 'Site Contact',
        workNature: 'PROJECT',
        ticket,
        assignedEmployee: user,
      };
      setSelectedJob(projectJob);
      setStudioProjectBranch(defaultBranch);
      setStudioProjectClient(senderName);
      setStudioProjectPoc(user?.employeeName || 'Site Contact');
      initTemplates();
      setModalJobForReport(projectJob);
      setIsReportModalOpen(true);
      setActionMessage({
        type: 'success',
        text: `⭐ Linked to pending email #${ticket.serialNo}. Please fill in the 9 Progress Categories & 11 Expense Categories.`,
      });
    }
  };

  const filteredAllTickets = (allTickets || []).filter((t) => {
    if (gmailFilterType === 'pending' && t.jobMetadata) return false;
    if (gmailFilterType === 'taken' && !t.jobMetadata) return false;

    if (!gmailSearchTerm) return true;
    const q = gmailSearchTerm.toLowerCase();
    const takenBy = (t.jobMetadata?.createdBy?.employeeName || t.jobMetadata?.manualEnteredBy || '').toLowerCase();
    const client = (t.jobMetadata?.clientName || '').toLowerCase();
    const branch = (t.jobMetadata?.branchName || '').toLowerCase();
    const subject = (t.subject || '').toLowerCase();
    const sender = (t.sender || '').toLowerCase();
    const serial = (t.serialNo || '').toLowerCase();
    const emailBox = (t.gmailAccount?.gmailEmail || '').toLowerCase();

    return (
      subject.includes(q) ||
      sender.includes(q) ||
      serial.includes(q) ||
      takenBy.includes(q) ||
      client.includes(q) ||
      branch.includes(q) ||
      emailBox.includes(q)
    );
  });

  const filteredIntakeTickets = (allTickets || [])
    .filter((t) => t.status !== 'IRRELEVANT' && t.status !== 'CANCELLED')
    .filter((t) => {
      if (intakeFilterType === 'taken') return !!t.jobMetadata;
      if (intakeFilterType === 'pending') return !t.jobMetadata;
      return true;
    })
    .filter((t) => {
      if (!intakeTicketSearch) return true;
      const q = intakeTicketSearch.toLowerCase();
      const takenBy = (t.jobMetadata?.createdBy?.employeeName || t.jobMetadata?.manualEnteredBy || '').toLowerCase();
      const client = (t.jobMetadata?.clientName || '').toLowerCase();
      const branch = (t.jobMetadata?.branchName || '').toLowerCase();
      return (
        (t.subject || '').toLowerCase().includes(q) ||
        (t.sender || '').toLowerCase().includes(q) ||
        (t.serialNo || '').toLowerCase().includes(q) ||
        takenBy.includes(q) ||
        client.includes(q) ||
        branch.includes(q) ||
        (t.gmailAccount?.gmailEmail || '').toLowerCase().includes(q)
      );
    });

  const selectedIntakeTicket = (allTickets || []).find((t) => String(t.id) === String(intakeTicketId));

  const handleAutoOpenProjectScreen = (customBranch = '', customClient = '') => {
    const branch = customBranch || intakeForm.branchName?.trim() || studioProjectBranch || 'UBL Bank Mall Road Branch';
    const client = customClient || intakeForm.clientName?.trim() || studioProjectClient || 'UBL Bank';
    const poc = intakeForm.personOfContact?.trim() || studioProjectPoc || user?.employeeName || 'Branch Manager';

    const matchedTicket = (allTickets || []).find((t) => String(t.id) === String(intakeTicketId)) || (pendingTickets || []).find((t) => String(t.id) === String(intakeTicketId));

    const projectJob = {
      id: matchedTicket?.jobMetadata?.id || Date.now(),
      ticketId: matchedTicket?.id || undefined,
      clientName: client,
      branchName: branch,
      personOfContact: poc,
      workNature: 'PROJECT',
      ticket: matchedTicket || {
        serialNo: 'PROJ-' + Date.now().toString().slice(-4),
        subject: `${client} - ${branch} Daily Progress & Expense Report`,
      },
      assignedEmployee: user,
    };

    setModalJobForReport(projectJob);
    setIsReportModalOpen(true);
  };

  const openProjectReportModalForJob = (job) => {
    setSelectedJob(job);
    const matched = (mySubmissions || []).find((r) => r.jobMetadataId === job.id);
    setExistingReport(matched || null);
    initTemplates(matched || null);
    setModalJobForReport(job);
    setIsReportModalOpen(true);
  };

  const handleStudioSubmit = async (statusToSet = 'SUBMITTED') => {
    const isSubmitting = statusToSet === 'SUBMITTED';
    if (isSubmitting) setSubmitting(true);
    else setSavingDraft(true);
    setActionMessage({ type: '', text: '' });

    const totalExpense = calculateTotalExpenses();
    const overallProgress = calculateOverallProgress();

    try {
      const activeBranch = studioProjectBranch?.trim() || selectedJob?.branchName || intakeForm.branchName?.trim() || 'UBL Bank Mall Road Branch';
      const activeClient = studioProjectClient?.trim() || selectedJob?.clientName || intakeForm.clientName?.trim() || 'UBL Bank';
      const activePoc = studioProjectPoc?.trim() || selectedJob?.personOfContact || intakeForm.personOfContact?.trim() || user?.employeeName || 'Branch Manager';

      const payload = {
        jobMetadataId: selectedJob?.id || undefined,
        branchName: activeBranch,
        clientName: activeClient,
        personOfContact: activePoc,
        reportDate,
        expenseData: expenseSections,
        progressData: progressSections,
        totalExpenseAmount: totalExpense,
        overallProgressPercent: overallProgress,
        attachments,
        paidBy,
        status: statusToSet,
      };

      const res = await apiFetch('/api/project-reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setExistingReport(res.report);
      setActionMessage({
        type: 'success',
        text: isSubmitting
          ? '🎉 Project Daily Progress & Expense reports submitted successfully! Routed to office management.'
          : '💾 Draft successfully saved on server.',
      });

      await loadData();
      if (isSubmitting) {
        setActiveTab('history');
      }
    } catch (err) {
      console.error('Submission failed:', err);
      setActionMessage({
        type: 'error',
        text: 'Failed to submit: ' + (err.message || 'Network error'),
      });
    } finally {
      setSubmitting(false);
      setSavingDraft(false);
    }
  };

  const handleOpenReportStudioForIntake = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const branch = intakeForm.branchName?.trim() || 'Site Project';
    const client = intakeForm.clientName?.trim() || 'General Client';
    const poc = intakeForm.personOfContact?.trim() || user?.employeeName || 'Contact Person';

    setSubmittingIntake(true);
    try {
      const payload = {
        ticketId: intakeForm.ticketId ? Number(intakeForm.ticketId) : undefined,
        clientName: client,
        branchName: branch,
        personOfContact: poc,
        workNature: 'PROJECT',
        assignedEmployeeId: intakeForm.assignedEmployeeId ? Number(intakeForm.assignedEmployeeId) : user?.id,
        manualEnteredBy: user?.employeeName || 'Field Employee',
      };

      const res = await apiFetch('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const savedJob = res.job;
      await loadData();

      setIntakeForm({
        clientName: '',
        branchName: '',
        personOfContact: '',
        workNature: 'PROJECT',
        assignedEmployeeId: '',
        manualEnteredBy: '',
      });
      setIntakeTicketId('');

      setModalJobForReport(savedJob);
      setIsReportModalOpen(true);
      setActionMessage({
        type: 'success',
        text: `🎉 Job Serial #${savedJob.ticket?.serialNo || savedJob.id} generated! Please fill out the 9-Category Daily Progress Report & 11-Category Expense Report below.`,
      });
    } catch (err) {
      const fallbackJob = {
        id: Date.now(),
        clientName: client,
        branchName: branch,
        personOfContact: poc,
        workNature: 'PROJECT',
        ticket: {
          serialNo: 'PROJ-' + Date.now().toString().slice(-4),
          subject: 'Site Project Report',
        },
        assignedEmployee: user,
      };
      setModalJobForReport(fallbackJob);
      setIsReportModalOpen(true);
    } finally {
      setSubmittingIntake(false);
    }
  };

  const openJob = (job) => {
    setSelectedJob(job);
    setActionMessage({ type: '', text: '' });
    const matched = (mySubmissions || []).find((r) => r.jobMetadataId === job.id);
    setExistingReport(matched || null);
    initTemplates(matched || null);
    setReportTab('progress');
  };

  const closeJob = () => {
    setSelectedJob(null);
    setExistingReport(null);
    setActionMessage({ type: '', text: '' });
  };

  // ── Calculation Helpers ───────────────────────────────────────────────────
  const calculateTotalExpenses = () => {
    let sum = 0;
    expenseSections.forEach((sec) => {
      (sec.items || []).forEach((item) => {
        const val = parseFloat(item.amount);
        if (!isNaN(val) && val > 0) sum += val;
      });
    });
    return sum;
  };

  const calculateOverallProgress = () => {
    let total = 0;
    let count = 0;
    progressSections.forEach((sec) => {
      (sec.items || []).forEach((item) => {
        const val = parseFloat(item.workPercent);
        if (!isNaN(val)) {
          total += val;
          count++;
        }
      });
    });
    return count > 0 ? Math.round(total / count) : 0;
  };

  // Progress change handler
  const handleProgressChange = (secIndex, itemIndex, field, value) => {
    setProgressSections((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      clone[secIndex].items[itemIndex][field] = value;
      return clone;
    });
  };

  // Expense change handler
  const handleExpenseChange = (secIndex, itemIndex, field, value) => {
    setExpenseSections((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      clone[secIndex].items[itemIndex][field] = value;
      return clone;
    });
  };

  // Add custom row to an expense section
  const addExpenseCustomRow = (secIndex) => {
    setExpenseSections((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      const items = clone[secIndex].items;
      const nextLetter = String.fromCharCode(97 + items.length);
      items.push({
        code: nextLetter,
        name: '',
        qty: '',
        amount: '',
        others: '',
        isCustom: true,
      });
      return clone;
    });
  };

  // Add custom row to a progress section
  const addProgressCustomRow = (secIndex) => {
    setProgressSections((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      const items = clone[secIndex].items;
      const nextLetter = String.fromCharCode(97 + items.length);
      items.push({
        code: nextLetter,
        name: '',
        unit: 'Job',
        workPercent: '',
        remark: '',
        others: '',
        isCustom: true,
      });
      return clone;
    });
  };

  // Image / Bill upload handler (converts to persistent base64 data)
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target.result;
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            type: file.type,
            url: base64Data,
            uploadedAt: new Date().toISOString(),
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Save Draft or Submit Reports ──────────────────────────────────────────
  const handleSaveOrSubmit = async (statusToSet = 'SUBMITTED') => {
    if (!selectedJob) return;

    const isSubmitting = statusToSet === 'SUBMITTED';
    if (isSubmitting) {
      setSubmitting(true);
    } else {
      setSavingDraft(true);
    }
    setActionMessage({ type: '', text: '' });

    const totalExpense = calculateTotalExpenses();
    const overallProgress = calculateOverallProgress();

    try {
      const payload = {
        jobMetadataId: selectedJob.id,
        branchName: selectedJob.branchName,
        reportDate,
        expenseData: expenseSections,
        progressData: progressSections,
        totalExpenseAmount: totalExpense,
        overallProgressPercent: overallProgress,
        attachments,
        paidBy,
        status: statusToSet,
      };

      const res = await apiFetch('/api/project-reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setExistingReport(res.report);
      setActionMessage({
        type: 'success',
        text: isSubmitting
          ? '🎉 Project reports & expenses successfully submitted to office management!'
          : '💾 Draft successfully saved on server.',
      });

      // Refresh background submissions
      const reportsRes = await apiFetch('/api/project-reports?myReports=true');
      setMySubmissions(reportsRes.reports || []);
    } catch (err) {
      console.error('Submission failed:', err);
      setActionMessage({
        type: 'error',
        text: 'Failed to submit: ' + (err.message || 'Network error'),
      });
    } finally {
      setSubmitting(false);
      setSavingDraft(false);
    }
  };

  // ── PDF Exports ───────────────────────────────────────────────────────────
  const handleDownloadExpensePdf = async () => {
    if (!selectedJob) return;
    setDownloadingPdf(true);
    try {
      await downloadExpenseReportPdf({
        job: selectedJob,
        reportDate,
        sections: expenseSections,
        totalExpenseAmount: calculateTotalExpenses(),
        paidBy,
        employeeName: user?.employeeName,
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: 'PDF export failed: ' + err.message });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadProgressPdf = async () => {
    if (!selectedJob) return;
    setDownloadingPdf(true);
    try {
      await downloadProgressReportPdf({
        job: selectedJob,
        reportDate,
        sections: progressSections,
        overallProgressPercent: calculateOverallProgress(),
        employeeName: user?.employeeName,
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: 'PDF export failed: ' + err.message });
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Filtering assigned jobs
  const filteredJobs = jobs.filter((j) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      j.clientName?.toLowerCase().includes(q) ||
      j.branchName?.toLowerCase().includes(q) ||
      j.workNature?.toLowerCase().includes(q) ||
      j.ticket?.serialNo?.toLowerCase().includes(q) ||
      j.ticket?.subject?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (jobId) => {
    const report = mySubmissions.find((r) => r.jobMetadataId === jobId);
    if (!report) {
      return <span style={{ background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>NOT STARTED</span>;
    }
    if (report.status === 'APPROVED') {
      return <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>✅ APPROVED</span>;
    }
    if (report.status === 'CORRECTION_REQUIRED') {
      return <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>⚠️ CORRECTION REQUIRED</span>;
    }
    if (report.status === 'SUBMITTED') {
      return <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>📩 SUBMITTED</span>;
    }
    return <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>📝 DRAFT SAVED</span>;
  };

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '16px', minHeight: '100vh' }}>
      {/* ── Top Field Header ─────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 18px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <HardHat size={22} color="#34d399" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#f8fafc', letterSpacing: 0.5 }}>
              NEXUS FIELD PORTAL
            </div>
            <div style={{ fontSize: 12, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }}></span>
              {user?.employeeName || 'Field Engineer'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="nexus-btn"
            style={{
              padding: '8px 14px',
              fontSize: 12,
              background: activeTab === 'gmails' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('gmails')}
            title="Browse all incoming emails taken by office batches or pending"
          >
            <Mail size={15} />
            <span>📧 All Gmails ({allTickets.length})</span>
          </button>
          <button
            type="button"
            className="nexus-btn"
            style={{
              padding: '8px 16px',
              fontSize: 12,
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: 'none',
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)',
              cursor: 'pointer',
            }}
            onClick={() => {
              handleAutoOpenProjectScreen();
            }}
            title="Open 9-Category Progress & 11-Category Expense Report Entry Screen"
          >
            <HardHat size={15} />
            <span>⭐ Fill Project Categories (9 &amp; 11 Categories)</span>
          </button>
          <button
            type="button"
            className="nexus-btn"
            style={{
              padding: '8px 14px',
              fontSize: 12,
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: 'none',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
            }}
            onClick={() => openLogExpenseModal()}
            title="Log quick site operational expense claim"
          >
            <Receipt size={14} />
            <span>Log Field Expense</span>
          </button>
          <button
            type="button"
            className="nexus-btn nexus-btn-ghost"
            style={{ padding: '8px 12px', fontSize: 12 }}
            onClick={loadData}
            title="Refresh assigned jobs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span style={{ marginLeft: 4 }}>Sync</span>
          </button>
          <button
            type="button"
            className="nexus-btn nexus-btn-ghost"
            style={{ padding: '8px 12px', fontSize: 12, color: '#f87171' }}
            onClick={logout}
          >
            <LogOut size={14} />
            <span style={{ marginLeft: 4 }}>Logout</span>
          </button>
        </div>
      </header>

      {/* ── Action Notification Banner ───────────────────────────────────── */}
      {actionMessage.text && (
        <div
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 13,
            background: actionMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            color: actionMessage.type === 'error' ? '#f87171' : '#4ade80',
            border: `1px solid ${actionMessage.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{actionMessage.text}</span>
          <button
            type="button"
            onClick={() => setActionMessage({ type: '', text: '' })}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── VIEW 1: ACTIVE JOB REPORT WORKSPACE ─────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {selectedJob ? (
        <div>
          {/* Header Bar with Back Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <button
              type="button"
              className="nexus-btn nexus-btn-ghost"
              onClick={closeJob}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
            >
              <ArrowLeft size={16} /> Back to Assigned Jobs
            </button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {getStatusBadge(selectedJob.id)}
              {existingReport && (
                <span style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 4 }}>
                  Version {existingReport.version}
                </span>
              )}
            </div>
          </div>

          {/* Job & Email Details Card */}
          <div className="glass-card" style={{ marginBottom: 20, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', color: '#00f2fe', fontSize: 13, fontWeight: 'bold' }}>
                    Serial #{selectedJob.ticket?.serialNo || selectedJob.id}
                  </span>
                  <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                    {selectedJob.workNature}
                  </span>
                </div>
                <h2 style={{ fontSize: 18, color: '#f8fafc', margin: '4px 0 8px 0' }}>
                  {selectedJob.branchName}
                </h2>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>
                  Client: <strong style={{ color: '#e2e8f0' }}>{selectedJob.clientName}</strong> | POC: <strong style={{ color: '#e2e8f0' }}>{selectedJob.personOfContact}</strong>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                <div>Date: {selectedJob.ticket?.exactDate ? new Date(selectedJob.ticket.exactDate).toLocaleDateString() : '—'}</div>
                <div>Time: {selectedJob.ticket?.time || '—'}</div>
              </div>
            </div>

            {/* Email Subject Section */}
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mail size={12} /> Originating Email Subject & Instructions
              </div>
              <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>
                {selectedJob.ticket?.subject || 'No description provided'}
              </div>
              {selectedJob.ticket?.sender && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  From: {selectedJob.ticket.sender}
                </div>
              )}
            </div>

            {/* Reviewer Comments Warning (if correction requested) */}
            {existingReport?.status === 'CORRECTION_REQUIRED' && existingReport.reviewerNotes && (
              <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f87171', fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>
                  <AlertCircle size={16} /> Office Reviewer Feedback & Correction Required:
                </div>
                <div style={{ fontSize: 13, color: '#fca5a5' }}>
                  {existingReport.reviewerNotes}
                </div>
              </div>
            )}
          </div>

          {/* Report Tab Navigation */}
          <div className="tab-segment" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className={`tab-segment-btn ${reportTab === 'progress' ? 'active-field' : ''}`}
              onClick={() => setReportTab('progress')}
            >
              1. Daily Progress Report
            </button>
            <button
              type="button"
              className={`tab-segment-btn ${reportTab === 'expense' ? 'active-field' : ''}`}
              onClick={() => setReportTab('expense')}
            >
              2. Project Expense Report
            </button>
            <button
              type="button"
              className={`tab-segment-btn ${reportTab === 'attachments' ? 'active-field' : ''}`}
              onClick={() => setReportTab('attachments')}
            >
              3. Bills & Receipts ({attachments.length})
            </button>
            {existingReport?.audits?.length > 0 && (
              <button
                type="button"
                className={`tab-segment-btn ${reportTab === 'audit' ? 'active-field' : ''}`}
                onClick={() => setReportTab('audit')}
              >
                4. Audit Trail
              </button>
            )}
          </div>

          {/* ── TAB 1: DAILY PROGRESS REPORT ──────────────────────────────── */}
          {reportTab === 'progress' && (
            <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc' }}>
                    progress report {selectedJob.branchName}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>
                    Recreation of official 9-category progress inspection sheet
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '6px 14px', borderRadius: 8, fontWeight: 'bold', fontSize: 14 }}>
                    Overall Progress: {calculateOverallProgress()}%
                  </div>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={handleDownloadProgressPdf}
                    disabled={downloadingPdf}
                  >
                    <Download size={13} /> {downloadingPdf ? 'Exporting...' : 'PDF'}
                  </button>
                </div>
              </div>

              {/* Progress Sections Accordion/Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {progressSections.map((sec, secIdx) => {
                  let secTotal = 0;
                  let secCount = 0;
                  (sec.items || []).forEach((it) => {
                    const p = parseFloat(it.workPercent);
                    if (!isNaN(p)) {
                      secTotal += p;
                      secCount++;
                    }
                  });
                  const secAvg = secCount > 0 ? Math.round(secTotal / secCount) : 0;

                  return (
                    <div key={sec.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#38bdf8' }}>
                          {sec.id}. {sec.title} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>({sec.subtitle})</span>
                        </div>
                        <div style={{ fontSize: 12, color: secAvg > 0 ? '#34d399' : '#64748b', fontWeight: 600 }}>
                          Section Progress: {secAvg}%
                        </div>
                      </div>

                      {/* Items Table */}
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                              <th style={{ width: 35, padding: '6px 4px' }}>Sr</th>
                              <th style={{ padding: '6px 8px', minWidth: 160 }}>Type of work</th>
                              <th style={{ width: 70, padding: '6px 6px' }}>Unit</th>
                              <th style={{ width: 85, padding: '6px 6px' }}>Work%</th>
                              <th style={{ minWidth: 120, padding: '6px 8px' }}>Remak</th>
                              <th style={{ minWidth: 120, padding: '6px 8px' }}>Others</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sec.items.map((item, itIdx) => (
                              <tr key={itIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ color: '#64748b', padding: '6px 4px', fontFamily: 'monospace' }}>
                                  {item.code}
                                </td>
                                <td style={{ padding: '6px 8px', color: '#e2e8f0' }}>
                                  {item.isCustom ? (
                                    <input
                                      className="nexus-input"
                                      style={{ padding: '4px 8px', fontSize: 12, height: 28 }}
                                      placeholder="Add description..."
                                      value={item.name}
                                      onChange={(e) => handleProgressChange(secIdx, itIdx, 'name', e.target.value)}
                                    />
                                  ) : (
                                    item.name
                                  )}
                                </td>
                                <td style={{ padding: '6px 6px' }}>
                                  <input
                                    className="nexus-input"
                                    style={{ padding: '4px 6px', fontSize: 12, height: 28, width: '100%' }}
                                    placeholder="unit"
                                    value={item.unit}
                                    onChange={(e) => handleProgressChange(secIdx, itIdx, 'unit', e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: '6px 6px' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="nexus-input"
                                    style={{ padding: '4px 6px', fontSize: 12, height: 28, width: '100%', color: item.workPercent ? '#34d399' : 'inherit', fontWeight: 600 }}
                                    placeholder="0%"
                                    value={item.workPercent}
                                    onChange={(e) => handleProgressChange(secIdx, itIdx, 'workPercent', e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px' }}>
                                  <input
                                    className="nexus-input"
                                    style={{ padding: '4px 8px', fontSize: 12, height: 28, width: '100%' }}
                                    placeholder="Remark..."
                                    value={item.remark}
                                    onChange={(e) => handleProgressChange(secIdx, itIdx, 'remark', e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px' }}>
                                  <input
                                    className="nexus-input"
                                    style={{ padding: '4px 8px', fontSize: 12, height: 28, width: '100%' }}
                                    placeholder="Other notes..."
                                    value={item.others}
                                    onChange={(e) => handleProgressChange(secIdx, itIdx, 'others', e.target.value)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        type="button"
                        onClick={() => addProgressCustomRow(secIdx)}
                        style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 12, marginTop: 8, cursor: 'pointer', padding: '4px 0' }}
                      >
                        + Add Custom Row in {sec.title}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB 2: PROJECT EXPENSE REPORT ─────────────────────────────── */}
          {reportTab === 'expense' && (
            <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc' }}>
                    UBL Bank branch ({selectedJob.branchName}) Expense Sheet
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>
                    Exact 11-category construction & site cost reporting template
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '6px 14px', borderRadius: 8, fontWeight: 'bold', fontSize: 14 }}>
                    Grand Total: Rs. {calculateTotalExpenses().toLocaleString()}
                  </div>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={handleDownloadExpensePdf}
                    disabled={downloadingPdf}
                  >
                    <Download size={13} /> {downloadingPdf ? 'Exporting...' : 'PDF'}
                  </button>
                </div>
              </div>

              {/* Paid By Selection & Report Date */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 18, background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label className="field-label">Expense Incurred / Paid By</label>
                  <select
                    className="nexus-select"
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                  >
                    <option value="FES">FES Direct / Office Advance</option>
                    <option value="EMPLOYEE">Field Employee Out-of-Pocket Claim</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label className="field-label">Report Date</label>
                  <input
                    type="date"
                    className="nexus-input"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                  />
                </div>
              </div>

              {/* 11 Expense Categories */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {expenseSections.map((sec, secIdx) => {
                  let secTotal = 0;
                  (sec.items || []).forEach((it) => {
                    const a = parseFloat(it.amount);
                    if (!isNaN(a) && a > 0) secTotal += a;
                  });

                  return (
                    <div key={sec.id} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#38bdf8' }}>
                          {sec.id}. {sec.title} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>({sec.subtitle})</span>
                        </div>
                        <div style={{ fontSize: 12, color: secTotal > 0 ? '#38bdf8' : '#64748b', fontWeight: 600 }}>
                          Subtotal: Rs. {secTotal.toLocaleString()}
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                              <th style={{ width: 35, padding: '6px 4px' }}>Sr</th>
                              <th style={{ padding: '6px 8px', minWidth: 160 }}>Type of work</th>
                              <th style={{ width: 80, padding: '6px 6px' }}>Qty</th>
                              <th style={{ width: 110, padding: '6px 6px' }}>Amount (Rs)</th>
                              <th style={{ minWidth: 140, padding: '6px 8px' }}>Others / Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sec.items.map((item, itIdx) => (
                              <tr key={itIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ color: '#64748b', padding: '6px 4px', fontFamily: 'monospace' }}>
                                  {item.code}
                                </td>
                                <td style={{ padding: '6px 8px', color: '#e2e8f0' }}>
                                  {item.isCustom ? (
                                    <input
                                      className="nexus-input"
                                      style={{ padding: '4px 8px', fontSize: 12, height: 28 }}
                                      placeholder="Add item name..."
                                      value={item.name}
                                      onChange={(e) => handleExpenseChange(secIdx, itIdx, 'name', e.target.value)}
                                    />
                                  ) : (
                                    item.name
                                  )}
                                </td>
                                <td style={{ padding: '6px 6px' }}>
                                  <input
                                    className="nexus-input"
                                    style={{ padding: '4px 6px', fontSize: 12, height: 28, width: '100%' }}
                                    placeholder="Qty"
                                    value={item.qty}
                                    onChange={(e) => handleExpenseChange(secIdx, itIdx, 'qty', e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: '6px 6px' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    className="nexus-input"
                                    style={{ padding: '4px 6px', fontSize: 12, height: 28, width: '100%', color: item.amount ? '#38bdf8' : 'inherit', fontWeight: 600 }}
                                    placeholder="Rs."
                                    value={item.amount}
                                    onChange={(e) => handleExpenseChange(secIdx, itIdx, 'amount', e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: '6px 8px' }}>
                                  <input
                                    className="nexus-input"
                                    style={{ padding: '4px 8px', fontSize: 12, height: 28, width: '100%' }}
                                    placeholder="Remarks / details..."
                                    value={item.others}
                                    onChange={(e) => handleExpenseChange(secIdx, itIdx, 'others', e.target.value)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button
                        type="button"
                        onClick={() => addExpenseCustomRow(secIdx)}
                        style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 12, marginTop: 8, cursor: 'pointer', padding: '4px 0' }}
                      >
                        + Add Custom Row in {sec.title}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB 3: BILLS & RECEIPTS ATTACHMENTS ──────────────────────── */}
          {reportTab === 'attachments' && (
            <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc' }}>
                    Supporting Bills, Invoices & Site Photos
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>
                    Attach proof for labor, material purchases, and vendor receipts
                  </p>
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-primary"
                    style={{ padding: '8px 14px', fontSize: 12 }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={14} /> Upload Bills / Photos
                  </button>
                </div>
              </div>

              {attachments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b', background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <Camera size={36} color="#64748b" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  <div>No receipts attached yet.</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Tap "Upload Bills / Photos" to attach camera shots or files.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {attachments.map((att, idx) => (
                    <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                      {att.url && att.url.startsWith('data:image') ? (
                        <img src={att.url} alt={att.name} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)' }}>
                          <FileText size={36} color="#38bdf8" />
                        </div>
                      )}
                      <div style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, maxWidth: 140 }}>
                          {att.name || `Attachment #${idx + 1}`}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: AUDIT TRAIL ────────────────────────────────────────── */}
          {reportTab === 'audit' && existingReport && (
            <div className="glass-card" style={{ padding: 18, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: 16, color: '#f8fafc' }}>
                Submission & Review Audit Trail
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(existingReport.audits || []).map((audit) => (
                  <div key={audit.id} style={{ padding: 12, background: 'rgba(0,0,0,0.25)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: audit.action === 'APPROVED' ? '#4ade80' : audit.action.includes('CORRECTION') ? '#f87171' : '#38bdf8' }}>
                          {audit.action}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>v{audit.version}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                        {audit.comment || 'Status updated'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
                      <div>By: {audit.changedByName || 'System'}</div>
                      <div>{new Date(audit.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STICKY BOTTOM ACTION BAR ──────────────────────────────────── */}
          <div
            style={{
              position: 'sticky',
              bottom: 12,
              zIndex: 30,
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(16px)',
              padding: '12px 18px',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Overall Summary:</div>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: '#f8fafc' }}>
                Progress: <span style={{ color: '#34d399' }}>{calculateOverallProgress()}%</span> | Total Expense: <span style={{ color: '#38bdf8' }}>Rs. {calculateTotalExpenses().toLocaleString()}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={() => handleSaveOrSubmit('IN_PROGRESS')}
                disabled={savingDraft || submitting}
                style={{ padding: '10px 16px', fontSize: 13 }}
              >
                <Save size={15} /> {savingDraft ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                type="button"
                className="nexus-btn nexus-btn-primary"
                onClick={() => handleSaveOrSubmit('SUBMITTED')}
                disabled={submitting || savingDraft}
                style={{
                  padding: '10px 20px',
                  fontSize: 13,
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  fontWeight: 600,
                }}
              >
                <Send size={15} /> {submitting ? 'Submitting...' : existingReport?.status === 'CORRECTION_REQUIRED' ? 'Resubmit Corrected Report' : 'Submit Reports'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════════════ */
        /* ── VIEW 2: ASSIGNED JOBS LIST & HISTORY ────────────────────────── */
        /* ════════════════════════════════════════════════════════════════════ */
        <div>
          {/* View Tab Switcher */}
          <div className="tab-segment" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 6 }}>
            <button
              type="button"
              className={`tab-segment-btn ${activeTab === 'jobs' ? 'active-field' : ''}`}
              onClick={() => setActiveTab('jobs')}
            >
              <Briefcase size={15} style={{ display: 'inline', marginRight: 4 }} /> My Assigned Jobs ({jobs.length})
            </button>
            <button
              type="button"
              className={`tab-segment-btn ${activeTab === 'gmails' ? 'active-field' : ''}`}
              onClick={() => setActiveTab('gmails')}
              style={{
                borderColor: activeTab === 'gmails' ? '#38bdf8' : 'rgba(56, 189, 248, 0.4)',
                color: activeTab === 'gmails' ? '#38bdf8' : '#7dd3fc',
                fontWeight: 600,
              }}
            >
              <Mail size={15} style={{ display: 'inline', marginRight: 4 }} /> 📧 All Gmails Feed ({allTickets.length})
            </button>
            <button
              type="button"
              className={`tab-segment-btn ${activeTab === 'project-categories' ? 'active-field' : ''}`}
              onClick={() => setActiveTab('project-categories')}
              style={{
                borderColor: activeTab === 'project-categories' ? '#34d399' : 'rgba(52, 211, 153, 0.4)',
                color: activeTab === 'project-categories' ? '#34d399' : '#a7f3d0'
              }}
            >
              <HardHat size={15} style={{ display: 'inline', marginRight: 4 }} />
              ⭐ Project Reports &amp; Expenses (9 &amp; 11 Categories)
            </button>
            <button
              type="button"
              className={`tab-segment-btn ${activeTab === 'intake' ? 'active-field' : ''}`}
              onClick={() => setActiveTab('intake')}
            >
              <PlusCircle size={15} style={{ display: 'inline', marginRight: 4 }} /> Job Intake
            </button>
            <button
              type="button"
              className={`tab-segment-btn ${activeTab === 'history' ? 'active-field' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={15} style={{ display: 'inline', marginRight: 4 }} /> Submitted Reports &amp; Expenses ({mySubmissions.length})
            </button>
          </div>

          {activeTab === 'jobs' ? (
            <div>
              {/* Search Bar */}
              <div style={{ marginBottom: 16 }}>
                <input
                  className="nexus-input"
                  placeholder="Search assigned jobs by branch, client, serial, subject..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px' }}
                />
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
                  Loading your assigned jobs...
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
                  <CheckCircle2 size={40} color="#34d399" style={{ margin: '0 auto 12px auto' }} />
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
                    {searchTerm ? 'No matching jobs found' : 'No Assigned Jobs'}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {searchTerm ? 'Try a different search term.' : 'Office management will assign jobs to your portal, or you can intake one from the Job Intake tab.'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {filteredJobs.map((job) => {
                    const submission = mySubmissions.find((r) => r.jobMetadataId === job.id);
                    return (
                      <div
                        key={job.id}
                        className="glass-card"
                        style={{
                          padding: 18,
                          transition: 'transform 0.15s, border-color 0.15s',
                          cursor: 'pointer',
                          borderColor: submission?.status === 'CORRECTION_REQUIRED' ? 'rgba(239, 68, 68, 0.4)' : undefined,
                        }}
                        onClick={() => openJob(job)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 600, fontSize: 13 }}>
                                Serial #{job.ticket?.serialNo || job.id}
                              </span>
                              <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                {job.workNature}
                              </span>
                            </div>
                            <h3 style={{ margin: '2px 0 4px 0', fontSize: 16, color: '#f8fafc' }}>
                              {job.branchName}
                            </h3>
                            <div style={{ fontSize: 13, color: '#94a3b8' }}>
                              Client: <strong style={{ color: '#e2e8f0' }}>{job.clientName}</strong>
                            </div>
                          </div>
                          <div>
                            {getStatusBadge(job.id)}
                          </div>
                        </div>

                        {/* Originating Email Subject */}
                        <div style={{ margin: '10px 0', padding: '8px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: 6, fontSize: 12, color: '#cbd5e1' }}>
                          <span style={{ color: '#64748b', marginRight: 6 }}>Email Subject:</span>
                          {job.ticket?.subject || '—'}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 12, color: '#64748b', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 14 }}>
                            <span>POC: {job.personOfContact || '—'}</span>
                            <span>Date: {job.ticket?.exactDate ? new Date(job.ticket.exactDate).toLocaleDateString() : '—'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="nexus-btn"
                              style={{
                                padding: '5px 12px',
                                fontSize: 11,
                                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                color: '#ffffff',
                                fontWeight: 700,
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                                cursor: 'pointer',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openProjectReportModalForJob(job);
                              }}
                            >
                              <HardHat size={12} /> ⭐ Fill Project Categories (9 &amp; 11)
                            </button>
                            <button
                              type="button"
                              className="nexus-btn nexus-btn-ghost"
                              style={{ padding: '4px 10px', fontSize: 11, color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openLogExpenseModal(job);
                              }}
                            >
                              <Receipt size={12} /> Log Expense
                            </button>
                            <div style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              Open Reports <ChevronRight size={14} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'gmails' ? (
            /* ════════════════════════════════════════════════════════════════ */
            /* ── VIEW 2.5: ALL INCOMING GMAILS FEED (PENDING & TAKEN) ──────── */
            /* ════════════════════════════════════════════════════════════════ */
            <div>
              {/* Header Card with Filter Buttons */}
              <div className="glass-card" style={{ marginBottom: 20, padding: 20, border: '1px solid rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                      <Mail size={24} color="#38bdf8" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 18, color: '#f8fafc', margin: 0, fontWeight: 700 }}>
                        📧 All Incoming Gmails Feed (Pending &amp; Taken)
                      </h2>
                      <p style={{ margin: '3px 0 0 0', fontSize: 12, color: '#94a3b8' }}>
                        Browse all emails taken by office employees (Batch 1, etc.) or pending. Click <strong>⭐ Put Details as Project</strong> to attach your site progress &amp; expenses. The responsible office staff will be automatically notified!
                      </p>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`nexus-btn ${gmailFilterType === 'all' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                      style={{ fontSize: 12, padding: '6px 14px' }}
                      onClick={() => setGmailFilterType('all')}
                    >
                      All Gmails ({allTickets.length})
                    </button>
                    <button
                      type="button"
                      className={`nexus-btn ${gmailFilterType === 'taken' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                      style={{
                        fontSize: 12,
                        padding: '6px 14px',
                        borderColor: gmailFilterType === 'taken' ? '#34d399' : 'rgba(52, 211, 153, 0.3)',
                        background: gmailFilterType === 'taken' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                        color: gmailFilterType === 'taken' ? '#34d399' : '#cbd5e1',
                      }}
                      onClick={() => setGmailFilterType('taken')}
                    >
                      ✅ Taken by Office ({allTickets.filter((t) => t.jobMetadata).length})
                    </button>
                    <button
                      type="button"
                      className={`nexus-btn ${gmailFilterType === 'pending' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                      style={{
                        fontSize: 12,
                        padding: '6px 14px',
                        borderColor: gmailFilterType === 'pending' ? '#fbbf24' : 'rgba(251, 191, 36, 0.3)',
                        background: gmailFilterType === 'pending' ? 'rgba(245, 158, 11, 0.25)' : 'transparent',
                        color: gmailFilterType === 'pending' ? '#fbbf24' : '#cbd5e1',
                      }}
                      onClick={() => setGmailFilterType('pending')}
                    >
                      ⏳ Pending ({allTickets.filter((t) => !t.jobMetadata).length})
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: 12, top: 13, color: '#64748b' }} />
                  <input
                    className="nexus-input"
                    placeholder="Search by subject, sender, client, branch, office employee (Batch 1, etc.), or ticket serial #..."
                    value={gmailSearchTerm}
                    onChange={(e) => setGmailSearchTerm(e.target.value)}
                    style={{ width: '100%', paddingLeft: 36, fontSize: 13, padding: '10px 14px 10px 36px' }}
                  />
                </div>
              </div>

              {/* List of Tickets */}
              {filteredAllTickets.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
                  <Mail size={40} color="#64748b" style={{ margin: '0 auto 12px auto' }} />
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
                    {gmailSearchTerm ? 'No matching Gmails found' : 'No Gmails available'}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {gmailSearchTerm ? 'Try searching by a different keyword.' : 'Gmails synced from accounts will appear here.'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {filteredAllTickets.map((ticket) => {
                    const isTaken = !!ticket.jobMetadata;
                    const takerName = ticket.jobMetadata?.createdBy?.employeeName || ticket.jobMetadata?.manualEnteredBy || 'Office Staff';
                    const pReport = ticket.jobMetadata?.projectReports?.[0];

                    return (
                      <div
                        key={ticket.id}
                        className="glass-card"
                        style={{
                          padding: 18,
                          border: isTaken ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(251, 191, 36, 0.3)',
                          background: isTaken ? 'rgba(16, 185, 129, 0.03)' : 'rgba(245, 158, 11, 0.03)',
                          transition: 'border-color 0.15s',
                        }}
                      >
                        {/* Top Row: Serial, Status Badge, Ingest Details */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 700, fontSize: 14 }}>
                              #{ticket.serialNo}
                            </span>
                            {isTaken ? (
                              <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.35)', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                                ✅ TAKEN BY: {takerName}
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                                ⏳ PENDING / UNASSIGNED
                              </span>
                            )}
                            {ticket.jobMetadata?.workNature && (
                              <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                {ticket.jobMetadata.workNature}
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right' }}>
                            <div>📅 {new Date(ticket.exactDate).toLocaleDateString()} {ticket.time ? `· ${ticket.time}` : ''}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Box: {ticket.gmailAccount?.gmailEmail || 'Direct Ingest'}</div>
                          </div>
                        </div>

                        {/* Originating Subject */}
                        <div style={{ margin: '8px 0', padding: '10px 14px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                            Email Subject:
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>
                            {ticket.subject || '(No Subject)'}
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                            From: <strong style={{ color: '#cbd5e1' }}>{ticket.sender}</strong>
                          </div>
                        </div>

                        {/* Job Metadata details if taken */}
                        {isTaken && (
                          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#94a3b8', marginBottom: 10, padding: '6px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                            <span>Client: <strong style={{ color: '#f8fafc' }}>{ticket.jobMetadata.clientName}</strong></span>
                            <span>Branch: <strong style={{ color: '#f8fafc' }}>{ticket.jobMetadata.branchName}</strong></span>
                            <span>POC: <strong style={{ color: '#f8fafc' }}>{ticket.jobMetadata.personOfContact || '—'}</strong></span>
                          </div>
                        )}

                        {/* Attached Project Reports or Expenses summary */}
                        {pReport && (
                          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 6, border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <span style={{ color: '#94a3b8' }}>Site Progress: </span>
                              <strong style={{ color: '#34d399' }}>{Math.round(pReport.overallProgressPercent)}%</strong>
                              <span style={{ color: '#64748b', margin: '0 8px' }}>|</span>
                              <span style={{ color: '#94a3b8' }}>Total Expenses: </span>
                              <strong style={{ color: '#38bdf8' }}>Rs. {pReport.totalExpenseAmount.toLocaleString()}</strong>
                            </div>
                            <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                              {pReport.status}
                            </span>
                          </div>
                        )}

                        {/* Actions Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {isTaken
                              ? `Matching work? Add your project report & expenses directly. ${takerName} will be notified.`
                              : 'Unassigned email. You can take it as a project and record your site expenses.'}
                          </div>

                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button
                              type="button"
                              className="nexus-btn nexus-btn-ghost"
                              style={{ padding: '6px 12px', fontSize: 11, color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}
                              onClick={() => openLogExpenseModal(ticket.jobMetadata || { id: ticket.id, branchName: ticket.subject })}
                            >
                              <Receipt size={13} /> Log Quick Expense
                            </button>

                            <button
                              type="button"
                              className="nexus-btn"
                              style={{
                                padding: '7px 16px',
                                fontSize: 12,
                                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                color: '#ffffff',
                                fontWeight: 700,
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                                cursor: 'pointer',
                              }}
                              onClick={() => handleOpenProjectForTicket(ticket)}
                            >
                              <HardHat size={14} /> ⭐ Put Details as Project (9 &amp; 11 Categories)
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'intake' ? (
            /* ════════════════════════════════════════════════════════════════ */
            /* ── VIEW 3: FIELD JOB INTAKE & PROJECT PROMPT ─────────────────── */
            /* ════════════════════════════════════════════════════════════════ */
            <div>
              <div className="glass-card" style={{ marginBottom: 20, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h2 style={{ fontSize: 18, color: '#f8fafc', margin: 0, fontWeight: 700 }}>
                      Field Job & Project Intake
                    </h2>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0 0' }}>
                      Enter site intake from incoming tickets or direct site work. Selecting <strong>Project</strong> automatically opens the digital reports prompt.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    style={{ padding: '8px 14px', fontSize: 12, color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setShowManualTicketModal(true)}
                  >
                    <Plus size={14} /> + Manual Site Ticket
                  </button>
                </div>

                {/* Ticket Selection Area */}
                <div style={{ marginBottom: 20, padding: 18, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: 13, color: '#38bdf8', fontWeight: 700 }}>
                        <Mail size={15} color="#38bdf8" /> 1. Link Incoming Email / Ticket (Showing Both Taken &amp; Pending)
                      </label>
                      <p style={{ margin: '3px 0 0 0', fontSize: 11, color: '#94a3b8' }}>
                        Choose any email matching your site work. Even if already taken by office operations (Shahzaib, Rizwan, Batch 1), you can attach site reports &amp; expenses to notify them!
                      </p>
                    </div>

                    {/* Filter Pills */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setIntakeFilterType('all')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: intakeFilterType === 'all' ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                          color: intakeFilterType === 'all' ? '#0f172a' : '#cbd5e1',
                          border: 'none',
                          transition: 'all 0.15s',
                        }}
                      >
                        All Emails ({allTickets.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setIntakeFilterType('taken')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: intakeFilterType === 'taken' ? '#10b981' : 'rgba(255,255,255,0.06)',
                          color: intakeFilterType === 'taken' ? '#ffffff' : '#34d399',
                          border: 'none',
                          transition: 'all 0.15s',
                        }}
                      >
                        ✅ Taken by Office ({allTickets.filter(t => !!t.jobMetadata).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setIntakeFilterType('pending')}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: intakeFilterType === 'pending' ? '#f59e0b' : 'rgba(255,255,255,0.06)',
                          color: intakeFilterType === 'pending' ? '#0f172a' : '#fbbf24',
                          border: 'none',
                          transition: 'all 0.15s',
                        }}
                      >
                        ⏳ Pending ({allTickets.filter(t => !t.jobMetadata).length})
                      </button>
                    </div>
                  </div>

                  {/* Dropdown & Search Bar */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                    <select
                      className="nexus-select"
                      value={intakeTicketId}
                      onChange={(e) => handleIntakeTicketChange(e.target.value)}
                      style={{ flex: 1, minWidth: 260, fontSize: 13, borderColor: intakeTicketId ? '#10b981' : undefined }}
                    >
                      <option value="">
                        — Select Email / Ticket ({filteredIntakeTickets.length} available: Taken by Office &amp; Pending) —
                      </option>
                      {filteredIntakeTickets.map((t) => {
                        const isTaken = !!t.jobMetadata;
                        const taker = t.jobMetadata?.createdBy?.employeeName || t.jobMetadata?.manualEnteredBy || 'Office Staff';
                        const branch = t.jobMetadata?.branchName ? ` | ${t.jobMetadata.branchName}` : '';
                        return (
                          <option key={t.id} value={t.id}>
                            {isTaken ? `[✅ TAKEN by: ${taker}${branch}]` : '[⏳ PENDING]'} #{t.serialNo} — {t.subject} ({t.sender || 'Gmail'})
                          </option>
                        );
                      })}
                    </select>

                    <div style={{ position: 'relative', width: 240 }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: 12, color: '#64748b' }} />
                      <input
                        className="nexus-input"
                        style={{ paddingLeft: 30, fontSize: 12 }}
                        placeholder="Search tickets by name, subject, taker..."
                        value={intakeTicketSearch}
                        onChange={(e) => setIntakeTicketSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Selected Ticket Preview Banner */}
                  {selectedIntakeTicket && (
                    <div
                      style={{
                        padding: '14px 16px',
                        borderRadius: 10,
                        border: selectedIntakeTicket.jobMetadata ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(251, 191, 36, 0.4)',
                        background: selectedIntakeTicket.jobMetadata ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                        marginBottom: 14,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 700, fontSize: 13 }}>
                            #{selectedIntakeTicket.serialNo}
                          </span>
                          {selectedIntakeTicket.jobMetadata ? (
                            <span style={{ background: 'rgba(34, 197, 94, 0.25)', color: '#4ade80', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                              ✅ TAKEN BY OFFICE: {selectedIntakeTicket.jobMetadata?.createdBy?.employeeName || selectedIntakeTicket.jobMetadata?.manualEnteredBy || 'Office Staff'}
                            </span>
                          ) : (
                            <span style={{ background: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                              ⏳ PENDING / UNASSIGNED EMAIL
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            📅 {new Date(selectedIntakeTicket.exactDate).toLocaleDateString()}
                          </span>
                        </div>

                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', marginTop: 6 }}>
                          {selectedIntakeTicket.subject}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                          From: <strong style={{ color: '#cbd5e1' }}>{selectedIntakeTicket.sender}</strong>
                          {selectedIntakeTicket.jobMetadata?.clientName && (
                            <span style={{ marginLeft: 8 }}>| Client: <strong style={{ color: '#e2e8f0' }}>{selectedIntakeTicket.jobMetadata.clientName}</strong></span>
                          )}
                          {selectedIntakeTicket.jobMetadata?.branchName && (
                            <span style={{ marginLeft: 8 }}>| Branch: <strong style={{ color: '#e2e8f0' }}>{selectedIntakeTicket.jobMetadata.branchName}</strong></span>
                          )}
                        </div>

                        <div style={{ fontSize: 11, color: selectedIntakeTicket.jobMetadata ? '#86efac' : '#fde68a', marginTop: 4 }}>
                          {selectedIntakeTicket.jobMetadata
                            ? `ℹ️ Linked to office job. Submitting your project report/expenses here will automatically notify ${selectedIntakeTicket.jobMetadata.createdBy?.employeeName || 'the office employee'}.`
                            : 'ℹ️ Unassigned ticket. Claim this work and enter your site reports & expenses below.'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="nexus-btn"
                          style={{
                            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: 12,
                            padding: '8px 14px',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleOpenProjectForTicket(selectedIntakeTicket)}
                        >
                          <HardHat size={14} /> ⭐ Put Details as Project (9 &amp; 11 Categories)
                        </button>
                        <button
                          type="button"
                          className="nexus-btn nexus-btn-ghost"
                          style={{ padding: '7px 12px', fontSize: 11, color: '#cbd5e1' }}
                          onClick={() => {
                            setIntakeTicketId('');
                            setIntakeForm({
                              clientName: '',
                              branchName: '',
                              personOfContact: '',
                              workNature: '',
                              assignedEmployeeId: '',
                              manualEnteredBy: '',
                            });
                          }}
                        >
                          Clear Selection
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick-Pick Grid of Recent Emails (both Taken & Pending) */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>
                        ⚡ Quick Select from Recent Emails ({filteredIntakeTickets.slice(0, 8).length} of {filteredIntakeTickets.length}):
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowQuickPickGrid(!showQuickPickGrid)}
                        style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                      >
                        {showQuickPickGrid ? '▲ Collapse Quick Cards' : '▼ Expand Quick Cards'}
                      </button>
                    </div>

                    {showQuickPickGrid && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                        {filteredIntakeTickets.slice(0, 8).map((t) => {
                          const isTaken = !!t.jobMetadata;
                          const taker = t.jobMetadata?.createdBy?.employeeName || t.jobMetadata?.manualEnteredBy || 'Office Staff';
                          const isSelected = String(t.id) === String(intakeTicketId);

                          return (
                            <div
                              key={t.id}
                              style={{
                                padding: 12,
                                borderRadius: 8,
                                border: isSelected
                                  ? '2px solid #38bdf8'
                                  : isTaken
                                  ? '1px solid rgba(16, 185, 129, 0.3)'
                                  : '1px solid rgba(251, 191, 36, 0.3)',
                                background: isSelected
                                  ? 'rgba(56, 189, 248, 0.12)'
                                  : isTaken
                                  ? 'rgba(16, 185, 129, 0.04)'
                                  : 'rgba(245, 158, 11, 0.04)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: 8,
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                  <span style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 700, fontSize: 12 }}>
                                    #{t.serialNo}
                                  </span>
                                  {isTaken ? (
                                    <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                                      ✅ TAKEN: {taker}
                                    </span>
                                  ) : (
                                    <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                                      ⏳ PENDING
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.subject}>
                                  {t.subject || '(No Subject)'}
                                </div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  From: {t.sender}
                                </div>
                                {isTaken && (t.jobMetadata?.clientName || t.jobMetadata?.branchName) && (
                                  <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 4, background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: 4 }}>
                                    {t.jobMetadata.clientName || 'Client'} · {t.jobMetadata.branchName || 'Branch'}
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                <button
                                  type="button"
                                  className="nexus-btn nexus-btn-ghost"
                                  style={{
                                    flex: 1,
                                    padding: '5px 8px',
                                    fontSize: 11,
                                    borderColor: isSelected ? '#38bdf8' : 'rgba(255,255,255,0.15)',
                                    color: isSelected ? '#38bdf8' : '#e2e8f0',
                                    fontWeight: isSelected ? 700 : 500,
                                  }}
                                  onClick={() => handleIntakeTicketChange(String(t.id))}
                                >
                                  {isSelected ? '✓ Selected' : '👉 Select'}
                                </button>
                                <button
                                  type="button"
                                  className="nexus-btn"
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: 11,
                                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                  onClick={() => handleOpenProjectForTicket(t)}
                                  title="Put Details as Project (9 & 11 Categories)"
                                >
                                  <HardHat size={12} /> Project
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Intake Form Fields */}
                <form onSubmit={handleIntakeSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label className="field-label"><User size={12} style={{ display: 'inline', marginRight: 4 }} />Client Name</label>
                      <input
                        className="nexus-input"
                        required
                        placeholder="e.g. UBL Bank, FES"
                        value={intakeForm.clientName}
                        onChange={(e) => setIntakeForm({ ...intakeForm, clientName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="field-label"><Building size={12} style={{ display: 'inline', marginRight: 4 }} />Branch Name</label>
                      <input
                        className="nexus-input"
                        required
                        placeholder="e.g. UBL Mall Road Branch"
                        value={intakeForm.branchName}
                        onChange={(e) => setIntakeForm({ ...intakeForm, branchName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="field-label"><User size={12} style={{ display: 'inline', marginRight: 4 }} />Person of Contact</label>
                      <input
                        className="nexus-input"
                        required
                        placeholder="Branch contact person"
                        value={intakeForm.personOfContact}
                        onChange={(e) => setIntakeForm({ ...intakeForm, personOfContact: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="field-label"><Briefcase size={12} style={{ display: 'inline', marginRight: 4 }} />Work Nature</label>
                      <select
                        className="nexus-select"
                        required
                        value={intakeForm.workNature}
                        onChange={(e) => {
                          const val = e.target.value;
                          setIntakeForm((prev) => ({ ...prev, workNature: val }));
                          if (val === 'PROJECT') {
                            handleAutoOpenProjectScreen(intakeForm.branchName, intakeForm.clientName);
                          }
                        }}
                      >
                        <option value="">— Select Work Nature —</option>
                        <option value="ELECTRICAL">⚡ Electrical</option>
                        <option value="WAPDA">🔌 WAPDA</option>
                        <option value="MAINTENANCE">🔧 Maintenance</option>
                        <option value="PROJECT">⭐ Project (Prompts 2 PDF Reports)</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label"><HardHat size={12} style={{ display: 'inline', marginRight: 4 }} />Assigned Employee</label>
                      <select
                        className="nexus-select"
                        value={intakeForm.assignedEmployeeId || user?.id || ''}
                        onChange={(e) => setIntakeForm({ ...intakeForm, assignedEmployeeId: e.target.value })}
                      >
                        <option value={user?.id || ''}>[Me] {user?.employeeName || 'Current Field Tech'}</option>
                        {allEmployees.filter((e) => e.id !== user?.id).map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.role === 'FIELD_EMPLOYEE' ? `[Field] ${emp.employeeName}` : emp.employeeName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label"><User size={12} style={{ display: 'inline', marginRight: 4 }} />Entered By</label>
                      <input
                        className="nexus-input"
                        disabled
                        value={user?.employeeName || 'Field Employee'}
                      />
                    </div>
                  </div>

                  {/* Comprehensive Project Categories Hub */}
                  {intakeForm.workNature === 'PROJECT' && (
                    <div style={{
                      marginTop: 20,
                      padding: '20px',
                      borderRadius: 12,
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '2px solid rgba(16, 185, 129, 0.4)',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <HardHat size={26} color="#34d399" />
                          </div>
                          <div>
                            <div style={{ color: '#34d399', fontWeight: 800, fontSize: 16 }}>
                              ⭐ Project Work Nature Selected — 2 Digital Report Templates Active
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                              Review the official <strong>9 Progress Report Categories</strong> &amp; <strong>11 Project Expense Categories</strong> below:
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="nexus-btn"
                          style={{
                            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 13,
                            padding: '10px 18px',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer'
                          }}
                          onClick={handleOpenReportStudioForIntake}
                        >
                          <FileText size={16} />
                          🚀 Open &amp; Fill Both Reports (9 &amp; 11 Categories)
                        </button>
                      </div>

                      {/* Sub-tab switcher to inspect Progress (9) vs Expense (11) */}
                      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={`nexus-btn ${intakeCategoryPreviewTab === 'progress' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                          style={{
                            fontSize: 12,
                            padding: '8px 16px',
                            borderColor: intakeCategoryPreviewTab === 'progress' ? '#34d399' : 'rgba(52, 211, 153, 0.3)',
                            background: intakeCategoryPreviewTab === 'progress' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                            color: intakeCategoryPreviewTab === 'progress' ? '#34d399' : '#cbd5e1',
                            fontWeight: 700,
                          }}
                          onClick={() => setIntakeCategoryPreviewTab('progress')}
                        >
                          📋 Daily Progress Report (9 Categories)
                        </button>
                        <button
                          type="button"
                          className={`nexus-btn ${intakeCategoryPreviewTab === 'expense' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                          style={{
                            fontSize: 12,
                            padding: '8px 16px',
                            borderColor: intakeCategoryPreviewTab === 'expense' ? '#38bdf8' : 'rgba(56, 189, 248, 0.3)',
                            background: intakeCategoryPreviewTab === 'expense' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                            color: intakeCategoryPreviewTab === 'expense' ? '#38bdf8' : '#cbd5e1',
                            fontWeight: 700,
                          }}
                          onClick={() => setIntakeCategoryPreviewTab('expense')}
                        >
                          💰 Project Expense Report (11 Categories)
                        </button>
                      </div>

                      {/* Content: 9 Progress Categories */}
                      {intakeCategoryPreviewTab === 'progress' && (
                        <div>
                          <div style={{ fontSize: 13, color: '#34d399', fontWeight: 600, marginBottom: 10 }}>
                            9 Official Progress Inspection Categories:
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                            {PROJECT_PROGRESS_TEMPLATE.map((cat, idx) => (
                              <div
                                key={cat.id || idx}
                                style={{
                                  padding: '12px 14px',
                                  borderRadius: 8,
                                  background: 'rgba(0, 0, 0, 0.35)',
                                  border: '1px solid rgba(52, 211, 153, 0.2)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>
                                    {idx + 1}. {cat.title}
                                  </span>
                                  <span style={{ fontSize: 11, color: '#34d399', background: 'rgba(52, 211, 153, 0.15)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                                    {cat.items?.length || 0} items
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{cat.subtitle}</div>
                                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                  Includes: {cat.items?.slice(0, 4).map(i => i.name).filter(Boolean).join(', ')}...
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Content: 11 Expense Categories */}
                      {intakeCategoryPreviewTab === 'expense' && (
                        <div>
                          <div style={{ fontSize: 13, color: '#38bdf8', fontWeight: 600, marginBottom: 10 }}>
                            11 Official Construction Expense Categories:
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                            {PROJECT_EXPENSE_TEMPLATE.map((cat, idx) => (
                              <div
                                key={cat.id || idx}
                                style={{
                                  padding: '12px 14px',
                                  borderRadius: 8,
                                  background: 'rgba(0, 0, 0, 0.35)',
                                  border: '1px solid rgba(56, 189, 248, 0.2)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>
                                    {idx + 1}. {cat.title}
                                  </span>
                                  <span style={{ fontSize: 11, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                                    {cat.items?.length || 0} items
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{cat.subtitle}</div>
                                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                  Includes: {cat.items?.slice(0, 4).map(i => i.name).filter(Boolean).join(', ')}...
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="nexus-btn"
                          style={{
                            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 13,
                            padding: '10px 20px',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer'
                          }}
                          onClick={handleOpenReportStudioForIntake}
                        >
                          <Send size={15} />
                          🚀 Open &amp; Fill Both Reports (9 &amp; 11 Categories)
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="nexus-btn"
                    disabled={submittingIntake}
                    style={{
                      width: '100%',
                      marginTop: 20,
                      padding: '12px 20px',
                      background: intakeForm.workNature === 'PROJECT'
                        ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                        : 'linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 14,
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Send size={16} />
                    {submittingIntake
                      ? 'Generating Serial...'
                      : intakeForm.workNature === 'PROJECT'
                      ? 'Save Job & Open 9 Progress + 11 Expense Categories'
                      : 'Generate Serial & Save Metadata'}
                  </button>
                </form>
              </div>
            </div>
          ) : activeTab === 'project-categories' ? (
            /* ── VIEW 4: DEDICATED PROJECT PROGRESS (9) & EXPENSE (11) ENTRY SCREEN ── */
            <div className="project-categories-container">
              {/* Top Configuration Card */}
              <div
                className="glass-card"
                style={{
                  marginBottom: 20,
                  padding: 22,
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  background: 'rgba(16, 185, 129, 0.05)',
                  boxShadow: '0 4px 25px rgba(0, 0, 0, 0.35)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                      <HardHat size={26} color="#34d399" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 18, color: '#f8fafc', margin: 0, fontWeight: 700 }}>
                        ⭐ Project Daily Progress &amp; Expense Entry Screen
                      </h2>
                      <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>
                        Fill in all <strong>9 Progress Categories</strong> &amp; <strong>11 Expense Categories</strong> manually, then click Submit below.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="nexus-btn nexus-btn-ghost"
                      style={{ padding: '8px 14px', fontSize: 12 }}
                      onClick={handleDownloadProgressPdf}
                      disabled={downloadingPdf}
                    >
                      <Download size={13} /> Export Progress PDF
                    </button>
                    <button
                      type="button"
                      className="nexus-btn nexus-btn-ghost"
                      style={{ padding: '8px 14px', fontSize: 12 }}
                      onClick={handleDownloadExpensePdf}
                      disabled={downloadingPdf}
                    >
                      <Download size={13} /> Export Expense PDF
                    </button>
                    <button
                      type="button"
                      className="nexus-btn"
                      style={{
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 13,
                        padding: '9px 20px',
                        border: 'none',
                        boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                      onClick={() => handleStudioSubmit('SUBMITTED')}
                      disabled={submitting}
                    >
                      <Send size={15} /> {submitting ? 'Submitting...' : 'Submit Report & Expenses'}
                    </button>
                  </div>
                </div>

                {/* Project Inputs Bar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div>
                    <label className="field-label" style={{ fontSize: 11, color: '#34d399' }}>Link Existing Job (Optional)</label>
                    <select
                      className="nexus-select"
                      style={{ width: '100%', fontSize: 12 }}
                      value={selectedJob?.id || ''}
                      onChange={(e) => {
                        const jId = e.target.value;
                        if (!jId) {
                          setSelectedJob(null);
                        } else {
                          const found = jobs.find((j) => String(j.id) === String(jId));
                          if (found) {
                            setSelectedJob(found);
                            setStudioProjectBranch(found.branchName);
                            setStudioProjectClient(found.clientName);
                            setStudioProjectPoc(found.personOfContact);
                            const matched = mySubmissions.find((r) => r.jobMetadataId === found.id);
                            initTemplates(matched || null);
                          }
                        }
                      }}
                    >
                      <option value="">— Direct Site Project (No Ticket Required) —</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          #{j.ticket?.serialNo || j.id} — {j.branchName} ({j.clientName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label" style={{ fontSize: 11 }}>Branch / Site Name</label>
                    <input
                      className="nexus-input"
                      placeholder="e.g. UBL Bank Mall Road Branch"
                      value={studioProjectBranch}
                      onChange={(e) => setStudioProjectBranch(e.target.value)}
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </div>

                  <div>
                    <label className="field-label" style={{ fontSize: 11 }}>Client Name</label>
                    <input
                      className="nexus-input"
                      placeholder="e.g. UBL Bank"
                      value={studioProjectClient}
                      onChange={(e) => setStudioProjectClient(e.target.value)}
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </div>

                  <div>
                    <label className="field-label" style={{ fontSize: 11 }}>Person of Contact</label>
                    <input
                      className="nexus-input"
                      placeholder="e.g. Branch Manager"
                      value={studioProjectPoc}
                      onChange={(e) => setStudioProjectPoc(e.target.value)}
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </div>

                  <div>
                    <label className="field-label" style={{ fontSize: 11 }}>Report Date</label>
                    <input
                      type="date"
                      className="nexus-input"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </div>

                  <div>
                    <label className="field-label" style={{ fontSize: 11 }}>Expenses Paid By</label>
                    <select
                      className="nexus-select"
                      value={paidBy}
                      onChange={(e) => setPaidBy(e.target.value)}
                      style={{ width: '100%', fontSize: 12 }}
                    >
                      <option value="FES">FES</option>
                      <option value="Client">Client</option>
                      <option value="Subcontractor">Subcontractor</option>
                    </select>
                  </div>
                </div>

                {/* Sub Tab Switcher */}
                <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.08)', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`tab-segment-btn ${studioCategoryTab === 'progress' ? 'active-field' : ''}`}
                    style={{ padding: '8px 18px', fontSize: 13, borderRadius: 8 }}
                    onClick={() => setStudioCategoryTab('progress')}
                  >
                    📋 1. Daily Progress Report (9 Categories)
                  </button>
                  <button
                    type="button"
                    className={`tab-segment-btn ${studioCategoryTab === 'expense' ? 'active-field' : ''}`}
                    style={{ padding: '8px 18px', fontSize: 13, borderRadius: 8 }}
                    onClick={() => setStudioCategoryTab('expense')}
                  >
                    💰 2. Project Expense Report (11 Categories)
                  </button>
                  <button
                    type="button"
                    className={`tab-segment-btn ${studioCategoryTab === 'attachments' ? 'active-field' : ''}`}
                    style={{ padding: '8px 18px', fontSize: 13, borderRadius: 8 }}
                    onClick={() => setStudioCategoryTab('attachments')}
                  >
                    📎 3. Bills &amp; Receipts ({attachments.length})
                  </button>
                </div>
              </div>

              {/* ── 9 PROGRESS CATEGORIES (FILLABLE TABLES) ───────────────────── */}
              {studioCategoryTab === 'progress' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 14, color: '#34d399', fontWeight: 700 }}>
                      📋 9 Official Daily Progress Inspection Categories
                    </div>
                    <div style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '4px 12px', borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                      Overall Progress: {calculateOverallProgress()}%
                    </div>
                  </div>

                  {progressSections.map((sec, secIdx) => {
                    let secTotal = 0;
                    let count = 0;
                    (sec.items || []).forEach((it) => {
                      const p = parseFloat(it.workPercent);
                      if (!isNaN(p)) {
                        secTotal += p;
                        count++;
                      }
                    });
                    const secAvg = count > 0 ? Math.round(secTotal / count) : 0;

                    return (
                      <div key={sec.id || secIdx} className="glass-card" style={{ padding: 16, background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>
                              {sec.id || secIdx + 1}
                            </span>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 15, color: '#f8fafc' }}>{sec.title}</span>
                              <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>— {sec.subtitle}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 12, color: secAvg > 0 ? '#34d399' : '#64748b', fontWeight: 700 }}>
                            Section Avg: {secAvg}%
                          </span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                                <th style={{ width: 32, padding: 6 }}>Sr</th>
                                <th style={{ padding: 6 }}>Type of Work / Item</th>
                                <th style={{ width: 70, padding: 6 }}>Unit</th>
                                <th style={{ width: 85, padding: 6 }}>Work %</th>
                                <th style={{ padding: 6 }}>Remark</th>
                                <th style={{ padding: 6 }}>Others</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sec.items?.map((item, itIdx) => (
                                <tr key={itIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                  <td style={{ color: '#64748b', padding: 6, fontFamily: 'monospace', fontWeight: 600 }}>{item.code}</td>
                                  <td style={{ padding: 6, color: '#cbd5e1' }}>
                                    {item.isCustom ? (
                                      <input
                                        className="nexus-input"
                                        style={{ padding: '3px 8px', fontSize: 12, height: 28 }}
                                        placeholder="Custom work description..."
                                        value={item.name}
                                        onChange={(e) => handleProgressChange(secIdx, itIdx, 'name', e.target.value)}
                                      />
                                    ) : item.name}
                                  </td>
                                  <td style={{ padding: 6 }}>
                                    <input
                                      className="nexus-input"
                                      style={{ padding: '3px 8px', fontSize: 12, height: 28, width: '100%' }}
                                      value={item.unit}
                                      onChange={(e) => handleProgressChange(secIdx, itIdx, 'unit', e.target.value)}
                                    />
                                  </td>
                                  <td style={{ padding: 6 }}>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      className="nexus-input"
                                      style={{ padding: '3px 8px', fontSize: 12, height: 28, width: '100%', color: item.workPercent ? '#34d399' : 'inherit', fontWeight: 700 }}
                                      placeholder="0"
                                      value={item.workPercent}
                                      onChange={(e) => handleProgressChange(secIdx, itIdx, 'workPercent', e.target.value)}
                                    />
                                  </td>
                                  <td style={{ padding: 6 }}>
                                    <input
                                      className="nexus-input"
                                      style={{ padding: '3px 8px', fontSize: 12, height: 28, width: '100%' }}
                                      placeholder="Remark..."
                                      value={item.remark}
                                      onChange={(e) => handleProgressChange(secIdx, itIdx, 'remark', e.target.value)}
                                    />
                                  </td>
                                  <td style={{ padding: 6 }}>
                                    <input
                                      className="nexus-input"
                                      style={{ padding: '3px 8px', fontSize: 12, height: 28, width: '100%' }}
                                      placeholder="Others..."
                                      value={item.others}
                                      onChange={(e) => handleProgressChange(secIdx, itIdx, 'others', e.target.value)}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <button
                          type="button"
                          onClick={() => addProgressCustomRow(secIdx)}
                          style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 12, marginTop: 8, cursor: 'pointer', padding: 0, fontWeight: 600 }}
                        >
                          + Add Custom Row in {sec.title}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── 11 EXPENSE CATEGORIES (FILLABLE TABLES) ───────────────────── */}
              {studioCategoryTab === 'expense' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 14, color: '#38bdf8', fontWeight: 700 }}>
                      💰 11 Official Construction Expense Categories
                    </div>
                    <div style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 12px', borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                      Total Expense: Rs. {calculateTotalExpenses().toLocaleString()}
                    </div>
                  </div>

                  {expenseSections.map((sec, secIdx) => {
                    let secSum = 0;
                    (sec.items || []).forEach((it) => {
                      const v = parseFloat(it.amount);
                      if (!isNaN(v) && v > 0) secSum += v;
                    });

                    return (
                      <div key={sec.id || secIdx} className="glass-card" style={{ padding: 16, background: 'rgba(0, 0, 0, 0.35)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>
                              {sec.id || secIdx + 1}
                            </span>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 15, color: '#f8fafc' }}>{sec.title}</span>
                              <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>— {sec.subtitle}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 13, color: secSum > 0 ? '#38bdf8' : '#64748b', fontWeight: 700 }}>
                            Subtotal: Rs. {secSum.toLocaleString()}
                          </span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                                <th style={{ width: 32, padding: 6 }}>Sr</th>
                                <th style={{ padding: 6 }}>Expense Item Description</th>
                                <th style={{ width: 90, padding: 6 }}>Qty</th>
                                <th style={{ width: 120, padding: 6 }}>Amount (Rs.)</th>
                                <th style={{ padding: 6 }}>Others</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sec.items?.map((item, itIdx) => (
                                <tr key={itIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                  <td style={{ color: '#64748b', padding: 6, fontFamily: 'monospace', fontWeight: 600 }}>{item.code}</td>
                                  <td style={{ padding: 6, color: '#cbd5e1' }}>
                                    {item.isCustom ? (
                                      <input
                                        className="nexus-input"
                                        style={{ padding: '3px 8px', fontSize: 12, height: 28 }}
                                        placeholder="Custom expense description..."
                                        value={item.name}
                                        onChange={(e) => handleExpenseChange(secIdx, itIdx, 'name', e.target.value)}
                                      />
                                    ) : item.name}
                                  </td>
                                  <td style={{ padding: 6 }}>
                                    <input
                                      className="nexus-input"
                                      style={{ padding: '3px 8px', fontSize: 12, height: 28, width: '100%' }}
                                      placeholder="Qty..."
                                      value={item.qty}
                                      onChange={(e) => handleExpenseChange(secIdx, itIdx, 'qty', e.target.value)}
                                    />
                                  </td>
                                  <td style={{ padding: 6 }}>
                                    <input
                                      type="number"
                                      min="0"
                                      className="nexus-input"
                                      style={{ padding: '3px 8px', fontSize: 12, height: 28, width: '100%', color: item.amount ? '#38bdf8' : 'inherit', fontWeight: 700 }}
                                      placeholder="0"
                                      value={item.amount}
                                      onChange={(e) => handleExpenseChange(secIdx, itIdx, 'amount', e.target.value)}
                                    />
                                  </td>
                                  <td style={{ padding: 6 }}>
                                    <input
                                      className="nexus-input"
                                      style={{ padding: '3px 8px', fontSize: 12, height: 28, width: '100%' }}
                                      placeholder="Others..."
                                      value={item.others}
                                      onChange={(e) => handleExpenseChange(secIdx, itIdx, 'others', e.target.value)}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <button
                          type="button"
                          onClick={() => addExpenseCustomRow(secIdx)}
                          style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: 12, marginTop: 8, cursor: 'pointer', padding: 0, fontWeight: 600 }}
                        >
                          + Add Custom Row in {sec.title}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── BILLS & RECEIPTS ATTACHMENTS ──────────────────────────────── */}
              {studioCategoryTab === 'attachments' && (
                <div className="glass-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15, color: '#f8fafc' }}>
                        Bills &amp; Progress Attachments ({attachments.length})
                      </h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#94a3b8' }}>
                        Upload invoices, physical expense receipts, and progress photos
                      </p>
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                      />
                      <button
                        type="button"
                        className="nexus-btn nexus-btn-primary"
                        style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12 }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Camera size={14} /> Upload Bills / Photos
                      </button>
                    </div>
                  </div>

                  {attachments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 10, color: '#64748b' }}>
                      <Camera size={36} color="#64748b" style={{ margin: '0 auto 8px auto' }} />
                      <div style={{ fontSize: 14, color: '#cbd5e1' }}>No receipts attached yet</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>Click "Upload Bills / Photos" to attach camera shots or files.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                      {attachments.map((att, idx) => (
                        <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                          {att.url && att.url.startsWith('data:image') ? (
                            <img src={att.url} alt={att.name} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                          ) : (
                            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FileText size={36} color="#38bdf8" />
                            </div>
                          )}
                          <div style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{att.name || `File #${idx + 1}`}</span>
                            <button type="button" onClick={() => removeAttachment(idx)} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}>
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── STICKY SUMMARY & BOTTOM ACTION BAR ────────────────────────── */}
              <div
                style={{
                  position: 'sticky',
                  bottom: 16,
                  zIndex: 40,
                  marginTop: 24,
                  padding: '14px 20px',
                  background: 'rgba(15, 23, 42, 0.95)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: 12,
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Live Report Summary:</div>
                  <div style={{ fontSize: 14, fontWeight: 'bold', color: '#f8fafc' }}>
                    Overall Progress: <span style={{ color: '#34d399' }}>{calculateOverallProgress()}%</span>
                    <span style={{ color: '#64748b', margin: '0 10px' }}>|</span>
                    Total Project Expense: <span style={{ color: '#38bdf8' }}>Rs. {calculateTotalExpenses().toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    onClick={() => handleStudioSubmit('IN_PROGRESS')}
                    disabled={savingDraft || submitting}
                    style={{ padding: '10px 16px', fontSize: 13 }}
                  >
                    <Save size={15} /> {savingDraft ? 'Saving...' : 'Save Draft'}
                  </button>
                  <button
                    type="button"
                    className="nexus-btn"
                    onClick={() => handleStudioSubmit('SUBMITTED')}
                    disabled={submitting || savingDraft}
                    style={{
                      padding: '10px 22px',
                      fontSize: 13,
                      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                      color: '#fff',
                      fontWeight: 700,
                      border: 'none',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <Send size={15} /> {submitting ? 'Submitting...' : '🚀 Submit Report & Expenses to Office'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── SUBMITTED REPORTS & EXPENSES HISTORY ─────────────────────── */
            <div>
              {mySubmissions.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
                  <FileText size={40} color="#64748b" style={{ margin: '0 auto 12px auto' }} />
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
                    No Reports Submitted Yet
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    Complete and submit Project reports from your assigned jobs list.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {mySubmissions.map((report) => (
                    <div key={report.id} className="glass-card" style={{ padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 'bold', color: '#f8fafc' }}>
                              {report.branchName}
                            </span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>
                              v{report.version}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            Client: {report.jobMetadata?.clientName || '—'} | Serial: #{report.jobMetadata?.ticket?.serialNo || report.jobMetadataId}
                          </div>
                        </div>
                        <div>
                          {report.status === 'APPROVED' ? (
                            <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>
                              APPROVED
                            </span>
                          ) : report.status === 'CORRECTION_REQUIRED' ? (
                            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>
                              CORRECTION REQUIRED
                            </span>
                          ) : (
                            <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>
                              SUBMITTED
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 13, flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <span style={{ color: '#94a3b8' }}>Progress: </span>
                          <strong style={{ color: '#34d399' }}>{Math.round(report.overallProgressPercent)}%</strong>
                          <span style={{ color: '#64748b', margin: '0 8px' }}>|</span>
                          <span style={{ color: '#94a3b8' }}>Expenses: </span>
                          <strong style={{ color: '#38bdf8' }}>Rs. {report.totalExpenseAmount.toLocaleString()}</strong>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          Submitted: {new Date(report.updatedAt).toLocaleString()}
                        </div>
                      </div>

                      {report.reviewerNotes && (
                        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6, fontSize: 12, color: '#fca5a5' }}>
                          <strong>Reviewer Note:</strong> {report.reviewerNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 1: PROMPT FOR BOTH PDF REPORTS ON PROJECT INTAKE ──────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {isReportModalOpen && modalJobForReport && (
        <ProjectReportModal
          job={modalJobForReport}
          onClose={() => {
            setIsReportModalOpen(false);
            setModalJobForReport(null);
          }}
          onSubmitted={async () => {
            setIsReportModalOpen(false);
            setModalJobForReport(null);
            setActionMessage({
              type: 'success',
              text: '🎉 Project Reports & Expenses submitted successfully! Automatically routed to the office employee who connected that Gmail account.',
            });
            await loadData();
            setActiveTab('history');
          }}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 2: DIRECT LOG FIELD OPERATIONAL EXPENSE ───────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {isLogExpenseModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            padding: 16,
          }}
          onClick={() => setIsLogExpenseModalOpen(false)}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: 500,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt size={20} color="#34d399" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#f8fafc' }}>Log Field Operational Expense</h3>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Submitted claims route directly to office Operations Feed</div>
                </div>
              </div>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={() => setIsLogExpenseModalOpen(false)}
                style={{ padding: 6 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLogExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="field-label">Target Job / Site Branch</label>
                <select
                  className="nexus-select"
                  required
                  value={logExpenseForm.jobMetadataId}
                  onChange={(e) => setLogExpenseForm({ ...logExpenseForm, jobMetadataId: e.target.value })}
                >
                  <option value="">— Select job to charge expense against —</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      #{j.ticket?.serialNo || j.id} — {j.branchName} ({j.clientName})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Expense Category</label>
                  <select
                    className="nexus-select"
                    value={logExpenseForm.category}
                    onChange={(e) => setLogExpenseForm({ ...logExpenseForm, category: e.target.value })}
                  >
                    <option value="Site Expense">Site Expense</option>
                    <option value="Fuel & Travel">Fuel & Travel</option>
                    <option value="Spare Parts & Materials">Spare Parts & Materials</option>
                    <option value="Labor & Wages">Labor & Wages</option>
                    <option value="Food & Refreshment">Food & Refreshment</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Emergency Repair">Emergency Repair</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Amount (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    className="nexus-input"
                    placeholder="e.g. 3500"
                    value={logExpenseForm.amount}
                    onChange={(e) => setLogExpenseForm({ ...logExpenseForm, amount: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Paid By</label>
                  <select
                    className="nexus-select"
                    value={logExpenseForm.paidBy}
                    onChange={(e) => setLogExpenseForm({ ...logExpenseForm, paidBy: e.target.value })}
                  >
                    <option value="FES">🏢 Paid by Company (FES)</option>
                    <option value="EMPLOYEE">👤 Paid by Field Employee</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Bill / Voucher #</label>
                  <input
                    className="nexus-input"
                    placeholder="Optional receipt #"
                    value={logExpenseForm.billNumber}
                    onChange={(e) => setLogExpenseForm({ ...logExpenseForm, billNumber: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label">Date</label>
                  <input
                    type="date"
                    className="nexus-input"
                    value={logExpenseForm.expenseDate}
                    onChange={(e) => setLogExpenseForm({ ...logExpenseForm, expenseDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Time</label>
                  <input
                    type="time"
                    className="nexus-input"
                    value={logExpenseForm.expenseTime}
                    onChange={(e) => setLogExpenseForm({ ...logExpenseForm, expenseTime: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Upload Bill or Site Receipt Photo</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="file"
                    ref={expenseFileInputRef}
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                    onChange={handleExpenseFileUpload}
                  />
                  <button
                    type="button"
                    className="nexus-btn nexus-btn-ghost"
                    onClick={() => expenseFileInputRef.current?.click()}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px' }}
                  >
                    <Camera size={16} /> Choose Photo / Voucher
                  </button>
                  {logExpenseForm.imageUrl && (
                    <button
                      type="button"
                      className="nexus-btn nexus-btn-ghost"
                      onClick={() => setLogExpenseForm((prev) => ({ ...prev, imageUrl: '' }))}
                      style={{ color: '#f87171', padding: '10px 14px' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {logExpenseForm.imageUrl && (
                  <div style={{ marginTop: 8, padding: 6, background: 'rgba(0,0,0,0.3)', borderRadius: 6, textAlign: 'center' }}>
                    <span style={{ fontSize: 11, color: '#34d399' }}>✓ Photo attached ready to submit</span>
                  </div>
                )}
              </div>

              <div>
                <label className="field-label">Summary Notes</label>
                <textarea
                  className="nexus-input"
                  rows={2}
                  placeholder="Detail site items purchased or work performed..."
                  value={logExpenseForm.summaryNotes}
                  onChange={(e) => setLogExpenseForm({ ...logExpenseForm, summaryNotes: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="nexus-btn nexus-btn-primary"
                disabled={submittingFieldExpense}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  padding: 12,
                  fontWeight: 600,
                  fontSize: 14,
                  marginTop: 6,
                }}
              >
                <Send size={15} />
                {submittingFieldExpense ? 'Submitting to Office...' : 'Submit Field Expense'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 3: MANUAL TICKET CREATION MODAL ───────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {showManualTicketModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            padding: 16,
          }}
          onClick={() => setShowManualTicketModal(false)}
        >
          <div
            className="glass-card"
            style={{ width: '100%', maxWidth: 440, padding: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#f8fafc' }}>Create Manual Site Ticket</h3>
              <button
                type="button"
                className="nexus-btn nexus-btn-ghost"
                onClick={() => setShowManualTicketModal(false)}
                style={{ padding: 6 }}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateManualTicket} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="field-label">Subject / Ticket Description</label>
                <input
                  className="nexus-input"
                  required
                  placeholder="e.g. Electrical renovation of main hall"
                  value={manualTicketSubject}
                  onChange={(e) => setManualTicketSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Sender / Client Label</label>
                <input
                  className="nexus-input"
                  placeholder="e.g. UBL Central or On-Site Client"
                  value={manualTicketSender}
                  onChange={(e) => setManualTicketSender(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="nexus-btn nexus-btn-primary"
                disabled={creatingManualTicket}
                style={{ padding: 12, fontWeight: 600 }}
              >
                {creatingManualTicket ? 'Creating...' : 'Create Ticket & Continue'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
