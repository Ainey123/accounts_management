"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import {
  Mail, RefreshCw, Activity, CheckCircle, DollarSign,
  User, AlertCircle, FileText, Camera, Upload, ChevronRight, Save, ClipboardList, Check, Search, Edit3, Plus, Trash2, Image, Banknote, Hammer, Receipt, CreditCard
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import DocumentStudio from '@/components/DocumentStudio';

export default function EmployeeRealTimeDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('tasks');
  const [loading, setLoading] = useState(true);
  const [myStatus, setMyStatus] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ assigned: 0, completed: 0, surveys: 0, expenses: 0, payments: 0 });
  const [ticketSummary, setTicketSummary] = useState(null);
  const [message, setMessage] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [feedSearch, setFeedSearch] = useState('');
  const [feedMonth, setFeedMonth] = useState('');
  const [feedDate, setFeedDate] = useState('');
  const [feedPerson, setFeedPerson] = useState('');
  
  // Inline actions states
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [actionType, setActionType] = useState(null); // 'survey' | 'expense' | 'payment' | 'quotation' | 'bank-approval' | 'work-completion' | 'invoice' | null
  
  // Survey form state
  const [surveyText, setSurveyText] = useState('');
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [surveyImageUrl, setSurveyImageUrl] = useState('');
  const [capturedSurveyImg, setCapturedSurveyImg] = useState(null);
  
  // Quotation editable state
  const [quotationLineItems, setQuotationLineItems] = useState([{ description: '', quantity: 1, rate: 0 }]);
  const [quotationPoNumber, setQuotationPoNumber] = useState('');
  const [savingQuotation, setSavingQuotation] = useState(false);
  const [editingQuotationId, setEditingQuotationId] = useState(null);
  
  // Expense form state
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseImg, setExpenseImg] = useState('');
  const [capturedImg, setCapturedImg] = useState(null);
  const [savingExpense, setSavingExpense] = useState(false);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentTaxDeducted, setPaymentTaxDeducted] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentImg, setPaymentImg] = useState('');
  const [capturedPaymentImg, setCapturedPaymentImg] = useState(null);
  const [savingPayment, setSavingPayment] = useState(false);

  // Bank Approval form state
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [bankNotes, setBankNotes] = useState('');
  const [bankImg, setBankImg] = useState('');
  const [capturedBankImg, setCapturedBankImg] = useState(null);
  const [bankStatus, setBankStatus] = useState('PENDING');
  const [savingBank, setSavingBank] = useState(false);

  // Work Completion form state
  const [workCompletionStatus, setWorkCompletionStatus] = useState('PENDING');
  const [workCompletionAmount, setWorkCompletionAmount] = useState('');
  const [workCompletionNotes, setWorkCompletionNotes] = useState('');
  const [workCompletionImg, setWorkCompletionImg] = useState('');
  const [capturedWorkImg, setCapturedWorkImg] = useState(null);
  const [savingWork, setSavingWork] = useState(false);

  // Invoice form state (separate from quotation)
  const [invoiceLineItems, setInvoiceLineItems] = useState([{ description: '', quantity: 1, rate: 0 }]);
  const [invoicePoNumber, setInvoicePoNumber] = useState('');
  const [invoiceImg, setInvoiceImg] = useState('');
  const [capturedInvoiceImg, setCapturedInvoiceImg] = useState(null);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);

  // Payment Status state
  const [paymentStatus, setPaymentStatus] = useState('PENDING');
  
  const webcamRef = useRef(null);
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dloxdnqfm';

  // Stable per-employee intake numbers: sort full jobs list by id (creation order)
  // and assign 1, 2, 3... regardless of search/filter
  const sortedJobsById = [...(jobs || [])].sort((a, b) => a.id - b.id);
  const jobIntakeNumberMap = new Map(
    sortedJobsById.map((j, idx) => [j.id, idx + 1])
  );

  const filteredJobs = (() => {
    if (!jobSearch.trim()) return sortedJobsById;
    const q = jobSearch.toLowerCase();
    return sortedJobsById.filter((j) =>
      (j.ticket?.subject || '').toLowerCase().includes(q) ||
      (j.ticket?.serialNo || '').toLowerCase().includes(q) ||
      String(jobIntakeNumberMap.get(j.id) || '').includes(q) ||
      (j.clientName || '').toLowerCase().includes(q) ||
      (j.branchName || '').toLowerCase().includes(q)
    );
  })();

  const getTicketEntryPerson = (ticket) =>
    ticket.createdBy?.employeeName ||
    ticket.createdBy?.email ||
    ticket.jobMetadata?.createdBy?.employeeName ||
    ticket.jobMetadata?.createdBy?.email ||
    ticket.jobMetadata?.manualEnteredBy ||
    (ticket.sender === 'Manual Entry' ? 'Manual Entry' : 'Auto-Ingested');

  const feedPersonOptions = Array.from(
    new Set((tickets || []).map(getTicketEntryPerson).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const getLocalDateKey = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const filteredTickets = (tickets || []).filter((ticket) => {
    const dateKey = getLocalDateKey(ticket.exactDate);
    const monthKey = dateKey.slice(0, 7);
    const enteredBy = getTicketEntryPerson(ticket);

    if (feedDate && dateKey !== feedDate) return false;
    if (feedMonth && monthKey !== feedMonth) return false;
    if (feedPerson && enteredBy !== feedPerson) return false;

    if (!feedSearch.trim()) return true;
    const q = feedSearch.toLowerCase();
    return (
      (ticket.subject || '').toLowerCase().includes(q) ||
      (ticket.sender || '').toLowerCase().includes(q) ||
      (ticket.serialNo || '').toLowerCase().includes(q) ||
      (ticket.gmailAccount?.gmailEmail || '').toLowerCase().includes(q) ||
      (enteredBy || '').toLowerCase().includes(q) ||
      (ticket.jobMetadata?.clientName || '').toLowerCase().includes(q) ||
      (ticket.jobMetadata?.branchName || '').toLowerCase().includes(q) ||
      (ticket.jobMetadata?.assignedEmployee?.employeeName || '').toLowerCase().includes(q)
    );
  });

  const isPdfDocumentUrl = (url) => {
    const cleanUrl = (url || '').split('?')[0].toLowerCase();
    return cleanUrl.endsWith('.pdf') || (url || '').toLowerCase().includes('/pdf/');
  };

  const renderDocumentPreview = (doc) => {
    const url = doc.url || '';
    const isPdf = isPdfDocumentUrl(url);

    if (isPdf) {
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#cbd5e1' }}>
          <FileText size={24} color="#00f2fe" />
          <span style={{ fontSize: 11 }}>Open PDF</span>
        </div>
      );
    }

    return (
      <img
        src={url}
        alt={doc.label}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    );
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Load my assigned jobs
      const { jobs: fetchedJobs } = await apiFetch('/api/jobs');
      setJobs(fetchedJobs || []);

      // 2. Load users to get real-time active status
      const userRes = await apiFetch('/api/users');
      const me = (userRes.users || []).find((u) => u.id === user?.id);
      if (me) {
        setMyStatus(me.activeStatus);
      }

      // 3. Load ALL incoming Gmail tickets (full ingestion stream)
      const { tickets: allTickets } = await apiFetch('/api/tickets');
      setTickets(allTickets || []);

      // 4. Calculate metrics
      const assigned = (fetchedJobs || []).length;
      const completed = (fetchedJobs || []).filter(j => 
        (j.quotationInvoices || []).some(qi => qi.status === 'APPROVED')
      ).length;
      const surveys = (fetchedJobs || []).filter(j => j.surveyReport).length;
      const expenses = (fetchedJobs || []).reduce((sum, j) => sum + (j.expenses || []).reduce((s, e) => s + e.amount, 0), 0);
      const payments = (fetchedJobs || []).reduce((sum, j) => sum + (j.payments || []).reduce((s, p) => s + p.amount, 0), 0);

      setStats({ assigned, completed, surveys, expenses, payments });

      // 5. Load ticket summary for dashboard cards
      try {
        const summaryRes = await apiFetch('/api/tickets/summary');
        setTicketSummary(summaryRes.summary || null);
      } catch (summaryErr) {
        console.warn('Ticket summary load error:', summaryErr);
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const toggleActiveStatus = async () => {
    setMessage('');
    try {
      const nextStatus = !myStatus;
      await apiFetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activeStatus: nextStatus }),
      });
      setMyStatus(nextStatus);
      setMessage(`Activity status toggled to: ${nextStatus ? 'Active / On Site' : 'Idle / Off Duty'}`);
    } catch (err) {
      setMessage('Failed to toggle status: ' + err.message);
    }
  };

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'unsigned-preset');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
    return data.secure_url;
  };

  const capturePhoto = useCallback(() => {
    const shot = webcamRef.current?.getScreenshot();
    if (shot) {
      if (actionType === 'expense') {
        setCapturedImg(shot);
      } else if (actionType === 'payment') {
        setCapturedPaymentImg(shot);
      } else if (actionType === 'survey') {
        setCapturedSurveyImg(shot);
      } else if (actionType === 'bank-approval') {
        setCapturedBankImg(shot);
      } else if (actionType === 'work-completion') {
        setCapturedWorkImg(shot);
      } else if (actionType === 'invoice') {
        setCapturedInvoiceImg(shot);
      }
    }
  }, [actionType]);

  const handleSurveyFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      setMessage(`Uploading ${files.length} file(s)...`);
      const newUrls = [];
      for (const file of files) {
        const url = await uploadToCloudinary(file);
        newUrls.push(url);
      }
      setSurveyImageUrl(prev => prev ? `${prev},${newUrls.join(',')}` : newUrls.join(','));
      setMessage('Files uploaded successfully.');
    } catch (err) {
      setMessage('Upload error: ' + err.message);
    }
  };

  const handlePaymentFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setMessage('Uploading photo...');
      const url = await uploadToCloudinary(file);
      setPaymentImg(url);
      setCapturedPaymentImg(url);
      setMessage('Payment receipt photo uploaded successfully.');
    } catch (err) {
      setMessage('Upload error: ' + err.message);
    }
  };

  const handleBankFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setMessage('Uploading bank document...');
      const url = await uploadToCloudinary(file);
      setBankImg(url);
      setCapturedBankImg(url);
      setMessage('Bank document uploaded successfully.');
    } catch (err) {
      setMessage('Upload error: ' + err.message);
    }
  };

  const handleWorkFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setMessage('Uploading work completion photo...');
      const url = await uploadToCloudinary(file);
      setWorkCompletionImg(url);
      setCapturedWorkImg(url);
      setMessage('Work completion photo uploaded successfully.');
    } catch (err) {
      setMessage('Upload error: ' + err.message);
    }
  };

  const handleInvoiceFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setMessage('Uploading invoice document...');
      const url = await uploadToCloudinary(file);
      setInvoiceImg(url);
      setCapturedInvoiceImg(url);
      setMessage('Invoice document uploaded successfully.');
    } catch (err) {
      setMessage('Upload error: ' + err.message);
    }
  };

  const submitPayment = async (jobId) => {
    if (!paymentAmount || !paymentNotes.trim()) {
      setMessage('Payment amount and notes are required.');
      return;
    }
    setSavingPayment(true);
    setMessage('');
    try {
      let finalUrl = paymentImg;
      if (capturedPaymentImg && capturedPaymentImg.startsWith('data:')) {
        const blob = await fetch(capturedPaymentImg).then((r) => r.blob());
        finalUrl = await uploadToCloudinary(blob);
      }

      await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          jobMetadataId: jobId,
          amount: parseFloat(paymentAmount),
          taxDeducted: paymentTaxDeducted ? parseFloat(paymentTaxDeducted) : 0,
          imageUrl: finalUrl || null,
          summaryNotes: paymentNotes,
        }),
      });

      setMessage('Payment logged successfully!');
      setPaymentAmount('');
      setPaymentTaxDeducted('');
      setPaymentNotes('');
      setPaymentImg('');
      setCapturedPaymentImg(null);
      setActionType(null);
      await loadDashboardData();
    } catch (err) {
      setMessage('Failed to log payment: ' + err.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleExpenseFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setMessage('Uploading photo...');
      const url = await uploadToCloudinary(file);
      setExpenseImg(url);
      setCapturedImg(url);
      setMessage('Receipt photo uploaded successfully.');
    } catch (err) {
      setMessage('Upload error: ' + err.message);
    }
  };

  const submitSurvey = async (jobId) => {
    if (!surveyText.trim()) {
      setMessage('Survey report text cannot be empty.');
      return;
    }
    setSavingSurvey(true);
    setMessage('');
    try {
      let finalUrls = surveyImageUrl ? surveyImageUrl.split(',') : [];
      if (capturedSurveyImg && capturedSurveyImg.startsWith('data:')) {
        const blob = await fetch(capturedSurveyImg).then((r) => r.blob());
        const camUrl = await uploadToCloudinary(blob);
        finalUrls.push(camUrl);
      } else if (capturedSurveyImg && capturedSurveyImg.startsWith('http')) {
        if (!finalUrls.includes(capturedSurveyImg)) finalUrls.push(capturedSurveyImg);
      }
      let finalUrl = finalUrls.length > 0 ? finalUrls.join(',') : null;

      await apiFetch('/api/survey', {
        method: 'POST',
        body: JSON.stringify({ jobMetadataId: jobId, reportText: surveyText, imageUrl: finalUrl }),
      });
      setMessage('Survey report submitted successfully!');
      setSurveyText('');
      setSurveyImageUrl('');
      setCapturedSurveyImg(null);
      setActionType(null);
      await loadDashboardData();
    } catch (err) {
      setMessage('Failed to submit survey: ' + err.message);
    } finally {
      setSavingSurvey(false);
    }
  };

  const submitExpense = async (jobId) => {
    if (!expenseAmount || !expenseNotes.trim()) {
      setMessage('Expense amount and notes are required.');
      return;
    }
    setSavingExpense(true);
    setMessage('');
    try {
      let finalUrl = expenseImg;
      if (capturedImg && capturedImg.startsWith('data:')) {
        const blob = await fetch(capturedImg).then((r) => r.blob());
        finalUrl = await uploadToCloudinary(blob);
      }

      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          jobMetadataId: jobId,
          amount: parseFloat(expenseAmount),
          imageUrl: finalUrl || null,
          summaryNotes: expenseNotes,
        }),
      });

      setMessage('Expense logged successfully!');
      setExpenseAmount('');
      setExpenseNotes('');
      setExpenseImg('');
      setCapturedImg(null);
      setActionType(null);
      await loadDashboardData();
    } catch (err) {
      setMessage('Failed to log expense: ' + err.message);
    } finally {
      setSavingExpense(false);
    }
  };

  // Quotation handlers
  const handleQuotationLineItemChange = (index, field, value) => {
    const updated = [...quotationLineItems];
    updated[index] = { ...updated[index], [field]: value };
    setQuotationLineItems(updated);
  };

  const addQuotationLineItem = () => {
    setQuotationLineItems([...quotationLineItems, { description: '', quantity: 1, rate: 0 }]);
  };

  const removeQuotationLineItem = (index) => {
    if (quotationLineItems.length <= 1) return;
    setQuotationLineItems(quotationLineItems.filter((_, i) => i !== index));
  };

  const submitQuotation = async (jobId) => {
    if (quotationLineItems.length === 0 || !quotationLineItems[0].description) {
      setMessage('At least one line item with description is required.');
      return;
    }
    setSavingQuotation(true);
    setMessage('');
    try {
      const payload = {
        jobMetadataId: jobId,
        documentType: 'QUOTATION',
        lineItems: quotationLineItems,
        poNumber: quotationPoNumber || null,
      };

      if (editingQuotationId) {
        await apiFetch('/api/quotations', {
          method: 'PATCH',
          body: JSON.stringify({ id: editingQuotationId, lineItems: quotationLineItems, poNumber: quotationPoNumber }),
        });
        setMessage('Quotation updated successfully!');
      } else {
        await apiFetch('/api/quotations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMessage('Quotation created successfully!');
      }

      setQuotationLineItems([{ description: '', quantity: 1, rate: 0 }]);
      setQuotationPoNumber('');
      setEditingQuotationId(null);
      setActionType(null);
      await loadDashboardData();
    } catch (err) {
      setMessage('Failed to save quotation: ' + err.message);
    } finally {
      setSavingQuotation(false);
    }
  };

  const openQuotationEditor = (job) => {
    const quotations = job.quotationInvoices || [];
    const quotation = quotations.find((q) => q.documentType === 'QUOTATION');
    if (quotation) {
      try {
        const items = typeof quotation.lineItems === 'string' ? JSON.parse(quotation.lineItems) : quotation.lineItems;
        setQuotationLineItems(items.length > 0 ? items : [{ description: '', quantity: 1, rate: 0 }]);
      } catch {
        setQuotationLineItems([{ description: '', quantity: 1, rate: 0 }]);
      }
      setQuotationPoNumber(quotation.poNumber || '');
      setEditingQuotationId(quotation.id);
    } else {
      setQuotationLineItems([{ description: '', quantity: 1, rate: 0 }]);
      setQuotationPoNumber('');
      setEditingQuotationId(null);
    }
    setActionType('quotation');
  };

  // Invoice handlers (separate from quotation)
  const handleInvoiceLineItemChange = (index, field, value) => {
    const updated = [...invoiceLineItems];
    updated[index] = { ...updated[index], [field]: value };
    setInvoiceLineItems(updated);
  };

  const addInvoiceLineItem = () => {
    setInvoiceLineItems([...invoiceLineItems, { description: '', quantity: 1, rate: 0 }]);
  };

  const removeInvoiceLineItem = (index) => {
    if (invoiceLineItems.length <= 1) return;
    setInvoiceLineItems(invoiceLineItems.filter((_, i) => i !== index));
  };

  const submitInvoice = async (jobId) => {
    if (invoiceLineItems.length === 0 || !invoiceLineItems[0].description) {
      setMessage('At least one line item with description is required.');
      return;
    }
    setSavingInvoice(true);
    setMessage('');
    try {
      let finalUrl = invoiceImg;
      if (capturedInvoiceImg && capturedInvoiceImg.startsWith('data:')) {
        const blob = await fetch(capturedInvoiceImg).then((r) => r.blob());
        finalUrl = await uploadToCloudinary(blob);
      }

      const payload = {
        jobMetadataId: jobId,
        documentType: 'INVOICE',
        lineItems: invoiceLineItems,
        poNumber: invoicePoNumber || null,
        imageUrl: finalUrl || null,
      };

      if (editingInvoiceId) {
        await apiFetch('/api/quotations', {
          method: 'PATCH',
          body: JSON.stringify({ id: editingInvoiceId, lineItems: invoiceLineItems, poNumber: invoicePoNumber, imageUrl: finalUrl || null }),
        });
        setMessage('Invoice updated successfully!');
      } else {
        await apiFetch('/api/quotations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMessage('Invoice created successfully!');
      }

      setInvoiceLineItems([{ description: '', quantity: 1, rate: 0 }]);
      setInvoicePoNumber('');
      setInvoiceImg('');
      setCapturedInvoiceImg(null);
      setEditingInvoiceId(null);
      setActionType(null);
      await loadDashboardData();
    } catch (err) {
      setMessage('Failed to save invoice: ' + err.message);
    } finally {
      setSavingInvoice(false);
    }
  };

  const openInvoiceEditor = (job) => {
    const invoices = job.quotationInvoices || [];
    const invoice = invoices.find((q) => q.documentType === 'INVOICE');
    if (invoice) {
      try {
        const items = typeof invoice.lineItems === 'string' ? JSON.parse(invoice.lineItems) : invoice.lineItems;
        setInvoiceLineItems(items.length > 0 ? items : [{ description: '', quantity: 1, rate: 0 }]);
      } catch {
        setInvoiceLineItems([{ description: '', quantity: 1, rate: 0 }]);
      }
      setInvoicePoNumber(invoice.poNumber || '');
      setInvoiceImg(invoice.imageUrl || '');
      setCapturedInvoiceImg(invoice.imageUrl || null);
      setEditingInvoiceId(invoice.id);
    } else {
      setInvoiceLineItems([{ description: '', quantity: 1, rate: 0 }]);
      setInvoicePoNumber('');
      setInvoiceImg('');
      setCapturedInvoiceImg(null);
      setEditingInvoiceId(null);
    }
    setActionType('invoice');
  };

  // Bank Approval submit
  const submitBankApproval = async (jobId) => {
    if (!bankName || !bankAmount) {
      setMessage('Bank name and amount are required.');
      return;
    }
    setSavingBank(true);
    setMessage('');
    try {
      let finalUrl = bankImg;
      if (capturedBankImg && capturedBankImg.startsWith('data:')) {
        const blob = await fetch(capturedBankImg).then((r) => r.blob());
        finalUrl = await uploadToCloudinary(blob);
      }

      await apiFetch('/api/bank-approval', {
        method: 'POST',
        body: JSON.stringify({
          jobMetadataId: jobId,
          bankName,
          accountNumber: bankAccountNumber || null,
          amount: parseFloat(bankAmount),
          imageUrl: finalUrl || null,
          notes: bankNotes || null,
          status: bankStatus,
        }),
      });

      setMessage('Bank approval saved successfully!');
      setBankName('');
      setBankAccountNumber('');
      setBankAmount('');
      setBankNotes('');
      setBankImg('');
      setCapturedBankImg(null);
      setBankStatus('PENDING');
      setActionType(null);
      await loadDashboardData();
    } catch (err) {
      setMessage('Failed to save bank approval: ' + err.message);
    } finally {
      setSavingBank(false);
    }
  };

  // Work Completion submit
  const submitWorkCompletion = async (jobId) => {
    if (!workCompletionStatus) {
      setMessage('Work completion status is required.');
      return;
    }
    setSavingWork(true);
    setMessage('');
    try {
      let finalUrl = workCompletionImg;
      if (capturedWorkImg && capturedWorkImg.startsWith('data:')) {
        const blob = await fetch(capturedWorkImg).then((r) => r.blob());
        finalUrl = await uploadToCloudinary(blob);
      }

      await apiFetch('/api/work-status', {
        method: 'POST',
        body: JSON.stringify({
          jobMetadataId: jobId,
          status: workCompletionStatus,
          amount: workCompletionAmount ? parseFloat(workCompletionAmount) : 0,
          imageUrl: finalUrl || null,
          notes: workCompletionNotes || null,
        }),
      });

      setMessage('Work completion updated successfully!');
      setWorkCompletionStatus('PENDING');
      setWorkCompletionAmount('');
      setWorkCompletionNotes('');
      setWorkCompletionImg('');
      setCapturedWorkImg(null);
      setActionType(null);
      await loadDashboardData();
    } catch (err) {
      setMessage('Failed to update work status: ' + err.message);
    } finally {
      setSavingWork(false);
    }
  };

  // Update payment status
  const updatePaymentStatus = async (jobId) => {
    setMessage('');
    try {
      await apiFetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentStatus }),
      });
      setMessage(`Payment status updated to: ${paymentStatus}`);
      setActionType(null);
      await loadDashboardData();
    } catch (err) {
      setMessage('Failed to update payment status: ' + err.message);
    }
  };

  const openBankApprovalEditor = (job) => {
    const ba = job.bankApproval;
    if (ba) {
      setBankName(ba.bankName || '');
      setBankAccountNumber(ba.accountNumber || '');
      setBankAmount(ba.amount ? String(ba.amount) : '');
      setBankNotes(ba.notes || '');
      setBankImg(ba.imageUrl || '');
      setCapturedBankImg(ba.imageUrl || null);
      setBankStatus(ba.status || 'PENDING');
    } else {
      setBankName('');
      setBankAccountNumber('');
      setBankAmount('');
      setBankNotes('');
      setBankImg('');
      setCapturedBankImg(null);
      setBankStatus('PENDING');
    }
    setActionType('bank-approval');
  };

  const openWorkCompletionEditor = (job) => {
    const wc = job.workCompletion;
    if (wc) {
      setWorkCompletionStatus(wc.status || 'PENDING');
      setWorkCompletionAmount(wc.amount ? String(wc.amount) : '');
      setWorkCompletionNotes(wc.notes || '');
      setWorkCompletionImg(wc.imageUrl || '');
      setCapturedWorkImg(wc.imageUrl || null);
    } else {
      setWorkCompletionStatus('PENDING');
      setWorkCompletionAmount('');
      setWorkCompletionNotes('');
      setWorkCompletionImg('');
      setCapturedWorkImg(null);
    }
    setActionType('work-completion');
  };

  const openPaymentStatusEditor = (job) => {
    setPaymentStatus(job.paymentStatus || 'PENDING');
    setActionType('payment-status');
  };

  const getPaymentStatusStyle = (status) => {
    switch (status) {
      case 'PAID': return { bg: '#22c55e', color: '#22c55e', label: 'Paid' };
      case 'PARTIAL': return { bg: '#f59e0b', color: '#f59e0b', label: 'Partial' };
      case 'PENDING': default: return { bg: '#64748b', color: '#64748b', label: 'Pending' };
    }
  };

  // Inline helper to get the imageUrl from a quotation invoice with fallback
  const getDocImageUrl = (doc) => doc?.imageUrl || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* HEADER SECTION */}
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Operations Workspace</h1>
          <p>Real-time Employee Control Center & Ingestion Stream</p>
        </div>

        {/* Real-time Activity status card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="field-label" style={{ marginBottom: 0 }}>Activity Status</span>
            <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: myStatus ? '#22c55e' : '#64748b', boxShadow: myStatus ? '0 0 8px #22c55e' : 'none' }}></span>
              <span style={{ fontWeight: 600, color: myStatus ? '#22c55e' : '#94a3b8' }}>
                {myStatus ? 'Active / On Site' : 'Idle / Off Duty'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className={`nexus-btn ${myStatus ? 'nexus-btn-ghost' : 'nexus-btn-primary'}`}
            style={{ padding: '8px 12px', fontSize: 12 }}
            onClick={toggleActiveStatus}
          >
            Switch to {myStatus ? 'Idle' : 'Active'}
          </button>
        </div>
      </header>

      {message && (
        <div className={message.includes('failed') || message.includes('Error') ? 'alert-error' : 'alert-success'}>
          {message}
        </div>
      )}

      {/* METRICS ROW */}
      <section className="glass-card" style={{ padding: '24px 32px' }}>
        <div className="admin-metrics-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {[
            { label: 'Assigned Jobs', value: stats.assigned, color: '#00f2fe', icon: ClipboardList },
            { label: 'Completed Jobs', value: stats.completed, color: '#10b981', icon: CheckCircle },
            { label: 'Survey Reports', value: stats.surveys, color: '#a78bfa', icon: FileText },
            { label: 'Logged Expenses', value: `Rs. ${stats.expenses.toLocaleString()}`, color: '#f87171', icon: DollarSign },
            { label: 'Collected Payments', value: `Rs. ${stats.payments.toLocaleString()}`, color: '#34d399', icon: Check },
          ].map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <div key={idx} className="metric-tile" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="field-label" style={{ marginBottom: 0 }}>{item.label}</span>
                  <IconComponent size={18} color={item.color} />
                </div>
                <div className="metric-digit" style={{ color: item.color, fontSize: 24 }}>{item.value}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* TICKET SUMMARY CARDS */}
      {ticketSummary && (
        <section className="glass-card" style={{ padding: '24px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Activity size={20} color="#00f2fe" />
            <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Ticket Status Overview</h2>
          </div>

          {/* Main Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Tickets', value: ticketSummary.total, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
              { label: 'In Process', value: ticketSummary.inProcess, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
              { label: 'Cancelled', value: ticketSummary.cancelled, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
              { label: 'Completed', value: ticketSummary.completed, color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
            ].map((card) => (
              <div key={card.label} style={{ padding: '20px 16px', background: card.bg, borderRadius: 12, border: `1px solid ${card.color}30`, textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: card.color, marginBottom: 4 }}>{card.value}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Breakdown by Work Nature */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'WAPDA', key: 'WAPDA', icon: '⚡', color: '#f59e0b' },
              { label: 'Electrical', key: 'ELECTRICAL', icon: '🔌', color: '#3b82f6' },
              { label: 'Maintenance', key: 'MAINTENANCE', icon: '🔧', color: '#a78bfa' },
              { label: 'Project', key: 'PROJECT', icon: '📋', color: '#10b981' },
            ].map((dept) => {
              const data = ticketSummary.byNature?.[dept.key] || { inProcess: 0, cancelled: 0, completed: 0 };
              const deptTotal = data.inProcess + data.cancelled + data.completed;
              return (
                <div key={dept.key} style={{ padding: 16, background: 'rgba(0,0,0,0.15)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>{dept.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: dept.color }}>{dept.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 800, color: '#e2e8f0' }}>{deptTotal}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#f59e0b' }}>● In Process</span>
                      <span style={{ fontWeight: 700, color: '#f59e0b' }}>{data.inProcess}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#ef4444' }}>● Cancelled</span>
                      <span style={{ fontWeight: 700, color: '#ef4444' }}>{data.cancelled}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#22c55e' }}>● Completed</span>
                      <span style={{ fontWeight: 700, color: '#22c55e' }}>{data.completed}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 1 }}>
        <button
          type="button"
          onClick={() => { setActiveTab('tasks'); setMessage(''); }}
          className={`nav-panel ${activeTab === 'tasks' ? 'active' : ''}`}
          style={{ padding: '12px 24px', borderRadius: '12px 12px 0 0', border: 'none', background: 'transparent' }}
        >
          My Assigned Jobs ({jobs.length})
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('feed'); setMessage(''); }}
          className={`nav-panel ${activeTab === 'feed' ? 'active' : ''}`}
          style={{ padding: '12px 24px', borderRadius: '12px 12px 0 0', border: 'none', background: 'transparent' }}
        >
          Incoming Ingestion Stream ({filteredTickets.length}/{tickets.length})
        </button>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
          <RefreshCw className="animate-spin" size={32} color="#00f2fe" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8' }}>Updating operational board...</p>
        </div>
      ) : activeTab === 'tasks' ? (
        /* MY ASSIGNED JOBS TAB */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: '#64748b' }} />
            <input
              className="nexus-input"
              style={{ paddingLeft: 32 }}
              placeholder="Search by subject, ticket number, client or branch..."
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
            />
          </div>
          {jobs.length === 0 ? (
            <div className="glass-card" style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
              <AlertCircle size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p>No active jobs currently assigned to you.</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Admins assign incoming tickets from the Job Intake Grid.</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="glass-card" style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
              <AlertCircle size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p>No jobs match your search.</p>
            </div>
          ) : (
            filteredJobs.map((job) => {
              const hasSurvey = !!job.surveyReport;
              const quotations = job.quotationInvoices || [];
              const quotation = quotations.find((q) => q.documentType === 'QUOTATION');
              const invoice = quotations.find((q) => q.documentType === 'INVOICE');
              const hasQuotation = !!quotation;
              const hasInvoice = !!invoice;
              const quotationApproved = quotation?.status === 'APPROVED';
              const hasBankApproval = !!job.bankApproval;
              const bankApproved = job.bankApproval?.status === 'APPROVED';
              const hasWorkCompletion = !!job.workCompletion;
              const workCompleted = job.workCompletion?.status === 'COMPLETED';
              const paymentStatusStyle = getPaymentStatusStyle(job.paymentStatus || 'PENDING');
              
              const totalExpenses = (job.expenses || []).reduce((sum, e) => sum + e.amount, 0);
              const totalPayments = (job.payments || []).reduce((sum, p) => sum + p.amount, 0);

              const isExpanded = expandedJobId === job.id;

              // Checklist steps completed counter
              const stepsDone = [true, hasSurvey, hasQuotation, hasBankApproval, hasWorkCompletion, hasInvoice, totalExpenses > 0, totalPayments > 0].filter(Boolean).length;

              return (
                <div key={job.id} className="glass-card" style={{ padding: 24, border: isExpanded ? '1px solid rgba(0, 242, 254, 0.2)' : '1px solid var(--glass-border)' }}>
                  {/* Job Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        {/* Per-employee intake number: 1, 2, 3... */}
                        <span style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 800, fontSize: 15, padding: '4px 10px', background: 'rgba(0,242,254,0.12)', borderRadius: 6, border: '1px solid rgba(0,242,254,0.2)', minWidth: 36, textAlign: 'center' }}>
                          {jobIntakeNumberMap.get(job.id) ?? '—'}
                        </span>
                        {/* Global ticket serial (reference) */}
                        <span style={{ fontFamily: 'monospace', color: '#475569', fontWeight: 500, fontSize: 11, padding: '2px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }} title="Global Ticket Serial">
                          #{job.ticket?.serialNo}
                        </span>
                        <span className="status-pill active" style={{ fontSize: 11, background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.2)' }}>
                          {job.workNature}
                        </span>
                        {/* Payment Status Badge */}
                        <span style={{ fontSize: 11, background: `${paymentStatusStyle.bg}20`, color: paymentStatusStyle.color, border: `1px solid ${paymentStatusStyle.bg}40`, padding: '3px 8px', borderRadius: 4 }}>
                          Payment: {paymentStatusStyle.label}
                        </span>
                      </div>
                      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{job.clientName}</h2>
                      <p style={{ color: '#94a3b8', fontSize: 14 }}>Site Branch: {job.branchName} · POC: {job.personOfContact}</p>
                      {/* Subject and Creator display */}
                      <p style={{ color: '#64748b', fontSize: 13, marginTop: 4, fontStyle: 'italic' }}>
                        Subject: {job.ticket?.subject || '—'}
                      </p>
                      <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
                        Entered By: <strong style={{ color: '#94a3b8' }}>{job.manualEnteredBy || job.createdBy?.employeeName || 'System'}</strong>
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Assigned on: {new Date(job.createdAt).toLocaleDateString()}
                      </div>
                      <button
                        type="button"
                        className="nexus-btn nexus-btn-ghost"
                        style={{ padding: '8px 12px', fontSize: 12 }}
                        onClick={() => {
                          setExpandedJobId(isExpanded ? null : job.id);
                          setActionType(null);
                        }}
                      >
                        {isExpanded ? 'Collapse Checklist' : 'Update Task Checklist'}
                        <ChevronRight size={14} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Task Checklist Tracker - 8 Steps */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8, marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.15)', borderRadius: 12 }}>
                    {/* Step 1: Intake */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={10} color="#000" />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600 }}>Intake</div>
                        <div style={{ fontSize: 8, color: '#64748b' }}>Done</div>
                      </div>
                    </div>

                    {/* Step 2: Survey */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: hasSurvey ? '#22c55e' : 'rgba(255,255,255,0.05)', border: hasSurvey ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {hasSurvey ? <Check size={10} color="#000" /> : <span style={{ fontSize: 8, color: '#64748b' }}>2</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600 }}>Survey</div>
                        <div style={{ fontSize: 8, color: hasSurvey ? '#22c55e' : '#64748b' }}>{hasSurvey ? 'Filed' : 'Pending'}</div>
                      </div>
                    </div>

                    {/* Step 3: Quotation */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: quotationApproved ? '#22c55e' : (hasQuotation ? '#f59e0b' : 'rgba(255,255,255,0.05)'), border: hasQuotation ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {quotationApproved ? <Check size={10} color="#000" /> : <span style={{ fontSize: 8, color: '#64748b' }}>3</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600 }}>Quotation</div>
                        <div style={{ fontSize: 8, color: quotationApproved ? '#22c55e' : (hasQuotation ? '#f59e0b' : '#64748b') }}>
                          {quotationApproved ? 'Approved' : (hasQuotation ? 'Sent' : 'Pending')}
                        </div>
                      </div>
                    </div>

                    {/* Step 4: Bank Approval */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: bankApproved ? '#22c55e' : (hasBankApproval ? '#f59e0b' : 'rgba(255,255,255,0.05)'), border: hasBankApproval ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {bankApproved ? <Check size={10} color="#000" /> : <span style={{ fontSize: 8, color: '#64748b' }}>4</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600 }}>Bank Appr.</div>
                        <div style={{ fontSize: 8, color: bankApproved ? '#22c55e' : (hasBankApproval ? '#f59e0b' : '#64748b') }}>
                          {bankApproved ? 'Approved' : (hasBankApproval ? 'Sent' : 'Pending')}
                        </div>
                      </div>
                    </div>

                    {/* Step 5: Work Completion */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: workCompleted ? '#22c55e' : (hasWorkCompletion ? '#f59e0b' : 'rgba(255,255,255,0.05)'), border: hasWorkCompletion ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {workCompleted ? <Check size={10} color="#000" /> : <span style={{ fontSize: 8, color: '#64748b' }}>5</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600 }}>Work Compl.</div>
                        <div style={{ fontSize: 8, color: workCompleted ? '#22c55e' : (hasWorkCompletion ? '#f59e0b' : '#64748b') }}>
                          {workCompleted ? 'Done' : (hasWorkCompletion ? 'Progress' : 'Pending')}
                        </div>
                      </div>
                    </div>

                    {/* Step 6: Invoice */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: hasInvoice ? '#22c55e' : 'rgba(255,255,255,0.05)', border: hasInvoice ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {hasInvoice ? <Check size={10} color="#000" /> : <span style={{ fontSize: 8, color: '#64748b' }}>6</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600 }}>Invoice</div>
                        <div style={{ fontSize: 8, color: hasInvoice ? '#22c55e' : '#64748b' }}>{hasInvoice ? 'Filed' : 'Pending'}</div>
                      </div>
                    </div>

                    {/* Step 7: Side Expenses */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: totalExpenses > 0 ? '#22c55e' : 'rgba(255,255,255,0.05)', border: totalExpenses > 0 ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {totalExpenses > 0 ? <Check size={10} color="#000" /> : <span style={{ fontSize: 8, color: '#64748b' }}>7</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600 }}>Expenses</div>
                        <div style={{ fontSize: 8, color: totalExpenses > 0 ? '#22c55e' : '#64748b' }}>
                          {totalExpenses > 0 ? `Rs. ${(totalExpenses/1000).toFixed(1)}k` : 'None'}
                        </div>
                      </div>
                    </div>

                    {/* Step 8: Payment */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: totalPayments > 0 ? '#22c55e' : 'rgba(255,255,255,0.05)', border: totalPayments > 0 ? 'none' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {totalPayments > 0 ? <Check size={10} color="#000" /> : <span style={{ fontSize: 8, color: '#64748b' }}>8</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600 }}>Payment</div>
                        <div style={{ fontSize: 8, color: totalPayments > 0 ? '#22c55e' : '#64748b' }}>
                          {totalPayments > 0 ? `Rs. ${(totalPayments/1000).toFixed(1)}k` : 'Collect'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Summary Bar */}
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${(stepsDone / 8) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #00f2fe, #4facfe)', borderRadius: 2 }}></div>
                    </div>
                    <span style={{ fontSize: 10, color: '#64748b' }}>Checklist: {stepsDone}/8</span>
                  </div>

                  {/* Expanded Task Panels */}
                  {isExpanded && (
                    <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 20 }}>
                      
                      {/* Active Panel Selector Buttons - All 8 options */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={`nexus-btn ${actionType === 'survey' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                          style={{ padding: '7px 12px', fontSize: 12 }}
                          onClick={() => {
                            setActionType(actionType === 'survey' ? null : 'survey');
                            if (job.surveyReport) {
                              setSurveyText(job.surveyReport.reportText);
                              setSurveyImageUrl(job.surveyReport.imageUrl || '');
                              setCapturedSurveyImg(job.surveyReport.imageUrl || null);
                            } else {
                              setSurveyText('');
                              setSurveyImageUrl('');
                              setCapturedSurveyImg(null);
                            }
                          }}
                        >
                          <FileText size={13} /> {hasSurvey ? 'View Survey Report' : 'File Survey Report'}
                        </button>
                        <button
                          type="button"
                          className={`nexus-btn ${actionType === 'quotation' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                          style={{ padding: '7px 12px', fontSize: 12 }}
                          onClick={() => openQuotationEditor(job)}
                        >
                          <Edit3 size={13} /> {hasQuotation ? 'Edit Quotation' : 'Create Quotation'}
                        </button>
                        <button
                          type="button"
                          className={`nexus-btn ${actionType === 'bank-approval' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                          style={{ padding: '7px 12px', fontSize: 12 }}
                          onClick={() => openBankApprovalEditor(job)}
                        >
                          <Banknote size={13} /> {hasBankApproval ? 'Update Bank Appr.' : 'Bank Approval'}
                        </button>
                        <button
                          type="button"
                          className={`nexus-btn ${actionType === 'work-completion' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                          style={{ padding: '7px 12px', fontSize: 12 }}
                          onClick={() => openWorkCompletionEditor(job)}
                        >
                          <Hammer size={13} /> {hasWorkCompletion ? 'Update Work Compl.' : 'Work Completion'}
                        </button>
                        <button
                          type="button"
                          className={`nexus-btn ${actionType === 'invoice' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                          style={{ padding: '7px 12px', fontSize: 12 }}
                          onClick={() => openInvoiceEditor(job)}
                        >
                          <Receipt size={13} /> {hasInvoice ? 'View Invoice' : 'Create Invoice'}
                        </button>
                        <button
                          type="button"
                          className={`nexus-btn ${actionType === 'expense' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                          style={{ padding: '7px 12px', fontSize: 12 }}
                          onClick={() => setActionType(actionType === 'expense' ? null : 'expense')}
                        >
                          <Camera size={13} /> Log Side Expense
                        </button>
                        <button
                          type="button"
                          className={`nexus-btn ${actionType === 'payment-status' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                          style={{ padding: '7px 12px', fontSize: 12 }}
                          onClick={() => openPaymentStatusEditor(job)}
                        >
                          <CreditCard size={13} /> Payment Status
                        </button>
                        <button
                          type="button"
                          className={`nexus-btn ${actionType === 'payment' ? 'nexus-btn-primary' : 'nexus-btn-ghost'}`}
                          style={{ padding: '7px 12px', fontSize: 12 }}
                          onClick={() => setActionType(actionType === 'payment' ? null : 'payment')}
                        >
                          <DollarSign size={13} /> Log Payment
                        </button>
                      </div>

                      {/* Survey Panel */}
                      {actionType === 'survey' && (
                        <div style={{ padding: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Site Survey Report</h3>
                          {hasSurvey ? (
                            <div>
                              <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: 14, color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {job.surveyReport.reportText}
                              </div>
                              {job.surveyReport.imageUrl && (
                                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {job.surveyReport.imageUrl.split(',').map((url, i) => {
                                    const isPdf = isPdfDocumentUrl(url);
                                    return (
                                      <div key={i}>
                                        {isPdf ? (
                                          <div style={{ padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>PDF Document {job.surveyReport.imageUrl.includes(',') ? i + 1 : ''}</div>
                                            <a href={url} target="_blank" rel="noreferrer" className="nexus-btn nexus-btn-primary" style={{ padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                                              View Full PDF Document
                                            </a>
                                          </div>
                                        ) : (
                                          <img src={url} alt={`Survey ${i+1}`} style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }} />
                                        )}
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                                          {isPdf ? 'PDF Document' : 'Photo'} {job.surveyReport.imageUrl.includes(',') ? i + 1 : ''}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <p style={{ fontSize: 11, color: '#64748b', marginTop: 12 }}>Filed in database. Modify below and save to update.</p>
                            </div>
                          ) : (
                            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>Enter details of the on-site checkup and findings to proceed.</p>
                          )}

                          <textarea
                            className="nexus-textarea"
                            value={surveyText}
                            onChange={(e) => setSurveyText(e.target.value)}
                            placeholder="Write comprehensive notes of the survey findings..."
                            style={{ minHeight: 120, marginTop: 12 }}
                          />

                          {/* Survey Image Upload */}
                          <div style={{ marginTop: 16, marginBottom: 12 }}>
                            <label className="field-label">Attach Photo (Optional)</label>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              <button type="button" className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1 }} onClick={() => {
                                const shot = webcamRef.current?.getScreenshot();
                                if (shot) setCapturedSurveyImg(shot);
                              }}>
                                <Camera size={14} /> Capture Photo
                              </button>
                              <label className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1, cursor: 'pointer', textAlign: 'center' }}>
                                <Upload size={14} /> Upload Photo/PDF
                                <input type="file" accept="image/*,application/pdf" hidden multiple onChange={handleSurveyFileUpload} />
                              </label>
                            </div>
                            {(capturedSurveyImg || surveyImageUrl) && (
                              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {capturedSurveyImg && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Image size={14} color="#00f2fe" />
                                    <a href={capturedSurveyImg} target="_blank" rel="noreferrer" style={{ color: '#00f2fe', fontSize: 13 }}>View Captured Photo</a>
                                    <button
                                      type="button"
                                      className="nexus-btn nexus-btn-ghost"
                                      style={{ padding: '2px 8px', fontSize: 10 }}
                                      onClick={() => setCapturedSurveyImg(null)}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                                {surveyImageUrl && surveyImageUrl.split(',').map((url, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Image size={14} color="#00f2fe" />
                                    <a href={url} target="_blank" rel="noreferrer" style={{ color: '#00f2fe', fontSize: 13 }}>View Attached Document/Photo {surveyImageUrl.includes(',') ? i + 1 : ''}</a>
                                    <button
                                      type="button"
                                      className="nexus-btn nexus-btn-ghost"
                                      style={{ padding: '2px 8px', fontSize: 10 }}
                                      onClick={() => {
                                        const arr = surveyImageUrl.split(',');
                                        arr.splice(i, 1);
                                        setSurveyImageUrl(arr.join(','));
                                      }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="nexus-btn nexus-btn-primary"
                            style={{ marginTop: 12 }}
                            onClick={() => submitSurvey(job.id)}
                            disabled={savingSurvey}
                          >
                            <Save size={14} /> {savingSurvey ? 'Saving Report...' : 'Save Survey Report'}
                          </button>
                        </div>
                      )}

                      {/* Quotation Editable Panel */}
                      {actionType === 'quotation' && (
                        <div style={{ padding: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                          <DocumentStudio documentType="QUOTATION" jobId={job.id} job={job} onSaveSuccess={loadDashboardData} />
                        </div>
                      )}

                      {/* Bank Approval Panel */}
                      {actionType === 'bank-approval' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div>
                            <h3 style={{ fontSize: 16, marginBottom: 12 }}>{hasBankApproval ? 'Update Bank Approval' : 'Bank Approval'}</h3>
                            
                            <label className="field-label">Bank Name</label>
                            <input
                              className="nexus-input"
                              value={bankName}
                              onChange={(e) => setBankName(e.target.value)}
                              placeholder="e.g. HBL, UBL, Alfalah"
                              style={{ marginBottom: 12 }}
                            />

                            <label className="field-label">Account Number (Optional)</label>
                            <input
                              className="nexus-input"
                              value={bankAccountNumber}
                              onChange={(e) => setBankAccountNumber(e.target.value)}
                              placeholder="e.g. 1234-5678-9012"
                              style={{ marginBottom: 12 }}
                            />

                            <label className="field-label">Amount (Rs.)</label>
                            <input
                              className="nexus-input"
                              type="number"
                              value={bankAmount}
                              onChange={(e) => setBankAmount(e.target.value)}
                              placeholder="0.00"
                              style={{ marginBottom: 12 }}
                            />

                            <label className="field-label">Status</label>
                            <select
                              className="nexus-input"
                              value={bankStatus}
                              onChange={(e) => setBankStatus(e.target.value)}
                              style={{ marginBottom: 12 }}
                            >
                              <option value="PENDING">Pending</option>
                              <option value="SUBMITTED">Submitted to Bank</option>
                              <option value="APPROVED">Approved</option>
                              <option value="REJECTED">Rejected</option>
                            </select>

                            <label className="field-label">Notes</label>
                            <textarea
                              className="nexus-textarea"
                              value={bankNotes}
                              onChange={(e) => setBankNotes(e.target.value)}
                              placeholder="Additional notes about bank approval..."
                              style={{ minHeight: 60, marginBottom: 12 }}
                            />

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1 }} onClick={() => {
                                const shot = webcamRef.current?.getScreenshot();
                                if (shot) setCapturedBankImg(shot);
                              }}>
                                <Camera size={14} /> Capture Doc
                              </button>
                              <label className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1, cursor: 'pointer', textAlign: 'center' }}>
                                <Upload size={14} /> Upload Doc
                                <input type="file" accept="image/*" hidden onChange={handleBankFileUpload} />
                              </label>
                            </div>

                            <button
                              type="button"
                              className="nexus-btn nexus-btn-primary"
                              style={{ width: '100%', marginTop: 16 }}
                              onClick={() => submitBankApproval(job.id)}
                              disabled={savingBank}
                            >
                              <Save size={14} /> {savingBank ? 'Saving...' : (hasBankApproval ? 'Update Bank Approval' : 'Save Bank Approval')}
                            </button>
                          </div>

                          <div>
                            <label className="field-label">Document Image / Proof</label>
                            <div style={{ borderRadius: 8, overflow: 'hidden', background: '#0a0a0c', height: 230, border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {!capturedBankImg ? (
                                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <img src={capturedBankImg} alt="Bank document" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              )}
                            </div>
                            {capturedBankImg && (
                              <button
                                type="button"
                                className="nexus-btn nexus-btn-ghost"
                                style={{ marginTop: 8, padding: '4px 8px', fontSize: 11 }}
                                onClick={() => { setCapturedBankImg(null); setBankImg(''); }}
                              >
                                Retake Photo
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Work Completion Panel */}
                      {actionType === 'work-completion' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div>
                            <h3 style={{ fontSize: 16, marginBottom: 12 }}>{hasWorkCompletion ? 'Update Work Completion' : 'Work Completion'}</h3>

                            <label className="field-label">Work Status</label>
                            <select
                              className="nexus-input"
                              value={workCompletionStatus}
                              onChange={(e) => setWorkCompletionStatus(e.target.value)}
                              style={{ marginBottom: 12 }}
                            >
                              <option value="PENDING">Pending</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                              <option value="HOLD">On Hold</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>

                            <label className="field-label">Work Amount (Rs.)</label>
                            <input
                              className="nexus-input"
                              type="number"
                              value={workCompletionAmount}
                              onChange={(e) => setWorkCompletionAmount(e.target.value)}
                              placeholder="0.00"
                              style={{ marginBottom: 12 }}
                            />

                            <label className="field-label">Notes</label>
                            <textarea
                              className="nexus-textarea"
                              value={workCompletionNotes}
                              onChange={(e) => setWorkCompletionNotes(e.target.value)}
                              placeholder="Describe work completion details..."
                              style={{ minHeight: 80, marginBottom: 12 }}
                            />

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1 }} onClick={() => {
                                const shot = webcamRef.current?.getScreenshot();
                                if (shot) setCapturedWorkImg(shot);
                              }}>
                                <Camera size={14} /> Capture Photo
                              </button>
                              <label className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1, cursor: 'pointer', textAlign: 'center' }}>
                                <Upload size={14} /> Upload Photo
                                <input type="file" accept="image/*" hidden onChange={handleWorkFileUpload} />
                              </label>
                            </div>

                            <button
                              type="button"
                              className="nexus-btn nexus-btn-primary"
                              style={{ width: '100%', marginTop: 16 }}
                              onClick={() => submitWorkCompletion(job.id)}
                              disabled={savingWork}
                            >
                              <Save size={14} /> {savingWork ? 'Saving...' : (hasWorkCompletion ? 'Update Work Status' : 'Save Work Completion')}
                            </button>
                          </div>

                          <div>
                            <label className="field-label">Work Completion Photo</label>
                            <div style={{ borderRadius: 8, overflow: 'hidden', background: '#0a0a0c', height: 230, border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {!capturedWorkImg ? (
                                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <img src={capturedWorkImg} alt="Work completion" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              )}
                            </div>
                            {capturedWorkImg && (
                              <button
                                type="button"
                                className="nexus-btn nexus-btn-ghost"
                                style={{ marginTop: 8, padding: '4px 8px', fontSize: 11 }}
                                onClick={() => { setCapturedWorkImg(null); setWorkCompletionImg(''); }}
                              >
                                Retake Photo
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Invoice Panel */}
                      {actionType === 'invoice' && (
                        <div style={{ padding: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                          <DocumentStudio documentType="INVOICE" jobId={job.id} job={job} onSaveSuccess={loadDashboardData} />
                        </div>
                      )}

                      {/* Payment Status Panel */}
                      {actionType === 'payment-status' && (
                        <div style={{ padding: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Payment Status</h3>
                          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                            Set the overall payment status for this job. Use this to track whether the client has paid partially, fully, or not yet.
                          </p>

                          <label className="field-label">Select Payment Status</label>
                          <div style={{ display: 'flex', gap: 12, marginTop: 8, marginBottom: 20 }}>
                            {['PENDING', 'PARTIAL', 'PAID'].map((statusOption) => {
                              const isActive = paymentStatus === statusOption;
                              const colors = {
                                PENDING: { bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)', text: '#94a3b8', active: '#64748b' },
                                PARTIAL: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b', active: '#f59e0b' },
                                PAID: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', text: '#22c55e', active: '#22c55e' },
                              }[statusOption];
                              return (
                                <button
                                  key={statusOption}
                                  type="button"
                                  onClick={() => setPaymentStatus(statusOption)}
                                  style={{
                                    flex: 1,
                                    padding: '12px 16px',
                                    borderRadius: 8,
                                    border: isActive ? `2px solid ${colors.active}` : `1px solid ${colors.border}`,
                                    background: isActive ? colors.bg : 'transparent',
                                    color: colors.text,
                                    fontWeight: isActive ? 700 : 400,
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  {statusOption === 'PENDING' ? 'Pending' : statusOption === 'PARTIAL' ? 'Partial Payment' : 'Fully Paid'}
                                </button>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            className="nexus-btn nexus-btn-primary"
                            onClick={() => updatePaymentStatus(job.id)}
                          >
                            <Save size={14} /> Update Payment Status to {paymentStatus === 'PENDING' ? 'Pending' : paymentStatus === 'PARTIAL' ? 'Partial Payment' : 'Fully Paid'}
                          </button>
                        </div>
                      )}

                      {/* Expense Panel */}
                      {actionType === 'expense' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div>
                            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Log Site Expense</h3>
                            <label className="field-label">Amount (Rs.)</label>
                            <input
                              className="nexus-input"
                              type="number"
                              required
                              value={expenseAmount}
                              onChange={(e) => setExpenseAmount(e.target.value)}
                              placeholder="0.00"
                              style={{ marginBottom: 16 }}
                            />

                            <label className="field-label">Expense Notes</label>
                            <textarea
                              className="nexus-textarea"
                              required
                              value={expenseNotes}
                              onChange={(e) => setExpenseNotes(e.target.value)}
                              placeholder="Describe materials purchased, labor costs, etc..."
                              style={{ minHeight: 80, marginBottom: 16 }}
                            />

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1 }} onClick={capturePhoto}>
                                <Camera size={14} /> Capture Receipt
                              </button>
                              <label className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1, cursor: 'pointer', textAlign: 'center' }}>
                                <Upload size={14} /> Upload Image
                                <input type="file" accept="image/*" hidden onChange={handleExpenseFileUpload} />
                              </label>
                            </div>

                            <button
                              type="button"
                              className="nexus-btn nexus-btn-primary"
                              style={{ width: '100%', marginTop: 16 }}
                              onClick={() => submitExpense(job.id)}
                              disabled={savingExpense}
                            >
                              <Save size={14} /> {savingExpense ? 'Logging Expense...' : 'Log Expense'}
                            </button>
                          </div>

                          <div>
                            <label className="field-label">Live Camera Feed / Captured Receipt</label>
                            <div style={{ borderRadius: 8, overflow: 'hidden', background: '#0a0a0c', height: 230, border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {!capturedImg ? (
                                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <img src={capturedImg} alt="Captured receipt" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              )}
                            </div>
                            {capturedImg && (
                              <button
                                type="button"
                                className="nexus-btn nexus-btn-ghost"
                                style={{ marginTop: 8, padding: '4px 8px', fontSize: 11 }}
                                onClick={() => { setCapturedImg(null); setExpenseImg(''); }}
                              >
                                Retake Receipt Photo
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Payment Panel */}
                      {actionType === 'payment' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div>
                            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Log Client Payment</h3>
                            <label className="field-label">Amount Received (Rs.)</label>
                            <input
                              className="nexus-input"
                              type="number"
                              required
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              placeholder="0.00"
                              style={{ marginBottom: 16 }}
                            />

                            <label className="field-label">Tax Deduction (Rs. Optional)</label>
                            <input
                              className="nexus-input"
                              type="number"
                              value={paymentTaxDeducted}
                              onChange={(e) => setPaymentTaxDeducted(e.target.value)}
                              placeholder="0.00"
                              style={{ marginBottom: 16 }}
                            />

                            <label className="field-label">Payment Notes</label>
                            <textarea
                              className="nexus-textarea"
                              required
                              value={paymentNotes}
                              onChange={(e) => setPaymentNotes(e.target.value)}
                              placeholder="Describe payment collection details (e.g. cash, cheque, bank transfer reference)..."
                              style={{ minHeight: 80, marginBottom: 16 }}
                            />

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1 }} onClick={capturePhoto}>
                                <Camera size={14} /> Capture Slip
                              </button>
                              <label className="nexus-btn nexus-btn-ghost" style={{ padding: '8px 12px', fontSize: 12, flex: 1, cursor: 'pointer', textAlign: 'center' }}>
                                <Upload size={14} /> Upload Slip
                                <input type="file" accept="image/*" hidden onChange={handlePaymentFileUpload} />
                              </label>
                            </div>

                            <button
                              type="button"
                              className="nexus-btn nexus-btn-primary"
                              style={{ width: '100%', marginTop: 16 }}
                              onClick={() => submitPayment(job.id)}
                              disabled={savingPayment}
                            >
                              <Save size={14} /> {savingPayment ? 'Logging Payment...' : 'Log Payment'}
                            </button>
                          </div>

                          <div>
                            <label className="field-label">Live Camera Feed / Captured Slip</label>
                            <div style={{ borderRadius: 8, overflow: 'hidden', background: '#0a0a0c', height: 230, border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {!capturedPaymentImg ? (
                                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <img src={capturedPaymentImg} alt="Captured receipt/slip" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              )}
                            </div>
                            {capturedPaymentImg && (
                              <button
                                type="button"
                                className="nexus-btn nexus-btn-ghost"
                                style={{ marginTop: 8, padding: '4px 8px', fontSize: 11 }}
                                onClick={() => { setCapturedPaymentImg(null); setPaymentImg(''); }}
                              >
                                Retake Slip Photo
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Logged Expenses List */}
                      {job.expenses && job.expenses.length > 0 && (
                        <div style={{ padding: 16, background: 'rgba(255,255,255,0.01)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                          <h4 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Expenses History for this Job ({job.expenses.length})</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {job.expenses.map((e, index) => (
                              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 13 }}>
                                <span>{e.summaryNotes}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {e.imageUrl && (
                                    <a href={e.imageUrl} target="_blank" rel="noreferrer" style={{ color: '#00f2fe', fontSize: 11, textDecoration: 'none' }}>📷 Receipt</a>
                                  )}
                                  <span style={{ fontWeight: 600, color: '#f87171' }}>Rs. {e.amount.toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Logged Payments List */}
                      {job.payments && job.payments.length > 0 && (
                        <div style={{ padding: 16, background: 'rgba(255,255,255,0.01)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                          <h4 style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Payments History for this Job ({job.payments.length})</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {job.payments.map((p, index) => (
                              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 13 }}>
                                <span>{p.summaryNotes}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {p.imageUrl && (
                                    <a href={p.imageUrl} target="_blank" rel="noreferrer" style={{ color: '#00f2fe', fontSize: 11, textDecoration: 'none' }}>📷 Receipt</a>
                                  )}
                                  <span style={{ fontWeight: 600, color: '#10b981' }}>Rs. {p.amount.toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ═══════ Uploaded Documents & Photos Gallery ═══════ */}
                      {(() => {
                        const docs = [];
                        // Survey photo
                        if (job.surveyReport?.imageUrl) {
                          job.surveyReport.imageUrl.split(',').forEach((url, i) => {
                            docs.push({ label: `Survey Document/Photo ${job.surveyReport.imageUrl.includes(',') ? i + 1 : ''}`, url: url, date: job.surveyReport.createdAt, by: job.surveyReport.createdBy?.employeeName });
                          });
                        }
                        // Quotation image
                        const quot = (job.quotationInvoices || []).find(q => q.documentType === 'QUOTATION');
                        if (quot?.imageUrl) {
                          docs.push({ label: 'Quotation', url: quot.imageUrl, date: quot.createdAt, by: quot.createdBy?.employeeName });
                        }
                        // Invoice image
                        const inv = (job.quotationInvoices || []).find(q => q.documentType === 'INVOICE');
                        if (inv?.imageUrl) {
                          docs.push({ label: 'Invoice', url: inv.imageUrl, date: inv.createdAt, by: inv.createdBy?.employeeName });
                        }
                        // Bank approval doc
                        if (job.bankApproval?.imageUrl) {
                          docs.push({ label: 'Bank Approval', url: job.bankApproval.imageUrl, date: job.bankApproval.createdAt });
                        }
                        // Work completion photo
                        if (job.workCompletion?.imageUrl) {
                          docs.push({ label: 'Work Completion', url: job.workCompletion.imageUrl, date: job.workCompletion.createdAt });
                        }
                        // Expense receipts
                        (job.expenses || []).forEach((e, i) => {
                          if (e.imageUrl) {
                            docs.push({ label: `Expense #${i + 1}`, url: e.imageUrl, date: e.createdAt, note: e.summaryNotes });
                          }
                        });
                        // Payment receipts
                        (job.payments || []).forEach((p, i) => {
                          if (p.imageUrl) {
                            docs.push({ label: `Payment #${i + 1}`, url: p.imageUrl, date: p.createdAt, note: p.summaryNotes });
                          }
                        });

                        if (docs.length === 0) return null;

                        return (
                          <div style={{ padding: 16, background: 'rgba(255,255,255,0.01)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                            <h4 style={{ fontSize: 13, color: '#00f2fe', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Camera size={14} /> Uploaded Documents & Photos ({docs.length})
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                              {docs.map((doc, idx) => (
                                <a
                                  key={idx}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    textDecoration: 'none',
                                    transition: 'border-color 0.2s, transform 0.2s',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0,242,254,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'none'; }}
                                >
                                  <div style={{ width: '100%', height: 100, overflow: 'hidden', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {renderDocumentPreview(doc)}
                                  </div>
                                  <div style={{ padding: '8px 10px' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>{doc.label}</div>
                                    {doc.by && <div style={{ fontSize: 10, color: '#94a3b8' }}>By: {doc.by}</div>}
                                    {doc.note && <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.note}</div>}
                                    {doc.date && <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>{new Date(doc.date).toLocaleDateString()}</div>}
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>
      ) : (
        /* INCOMING OPERATIONS FEED TAB */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2>Gmail Complaint Ingestion Stream</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="nexus-btn nexus-btn-ghost" onClick={loadDashboardData} style={{ padding: '8px 12px', fontSize: 12 }}>
                <RefreshCw size={14} /> Refresh Stream
              </button>
            </div>
          </div>

          <div className="glass-card" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'minmax(220px, 1.4fr) repeat(3, minmax(150px, 1fr)) auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label className="field-label">Search Gmail / Name</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
                <input
                  className="nexus-input"
                  style={{ paddingLeft: 32 }}
                  placeholder="Gmail, sender, subject, Ibrahim..."
                  value={feedSearch}
                  onChange={(e) => setFeedSearch(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="field-label">Exact Date</label>
              <input className="nexus-input" type="date" value={feedDate} onChange={(e) => setFeedDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Month</label>
              <input className="nexus-input" type="month" value={feedMonth} onChange={(e) => setFeedMonth(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Entered By</label>
              <select className="nexus-select" value={feedPerson} onChange={(e) => setFeedPerson(e.target.value)}>
                <option value="">All people</option>
                {feedPersonOptions.map((person) => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="nexus-btn nexus-btn-ghost"
              style={{ padding: '10px 12px', fontSize: 12 }}
              onClick={() => { setFeedSearch(''); setFeedDate(''); setFeedMonth(''); setFeedPerson(''); }}
            >
              Clear
            </button>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="glass-card" style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
              <AlertCircle size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p>{tickets.length ? 'No feed entries match your filters.' : 'No new complaints in the ingestion stream.'}</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>{tickets.length ? 'Try clearing date, month, or person filters.' : 'The background daemon scanner checks connected Gmails continuously.'}</p>
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div key={ticket.id} className="glass-card ticket-summary" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ background: 'rgba(0,242,254,0.08)', padding: 8, borderRadius: 6 }}>
                      <Mail size={16} color="#00f2fe" />
                    </div>
                    <div>
                      <span className="field-label" style={{ marginBottom: 0, fontSize: 10 }}>Ticket No.</span>
                      <div style={{ fontFamily: 'monospace', color: '#00f2fe', fontWeight: 700, fontSize: 15 }}>{ticket.serialNo}</div>
                    </div>
                  </div>
                  {ticket.jobMetadata && (
                    <span className="status-pill active" style={{ fontSize: 11, background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.2)' }}>
                      {ticket.jobMetadata.workNature}
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <span className="field-label" style={{ marginBottom: 2, fontSize: 10 }}>Subject</span>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4 }}>{ticket.subject}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                  <div>
                    <span className="field-label" style={{ marginBottom: 2, fontSize: 10 }}>From Sender</span>
                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{ticket.sender}</div>
                  </div>
                  <div>
                    <span className="field-label" style={{ marginBottom: 2, fontSize: 10 }}>Received Date / Time</span>
                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>
                      {new Date(ticket.exactDate).toLocaleDateString()} @ {ticket.time}
                    </div>
                  </div>
                </div>

                {/* Entered By info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                  <div>
                    <span className="field-label" style={{ marginBottom: 2, fontSize: 10 }}>Entered By</span>
                    <div style={{ fontSize: 13, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={12} color="#64748b" />
                      {getTicketEntryPerson(ticket)}
                    </div>
                  </div>
                  <div>
                    <span className="field-label" style={{ marginBottom: 2, fontSize: 10 }}>Gmail Account</span>
                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>
                      {ticket.gmailAccount?.gmailEmail || '—'}
                    </div>
                  </div>
                </div>

                {ticket.jobMetadata && (
                  <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, fontSize: 13, color: '#cbd5e1' }}>
                    <span style={{ color: '#00f2fe', fontWeight: 600 }}>{ticket.jobMetadata.clientName}</span>
                    {' · '}Site Branch: {ticket.jobMetadata.branchName}
                    {' · '}POC: {ticket.jobMetadata.personOfContact}
                    {ticket.jobMetadata.assignedEmployee && (
                      <span> · Assigned: {ticket.jobMetadata.assignedEmployee.employeeName}</span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
