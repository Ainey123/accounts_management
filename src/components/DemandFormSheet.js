"use client";

import React from 'react';
import { Plus } from 'lucide-react';
import { numberToPkrWords } from '@/lib/projectReportTemplates';

const underlineInputStyle = (readOnly) => ({
  border: 'none',
  borderBottom: '1px solid #475569',
  background: readOnly ? 'transparent' : '#f8fafc',
  color: '#0f172a',
  fontSize: 12.5,
  fontWeight: 600,
  padding: '2px 6px',
  outline: 'none',
  minWidth: 120,
});

const cellInputStyle = (readOnly, align = 'left') => ({
  width: '100%',
  border: 'none',
  background: 'transparent',
  color: '#0f172a',
  fontSize: 12.5,
  padding: '6px 8px',
  textAlign: align,
  outline: 'none',
  boxSizing: 'border-box',
  cursor: readOnly ? 'default' : 'text',
});

export default function DemandFormSheet({
  type = 'MATERIAL',
  formData = {},
  onChange,
  onSuggestedAmountChange,
  readOnly = false,
}) {
  const updateField = (key, val) => {
    if (readOnly || !onChange) return;
    onChange({ ...formData, [key]: val });
  };

  if (type === 'PAYMENT') {
    const items = Array.isArray(formData.items) ? formData.items : [];
    const docs = formData.supportingDocs || {};

    const recomputePaymentTotals = (nextItems, nextIssuedStr) => {
      let rowSum = 0;
      let anyNumeric = false;
      nextItems.forEach((it) => {
        const v = parseFloat(it.amount);
        if (!isNaN(v) && v > 0) {
          rowSum += v;
          anyNumeric = true;
        }
      });

      const issuedNum = parseFloat(nextIssuedStr) || 0;
      const totalReq = anyNumeric ? rowSum : parseFloat(formData.totalAmountRequired) || 0;
      const netDemanded = Math.max(0, totalReq - issuedNum);

      const updated = {
        ...formData,
        items: nextItems,
        amountAlreadyIssued: nextIssuedStr,
        totalAmountRequired: totalReq > 0 ? String(totalReq) : '',
        netAmountDemanded: netDemanded > 0 ? String(netDemanded) : totalReq > 0 ? '0' : '',
        amountInWords: netDemanded > 0 ? numberToPkrWords(netDemanded) : formData.amountInWords || '',
      };

      onChange?.(updated);
      if (onSuggestedAmountChange && netDemanded > 0) {
        onSuggestedAmountChange(String(netDemanded));
      }
    };

    const handlePaymentRowChange = (idx, field, val) => {
      if (readOnly || !onChange) return;
      const nextItems = items.map((row, i) => (i === idx ? { ...row, [field]: val } : row));
      if (field === 'amount') {
        recomputePaymentTotals(nextItems, formData.amountAlreadyIssued || '');
      } else {
        onChange({ ...formData, items: nextItems });
      }
    };

    const handleAddPaymentRow = () => {
      if (readOnly || !onChange) return;
      const nextItems = [
        ...items,
        { srNo: String(items.length + 1), description: '', amount: '', remarks: '' },
      ];
      onChange({ ...formData, items: nextItems });
    };

    const handleIssuedChange = (val) => {
      if (readOnly || !onChange) return;
      const totalReq = parseFloat(formData.totalAmountRequired) || 0;
      const issued = parseFloat(val) || 0;
      const netDemanded = Math.max(0, totalReq - issued);
      onChange({
        ...formData,
        amountAlreadyIssued: val,
        netAmountDemanded: totalReq > 0 ? String(netDemanded) : formData.netAmountDemanded || '',
        amountInWords: netDemanded > 0 ? numberToPkrWords(netDemanded) : formData.amountInWords || '',
      });
      if (onSuggestedAmountChange && netDemanded >= 0 && totalReq > 0) {
        onSuggestedAmountChange(String(netDemanded));
      }
    };

    const handleNetDemandedManual = (val) => {
      if (readOnly || !onChange) return;
      const netNum = parseFloat(val) || 0;
      onChange({
        ...formData,
        netAmountDemanded: val,
        amountInWords: netNum > 0 ? numberToPkrWords(netNum) : '',
      });
      if (onSuggestedAmountChange) {
        onSuggestedAmountChange(val);
      }
    };

    const toggleDoc = (docKey, checked) => {
      if (readOnly || !onChange) return;
      onChange({
        ...formData,
        supportingDocs: {
          ...docs,
          [docKey]: checked,
        },
      });
    };

    return (
      <div
        style={{
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: 10,
          padding: '28px 32px 22px 32px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          border: '1px solid #cbd5e1',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        {/* ── OFFICIAL FES HEADER: SITE PAYMENT DEMAND FORM ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ width: 96, height: 96, flexShrink: 0 }}>
            <img
              src="/fes-logo-cropped.png"
              alt="FES Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 240 }}>
            <div
              style={{
                fontSize: 23,
                fontWeight: 800,
                color: '#16325c',
                letterSpacing: 0.6,
              }}
            >
              FAST ENGINEERING SOLUTIONS
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: '#cc1f1f',
                marginTop: 4,
                letterSpacing: 0.4,
              }}
            >
              SITE PAYMENT DEMAND FORM
            </div>
          </div>
        </div>

        {/* ── METADATA 4x2 TABLE ── */}
        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #cbd5e1',
              fontSize: 12.5,
            }}
          >
            <tbody>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <td style={{ padding: '8px 12px', width: '52%', borderRight: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>Payment Demand No.:</strong>
                    <input
                      type="text"
                      readOnly={readOnly}
                      placeholder="PD-001"
                      value={formData.paymentDemandNo || ''}
                      onChange={(e) => updateField('paymentDemandNo', e.target.value)}
                      style={{ ...underlineInputStyle(readOnly), flex: 1 }}
                    />
                  </div>
                </td>
                <td style={{ padding: '8px 12px', width: '48%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>Date:</strong>
                    <input
                      type={readOnly ? 'text' : 'date'}
                      readOnly={readOnly}
                      value={formData.date || ''}
                      onChange={(e) => updateField('date', e.target.value)}
                      style={{ ...underlineInputStyle(readOnly), flex: 1 }}
                    />
                  </div>
                </td>
              </tr>

              <tr style={{ background: '#ffffff', borderBottom: '1px solid #cbd5e1' }}>
                <td style={{ padding: '8px 12px', borderRight: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>Project / Site Name:</strong>
                    <input
                      type="text"
                      readOnly={readOnly}
                      placeholder="Site / Branch Name"
                      value={formData.projectSiteName || ''}
                      onChange={(e) => updateField('projectSiteName', e.target.value)}
                      style={{ ...underlineInputStyle(readOnly), flex: 1 }}
                    />
                  </div>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>Site Location:</strong>
                    <input
                      type="text"
                      readOnly={readOnly}
                      placeholder="City / Location"
                      value={formData.siteLocation || ''}
                      onChange={(e) => updateField('siteLocation', e.target.value)}
                      style={{ ...underlineInputStyle(readOnly), flex: 1 }}
                    />
                  </div>
                </td>
              </tr>

              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <td style={{ padding: '8px 12px', borderRight: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>Client / Bank:</strong>
                    <input
                      type="text"
                      readOnly={readOnly}
                      placeholder="Client / Bank Name"
                      value={formData.clientBank || ''}
                      onChange={(e) => updateField('clientBank', e.target.value)}
                      style={{ ...underlineInputStyle(readOnly), flex: 1 }}
                    />
                  </div>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>Branch / Ticket No.:</strong>
                    <input
                      type="text"
                      readOnly={readOnly}
                      placeholder="Branch Code / Ticket #"
                      value={formData.branchTicketNo || ''}
                      onChange={(e) => updateField('branchTicketNo', e.target.value)}
                      style={{ ...underlineInputStyle(readOnly), flex: 1 }}
                    />
                  </div>
                </td>
              </tr>

              <tr style={{ background: '#ffffff' }}>
                <td style={{ padding: '8px 12px', borderRight: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>Site In-Charge:</strong>
                    <input
                      type="text"
                      readOnly={readOnly}
                      placeholder="Supervisor Name"
                      value={formData.siteInCharge || ''}
                      onChange={(e) => updateField('siteInCharge', e.target.value)}
                      style={{ ...underlineInputStyle(readOnly), flex: 1 }}
                    />
                  </div>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>Contact No.:</strong>
                    <input
                      type="text"
                      readOnly={readOnly}
                      placeholder="03XX-XXXXXXX"
                      value={formData.contactNo || ''}
                      onChange={(e) => updateField('contactNo', e.target.value)}
                      style={{ ...underlineInputStyle(readOnly), flex: 1 }}
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── PAYMENT REQUIREMENT DETAILS TABLE ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: '#16325c', letterSpacing: 0.3 }}>
            PAYMENT REQUIREMENT DETAILS
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddPaymentRow}
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid #16325c',
                background: '#eef2f8',
                color: '#16325c',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Plus size={12} /> Add Row
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto', marginBottom: 14 }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #cbd5e1',
              fontSize: 12.5,
            }}
          >
            <thead>
              <tr style={{ background: '#16325c', color: '#ffffff', fontWeight: 700 }}>
                <th style={{ padding: '9px 6px', width: 52, textAlign: 'center', borderRight: '1px solid #335280' }}>
                  Sr.
                </th>
                <th style={{ padding: '9px 10px', textAlign: 'left', borderRight: '1px solid #335280' }}>
                  Description / Purpose
                </th>
                <th style={{ padding: '9px 10px', width: 155, textAlign: 'right', borderRight: '1px solid #335280' }}>
                  Amount (PKR)
                </th>
                <th style={{ padding: '9px 10px', width: 185, textAlign: 'left' }}>
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1', background: '#ffffff' }}>
                  <td
                    style={{
                      textAlign: 'center',
                      fontWeight: 600,
                      borderRight: '1px solid #cbd5e1',
                      padding: '6px 4px',
                      color: '#334155',
                    }}
                  >
                    {row.srNo || idx + 1}
                  </td>
                  <td style={{ borderRight: '1px solid #cbd5e1', padding: 0 }}>
                    <input
                      type="text"
                      readOnly={readOnly}
                      placeholder={readOnly ? '' : 'Enter payment description / purpose...'}
                      value={row.description || ''}
                      onChange={(e) => handlePaymentRowChange(idx, 'description', e.target.value)}
                      style={cellInputStyle(readOnly, 'left')}
                    />
                  </td>
                  <td style={{ borderRight: '1px solid #cbd5e1', padding: 0 }}>
                    <input
                      type={readOnly ? 'text' : 'number'}
                      min="0"
                      step="any"
                      readOnly={readOnly}
                      placeholder={readOnly ? '' : '0'}
                      value={row.amount || ''}
                      onChange={(e) => handlePaymentRowChange(idx, 'amount', e.target.value)}
                      style={{ ...cellInputStyle(readOnly, 'right'), fontWeight: 700 }}
                    />
                  </td>
                  <td style={{ padding: 0 }}>
                    <input
                      type="text"
                      readOnly={readOnly}
                      placeholder={readOnly ? '' : 'Remarks...'}
                      value={row.remarks || ''}
                      onChange={(e) => handlePaymentRowChange(idx, 'remarks', e.target.value)}
                      style={cellInputStyle(readOnly, 'left')}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 4-ROW FINANCIAL SUMMARY TABLE ── */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #cbd5e1',
            marginBottom: 14,
            fontSize: 12.5,
          }}
        >
          <tbody>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <td style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong>Total Amount Required (PKR):</strong>
                <input
                  type={readOnly ? 'text' : 'number'}
                  min="0"
                  step="any"
                  readOnly={readOnly}
                  placeholder="0"
                  value={formData.totalAmountRequired || ''}
                  onChange={(e) => updateField('totalAmountRequired', e.target.value)}
                  style={{ ...underlineInputStyle(readOnly), fontWeight: 700, width: 180 }}
                />
              </td>
            </tr>
            <tr style={{ background: '#ffffff', borderBottom: '1px solid #cbd5e1' }}>
              <td style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong>Amount Already Issued / Available (PKR):</strong>
                <input
                  type={readOnly ? 'text' : 'number'}
                  min="0"
                  step="any"
                  readOnly={readOnly}
                  placeholder="0"
                  value={formData.amountAlreadyIssued || ''}
                  onChange={(e) => handleIssuedChange(e.target.value)}
                  style={{ ...underlineInputStyle(readOnly), width: 180 }}
                />
              </td>
            </tr>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <td style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong>Net Amount Demanded (PKR):</strong>
                <input
                  type={readOnly ? 'text' : 'number'}
                  min="0"
                  step="any"
                  readOnly={readOnly}
                  placeholder="0"
                  value={formData.netAmountDemanded || ''}
                  onChange={(e) => handleNetDemandedManual(e.target.value)}
                  style={{ ...underlineInputStyle(readOnly), fontWeight: 800, color: '#16325c', width: 180 }}
                />
              </td>
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong>Amount in Words:</strong>
                <input
                  type="text"
                  readOnly={readOnly}
                  placeholder="Amount in words..."
                  value={formData.amountInWords || ''}
                  onChange={(e) => updateField('amountInWords', e.target.value)}
                  style={{ ...underlineInputStyle(readOnly), flex: 1, minWidth: 240 }}
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── PURPOSE & SUPPORTING DOCUMENTS ── */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #cbd5e1',
            marginBottom: 16,
            fontSize: 12.5,
          }}
        >
          <tbody>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <td style={{ padding: '7px 12px', fontWeight: 700 }}>
                Purpose / Justification for Payment:
              </td>
            </tr>
            <tr style={{ background: '#ffffff', borderBottom: '1px solid #cbd5e1' }}>
              <td style={{ padding: '4px 8px' }}>
                <input
                  type="text"
                  readOnly={readOnly}
                  placeholder={readOnly ? '' : 'Enter purpose / justification for payment...'}
                  value={formData.purposeJustification || ''}
                  onChange={(e) => updateField('purposeJustification', e.target.value)}
                  style={cellInputStyle(readOnly, 'left')}
                />
              </td>
            </tr>
            <tr style={{ background: '#f8fafc' }}>
              <td style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <strong>Supporting Documents Attached:</strong>
                  {[
                    { key: 'estimateBoq', label: 'Estimate/BOQ' },
                    { key: 'invoice', label: 'Invoice' },
                    { key: 'receipts', label: 'Receipts' },
                    { key: 'other', label: 'Other:' },
                  ].map((chk) => (
                    <label
                      key={chk.key}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: readOnly ? 'default' : 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={Boolean(docs[chk.key])}
                        onChange={(e) => toggleDoc(chk.key, e.target.checked)}
                        style={{ accentColor: '#16325c', width: 14, height: 14 }}
                      />
                      <span>{chk.label}</span>
                    </label>
                  ))}
                  <input
                    type="text"
                    readOnly={readOnly}
                    placeholder="Specify other..."
                    value={docs.otherText || ''}
                    onChange={(e) =>
                      !readOnly &&
                      onChange?.({
                        ...formData,
                        supportingDocs: { ...docs, otherText: e.target.value },
                      })
                    }
                    style={{ ...underlineInputStyle(readOnly), width: 150 }}
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── SIGNATURES TABLE ── */}
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #cbd5e1',
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ background: '#e8eff7', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '7px 10px', textAlign: 'left', width: '33.33%', borderRight: '1px solid #cbd5e1' }}>
                  Requested By
                </th>
                <th style={{ padding: '7px 10px', textAlign: 'left', width: '33.33%', borderRight: '1px solid #cbd5e1' }}>
                  Verified By
                </th>
                <th style={{ padding: '7px 10px', textAlign: 'left', width: '33.33%' }}>
                  Approved By
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#ffffff' }}>
                <td style={{ padding: '4px 8px', borderRight: '1px solid #cbd5e1' }}>
                  <input
                    type="text"
                    readOnly={readOnly}
                    placeholder="Requested By Name"
                    value={formData.requestedByName || ''}
                    onChange={(e) => updateField('requestedByName', e.target.value)}
                    style={cellInputStyle(readOnly)}
                  />
                </td>
                <td style={{ padding: '4px 8px', borderRight: '1px solid #cbd5e1' }}>
                  <input
                    type="text"
                    readOnly={readOnly}
                    placeholder="Verified By"
                    value={formData.verifiedByName || ''}
                    onChange={(e) => updateField('verifiedByName', e.target.value)}
                    style={cellInputStyle(readOnly)}
                  />
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <input
                    type="text"
                    readOnly={readOnly}
                    placeholder="Approved By"
                    value={formData.approvedByName || ''}
                    onChange={(e) => updateField('approvedByName', e.target.value)}
                    style={cellInputStyle(readOnly)}
                  />
                </td>
              </tr>
              <tr style={{ background: '#ffffff' }}>
                <td style={{ padding: '7px 10px', borderRight: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>Name / Signature:</span>
                    <input
                      type="text"
                      readOnly={readOnly}
                      value={formData.requestedBySign || ''}
                      onChange={(e) => updateField('requestedBySign', e.target.value)}
                      style={{ ...underlineInputStyle(readOnly), flex: 1, minWidth: 80 }}
                    />
                  </div>
                </td>
                <td style={{ padding: '7px 10px', borderRight: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>Name / Signature:</span>
                    <input
                      type="text"
                      readOnly={readOnly}
                      value={formData.verifiedBySign || ''}
                      onChange={(e) => updateField('verifiedBySign', e.target.value)}
                      style={{ ...underlineInputStyle(readOnly), flex: 1, minWidth: 80 }}
                    />
                  </div>
                </td>
                <td style={{ padding: '7px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>Name / Signature:</span>
                    <input
                      type="text"
                      readOnly={readOnly}
                      value={formData.approvedBySign || ''}
                      onChange={(e) => updateField('approvedBySign', e.target.value)}
                      style={{ ...underlineInputStyle(readOnly), flex: 1, minWidth: 80 }}
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── OFFICIAL FOOTER ── */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 14 }}>
          For site-related material, labour, transport, subcontractor and other project expenses.
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT: MATERIAL DEMAND / REQUISITION FORM (PDF #1)
  // ═══════════════════════════════════════════════════════════════════════════
  const matItems = Array.isArray(formData.items) ? formData.items : [];

  const handleMaterialRowChange = (idx, field, val) => {
    if (readOnly || !onChange) return;
    const nextItems = matItems.map((row, i) => (i === idx ? { ...row, [field]: val } : row));
    onChange({ ...formData, items: nextItems });
  };

  const handleAddMaterialRow = () => {
    if (readOnly || !onChange) return;
    const nextItems = [
      ...matItems,
      {
        srNo: String(matItems.length + 1),
        description: '',
        requiredQty: '',
        unit: '',
        availableStock: '',
      },
    ];
    onChange({ ...formData, items: nextItems });
  };

  return (
    <div
      style={{
        background: '#ffffff',
        color: '#0f172a',
        borderRadius: 10,
        padding: '28px 32px 22px 32px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        border: '1px solid #cbd5e1',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      {/* ── OFFICIAL FES HEADER: MATERIAL DEMAND / REQUISITION FORM ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ width: 96, height: 96, flexShrink: 0 }}>
          <img
            src="/fes-logo-cropped.png"
            alt="FES Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <div style={{ flex: 1, textAlign: 'center', minWidth: 240 }}>
          <div
            style={{
              fontSize: 23,
              fontWeight: 800,
              color: '#16325c',
              letterSpacing: 0.6,
            }}
          >
            FAST ENGINEERING SOLUTIONS
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: '#cc1f1f',
              marginTop: 4,
              letterSpacing: 0.4,
            }}
          >
            MATERIAL DEMAND / REQUISITION FORM
          </div>
        </div>
      </div>

      {/* ── METADATA 4-ROW TABLE ── */}
      <div style={{ overflowX: 'auto', marginBottom: 18 }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #cbd5e1',
            fontSize: 12.5,
          }}
        >
          <tbody>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <td style={{ padding: '8px 12px', width: '52%', borderRight: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>Requisition No.:</strong>
                  <input
                    type="text"
                    readOnly={readOnly}
                    placeholder="MR-001"
                    value={formData.requisitionNo || ''}
                    onChange={(e) => updateField('requisitionNo', e.target.value)}
                    style={{ ...underlineInputStyle(readOnly), flex: 1 }}
                  />
                </div>
              </td>
              <td style={{ padding: '8px 12px', width: '48%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>Date:</strong>
                  <input
                    type={readOnly ? 'text' : 'date'}
                    readOnly={readOnly}
                    value={formData.date || ''}
                    onChange={(e) => updateField('date', e.target.value)}
                    style={{ ...underlineInputStyle(readOnly), flex: 1 }}
                  />
                </div>
              </td>
            </tr>

            <tr style={{ background: '#ffffff', borderBottom: '1px solid #cbd5e1' }}>
              <td colSpan={2} style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>Project / Branch Name:</strong>
                  <input
                    type="text"
                    readOnly={readOnly}
                    placeholder="Project / Branch Name"
                    value={formData.projectBranchName || ''}
                    onChange={(e) => updateField('projectBranchName', e.target.value)}
                    style={{ ...underlineInputStyle(readOnly), flex: 1, minWidth: 240 }}
                  />
                </div>
              </td>
            </tr>

            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <td colSpan={2} style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>Site Location:</strong>
                  <input
                    type="text"
                    readOnly={readOnly}
                    placeholder="Site Address / Location"
                    value={formData.siteLocation || ''}
                    onChange={(e) => updateField('siteLocation', e.target.value)}
                    style={{ ...underlineInputStyle(readOnly), flex: 1, minWidth: 240 }}
                  />
                </div>
              </td>
            </tr>

            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '8px 12px', borderRight: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>Requested By:</strong>
                  <input
                    type="text"
                    readOnly={readOnly}
                    placeholder="Supervisor / Employee Name"
                    value={formData.requestedBy || ''}
                    onChange={(e) => updateField('requestedBy', e.target.value)}
                    style={{ ...underlineInputStyle(readOnly), flex: 1 }}
                  />
                </div>
              </td>
              <td style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>Required Delivery Date:</strong>
                  <input
                    type={readOnly ? 'text' : 'date'}
                    readOnly={readOnly}
                    value={formData.requiredDeliveryDate || ''}
                    onChange={(e) => updateField('requiredDeliveryDate', e.target.value)}
                    style={{ ...underlineInputStyle(readOnly), flex: 1 }}
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── MATERIAL DETAILS TABLE ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: '#16325c', letterSpacing: 0.3 }}>
          MATERIAL DETAILS
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={handleAddMaterialRow}
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #16325c',
              background: '#eef2f8',
              color: '#16325c',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Plus size={12} /> Add Row
          </button>
        )}
      </div>

      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #cbd5e1',
            fontSize: 12.5,
          }}
        >
          <thead>
            <tr style={{ background: '#16325c', color: '#ffffff', fontWeight: 700 }}>
              <th style={{ padding: '9px 6px', width: 58, textAlign: 'center', borderRight: '1px solid #335280' }}>
                Sr. No.
              </th>
              <th style={{ padding: '9px 10px', textAlign: 'left', borderRight: '1px solid #335280' }}>
                Material Description / Specification
              </th>
              <th style={{ padding: '9px 8px', width: 115, textAlign: 'center', borderRight: '1px solid #335280' }}>
                Required Qty.
              </th>
              <th style={{ padding: '9px 8px', width: 90, textAlign: 'center', borderRight: '1px solid #335280' }}>
                Unit
              </th>
              <th style={{ padding: '9px 8px', width: 125, textAlign: 'center' }}>
                Available Stock
              </th>
            </tr>
          </thead>
          <tbody>
            {matItems.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1', background: '#ffffff' }}>
                <td
                  style={{
                    textAlign: 'center',
                    fontWeight: 600,
                    borderRight: '1px solid #cbd5e1',
                    padding: '6px 4px',
                    color: '#334155',
                  }}
                >
                  {row.srNo || idx + 1}
                </td>
                <td style={{ borderRight: '1px solid #cbd5e1', padding: 0 }}>
                  <input
                    type="text"
                    readOnly={readOnly}
                    placeholder={readOnly ? '' : 'Enter material description / specification...'}
                    value={row.description || ''}
                    onChange={(e) => handleMaterialRowChange(idx, 'description', e.target.value)}
                    style={cellInputStyle(readOnly, 'left')}
                  />
                </td>
                <td style={{ borderRight: '1px solid #cbd5e1', padding: 0 }}>
                  <input
                    type="text"
                    readOnly={readOnly}
                    placeholder={readOnly ? '' : 'Qty'}
                    value={row.requiredQty || ''}
                    onChange={(e) => handleMaterialRowChange(idx, 'requiredQty', e.target.value)}
                    style={cellInputStyle(readOnly, 'center')}
                  />
                </td>
                <td style={{ borderRight: '1px solid #cbd5e1', padding: 0 }}>
                  <input
                    type="text"
                    readOnly={readOnly}
                    placeholder={readOnly ? '' : 'Bags / Nos / sft'}
                    value={row.unit || ''}
                    onChange={(e) => handleMaterialRowChange(idx, 'unit', e.target.value)}
                    style={cellInputStyle(readOnly, 'center')}
                  />
                </td>
                <td style={{ padding: 0 }}>
                  <input
                    type="text"
                    readOnly={readOnly}
                    placeholder={readOnly ? '' : 'Stock'}
                    value={row.availableStock || ''}
                    onChange={(e) => handleMaterialRowChange(idx, 'availableStock', e.target.value)}
                    style={cellInputStyle(readOnly, 'center')}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── PURPOSE & REMARKS TABLE ── */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #cbd5e1',
          marginBottom: 16,
          fontSize: 12.5,
        }}
      >
        <tbody>
          <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '7px 12px', fontWeight: 700 }}>
              Purpose / Work Description:
            </td>
          </tr>
          <tr style={{ background: '#ffffff', borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '4px 8px' }}>
              <input
                type="text"
                readOnly={readOnly}
                placeholder={readOnly ? '' : 'Enter purpose / work description...'}
                value={formData.purpose || ''}
                onChange={(e) => updateField('purpose', e.target.value)}
                style={cellInputStyle(readOnly, 'left')}
              />
            </td>
          </tr>
          <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
            <td style={{ padding: '7px 12px', fontWeight: 700 }}>
              Remarks:
            </td>
          </tr>
          <tr style={{ background: '#ffffff' }}>
            <td style={{ padding: '4px 8px' }}>
              <input
                type="text"
                readOnly={readOnly}
                placeholder={readOnly ? '' : 'Enter any remarks...'}
                value={formData.remarks || ''}
                onChange={(e) => updateField('remarks', e.target.value)}
                style={cellInputStyle(readOnly, 'left')}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── SIGNATURES TABLE ── */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #cbd5e1',
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ background: '#e8eff7', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '7px 10px', textAlign: 'left', width: '33.33%', borderRight: '1px solid #cbd5e1' }}>
                Requested By
              </th>
              <th style={{ padding: '7px 10px', textAlign: 'left', width: '33.33%', borderRight: '1px solid #cbd5e1' }}>
                Checked By
              </th>
              <th style={{ padding: '7px 10px', textAlign: 'left', width: '33.33%' }}>
                Approved By
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#ffffff' }}>
              <td style={{ padding: '4px 8px', borderRight: '1px solid #cbd5e1' }}>
                <input
                  type="text"
                  readOnly={readOnly}
                  placeholder="Requested By Name"
                  value={formData.requestedByName || ''}
                  onChange={(e) => updateField('requestedByName', e.target.value)}
                  style={cellInputStyle(readOnly)}
                />
              </td>
              <td style={{ padding: '4px 8px', borderRight: '1px solid #cbd5e1' }}>
                <input
                  type="text"
                  readOnly={readOnly}
                  placeholder="Checked By"
                  value={formData.checkedByName || ''}
                  onChange={(e) => updateField('checkedByName', e.target.value)}
                  style={cellInputStyle(readOnly)}
                />
              </td>
              <td style={{ padding: '4px 8px' }}>
                <input
                  type="text"
                  readOnly={readOnly}
                  placeholder="Approved By"
                  value={formData.approvedByName || ''}
                  onChange={(e) => updateField('approvedByName', e.target.value)}
                  style={cellInputStyle(readOnly)}
                />
              </td>
            </tr>
            <tr style={{ background: '#ffffff' }}>
              <td style={{ padding: '7px 10px', borderRight: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Signature:</span>
                  <input
                    type="text"
                    readOnly={readOnly}
                    value={formData.requestedBySign || ''}
                    onChange={(e) => updateField('requestedBySign', e.target.value)}
                    style={{ ...underlineInputStyle(readOnly), flex: 1, minWidth: 80 }}
                  />
                </div>
              </td>
              <td style={{ padding: '7px 10px', borderRight: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Signature:</span>
                  <input
                    type="text"
                    readOnly={readOnly}
                    value={formData.checkedBySign || ''}
                    onChange={(e) => updateField('checkedBySign', e.target.value)}
                    style={{ ...underlineInputStyle(readOnly), flex: 1, minWidth: 80 }}
                  />
                </div>
              </td>
              <td style={{ padding: '7px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Signature:</span>
                  <input
                    type="text"
                    readOnly={readOnly}
                    value={formData.approvedBySign || ''}
                    onChange={(e) => updateField('approvedBySign', e.target.value)}
                    style={{ ...underlineInputStyle(readOnly), flex: 1, minWidth: 80 }}
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── OFFICIAL FOOTER ── */}
      <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 14 }}>
        Construction &bull; Civil Works &bull; Electrical Works &bull; Maintenance
      </div>
    </div>
  );
}
