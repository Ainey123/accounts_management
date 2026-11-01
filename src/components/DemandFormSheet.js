"use client";

import React, { useState } from 'react';
import { Plus, Trash2, Store, ShoppingBag, Search, X, Check, Box } from 'lucide-react';
import { numberToPkrWords } from '@/lib/projectReportTemplates';
import {
  GROUND_FLOOR_STORE_CATALOG,
  MATERIAL_TYPES,
  SOURCING_MODES,
  searchStoreItems,
  getStoreCategories,
} from '@/lib/storeCatalog';

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

  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [targetCatalogRowIdx, setTargetCatalogRowIdx] = useState(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCat, setCatalogCat] = useState('ALL');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState('ALL');

  const filteredStoreItems = searchStoreItems(catalogSearch, catalogCat, catalogTypeFilter);
  const storeCategories = getStoreCategories();

  const handleSelectCatalogItem = (item) => {
    if (readOnly || !onChange) return;
    let nextItems;
    if (targetCatalogRowIdx !== null && targetCatalogRowIdx >= 0 && targetCatalogRowIdx < matItems.length) {
      nextItems = matItems.map((r, i) =>
        i === targetCatalogRowIdx
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
        ...matItems,
        {
          srNo: String(matItems.length + 1),
          description: item.name,
          requiredQty: '1',
          unit: item.unit || '',
          availableStock: item.stock || '',
          materialType: item.type || MATERIAL_TYPES.CONSUMABLE,
          sourcingMode: SOURCING_MODES.STORE,
        },
      ];
    }
    onChange({ ...formData, items: nextItems });
    setCatalogModalOpen(false);
    setTargetCatalogRowIdx(null);
  };

  const handleRemoveMaterialRow = (idx) => {
    if (readOnly || !onChange || matItems.length <= 1) return;
    const nextItems = matItems
      .filter((_, i) => i !== idx)
      .map((r, i) => ({ ...r, srNo: String(i + 1) }));
    onChange({ ...formData, items: nextItems });
  };

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
        materialType: MATERIAL_TYPES.CONSUMABLE,
        sourcingMode: SOURCING_MODES.STORE,
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

      {/* ── MATERIAL SOURCING BREAKDOWN BAR ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#f1f5f9',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          marginBottom: 12,
          fontSize: 12,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: '#16325c' }}>Sourcing Summary:</span>
          <span style={{ color: '#0369a1', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Store size={14} /> Store Issue: {matItems.filter((i) => (i.sourcingMode || 'Buy from Store') === 'Buy from Store').length} items (Stock Deducted)
          </span>
          <span style={{ color: '#b45309', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ShoppingBag size={14} /> Self Buy: {matItems.filter((i) => (i.sourcingMode || '') === 'Self Buy').length} items (Market Purchase)
          </span>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              setTargetCatalogRowIdx(null);
              setCatalogModalOpen(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              background: '#16325c',
              color: '#ffffff',
              fontSize: 11.5,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Store size={13} /> Select from Ground Floor Store (460 Items)
          </button>
        )}
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
          MATERIAL DETAILS & SOURCING
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
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ background: '#16325c', color: '#ffffff', fontWeight: 700 }}>
              <th style={{ padding: '8px 4px', width: 40, textAlign: 'center', borderRight: '1px solid #335280' }}>
                Sr.
              </th>
              <th style={{ padding: '8px 8px', textAlign: 'left', borderRight: '1px solid #335280' }}>
                Material Description / Specification
              </th>
              <th style={{ padding: '8px 6px', width: 125, textAlign: 'center', borderRight: '1px solid #335280' }}>
                Classification
              </th>
              <th style={{ padding: '8px 6px', width: 145, textAlign: 'center', borderRight: '1px solid #335280' }}>
                Sourcing Choice
              </th>
              <th style={{ padding: '8px 6px', width: 75, textAlign: 'center', borderRight: '1px solid #335280' }}>
                Req. Qty.
              </th>
              <th style={{ padding: '8px 6px', width: 65, textAlign: 'center', borderRight: '1px solid #335280' }}>
                Unit
              </th>
              <th style={{ padding: '8px 6px', width: 85, textAlign: 'center', borderRight: readOnly ? 'none' : '1px solid #335280' }}>
                Stock
              </th>
              {!readOnly && (
                <th style={{ padding: '8px 4px', width: 36, textAlign: 'center' }}>
                  Del
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {matItems.map((row, idx) => {
              const isSelfBuy = (row.sourcingMode || '').toLowerCase().includes('self');
              const matType = row.materialType || MATERIAL_TYPES.CONSUMABLE;
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
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
                  <td style={{ borderRight: '1px solid #cbd5e1', padding: '2px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="text"
                        readOnly={readOnly}
                        placeholder={readOnly ? '' : 'Enter material or pick from store...'}
                        value={row.description || ''}
                        onChange={(e) => handleMaterialRowChange(idx, 'description', e.target.value)}
                        style={cellInputStyle(readOnly, 'left')}
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          title="Pick from Ground Floor Store Catalog"
                          onClick={() => {
                            setTargetCatalogRowIdx(idx);
                            setCatalogModalOpen(true);
                          }}
                          style={{
                            background: '#e2e8f0',
                            border: '1px solid #94a3b8',
                            borderRadius: 4,
                            padding: '3px 6px',
                            cursor: 'pointer',
                            color: '#16325c',
                            fontSize: 10,
                            fontWeight: 700,
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Store size={11} /> Store
                        </button>
                      )}
                    </div>
                  </td>
                  <td style={{ borderRight: '1px solid #cbd5e1', padding: '2px 4px', textAlign: 'center' }}>
                    {readOnly ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: matType === MATERIAL_TYPES.FIXED ? '#f3e8ff' : matType === MATERIAL_TYPES.RETURNABLE ? '#e0f2fe' : '#ecfdf5',
                          color: matType === MATERIAL_TYPES.FIXED ? '#7e22ce' : matType === MATERIAL_TYPES.RETURNABLE ? '#0369a1' : '#047857',
                        }}
                      >
                        {matType.replace(' Material', '')}
                      </span>
                    ) : (
                      <select
                        value={matType}
                        onChange={(e) => handleMaterialRowChange(idx, 'materialType', e.target.value)}
                        style={{
                          width: '100%',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 4px',
                          border: '1px solid #cbd5e1',
                          borderRadius: 4,
                          background: '#ffffff',
                          color: '#0f172a',
                          cursor: 'pointer',
                        }}
                      >
                        <option value={MATERIAL_TYPES.CONSUMABLE}>Consumable</option>
                        <option value={MATERIAL_TYPES.RETURNABLE}>Returnable Tool</option>
                        <option value={MATERIAL_TYPES.FIXED}>Fixed Asset</option>
                      </select>
                    )}
                  </td>
                  <td style={{ borderRight: '1px solid #cbd5e1', padding: '2px 4px', textAlign: 'center' }}>
                    {readOnly ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: isSelfBuy ? '#fef3c7' : '#e0f2fe',
                          color: isSelfBuy ? '#92400e' : '#075985',
                        }}
                      >
                        {isSelfBuy ? 'Self Buy' : 'Store Issue'}
                      </span>
                    ) : (
                      <div
                        style={{
                          display: 'inline-flex',
                          background: '#e2e8f0',
                          padding: 2,
                          borderRadius: 6,
                          fontSize: 10.5,
                          fontWeight: 700,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleMaterialRowChange(idx, 'sourcingMode', SOURCING_MODES.STORE)}
                          style={{
                            border: 'none',
                            padding: '3px 7px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            background: !isSelfBuy ? '#16325c' : 'transparent',
                            color: !isSelfBuy ? '#ffffff' : '#64748b',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Store size={10} /> Store
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMaterialRowChange(idx, 'sourcingMode', SOURCING_MODES.SELF_BUY)}
                          style={{
                            border: 'none',
                            padding: '3px 7px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            background: isSelfBuy ? '#b45309' : 'transparent',
                            color: isSelfBuy ? '#ffffff' : '#64748b',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <ShoppingBag size={10} /> Self Buy
                        </button>
                      </div>
                    )}
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
                      placeholder={readOnly ? '' : 'Unit'}
                      value={row.unit || ''}
                      onChange={(e) => handleMaterialRowChange(idx, 'unit', e.target.value)}
                      style={cellInputStyle(readOnly, 'center')}
                    />
                  </td>
                  <td style={{ borderRight: readOnly ? 'none' : '1px solid #cbd5e1', padding: 0 }}>
                    <input
                      type="text"
                      readOnly={readOnly}
                      placeholder={readOnly ? '' : isSelfBuy ? 'N/A' : 'Stock'}
                      value={row.availableStock || ''}
                      onChange={(e) => handleMaterialRowChange(idx, 'availableStock', e.target.value)}
                      style={cellInputStyle(readOnly, 'center')}
                    />
                  </td>
                  {!readOnly && (
                    <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                      {matItems.length > 1 && (
                        <button
                          type="button"
                          title="Delete row"
                          onClick={() => handleRemoveMaterialRow(idx)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: 2,
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── GROUND FLOOR STORE CATALOG MODAL ── */}
      {catalogModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              width: '100%',
              maxWidth: 820,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              border: '1px solid #cbd5e1',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                background: '#16325c',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Store size={18} color="#38bdf8" />
                  GROUND FLOOR STORE INVENTORY CATALOG
                </div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                  Pick from 460+ available store items (Fixed assets, Consumables, and Returnable tools)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCatalogModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: 6,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <X size={14} /> Close
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Search
                  size={16}
                  color="#64748b"
                  style={{ position: 'absolute', left: 12, top: 11 }}
                />
                <input
                  type="text"
                  placeholder="Search item name, cable size, spanner, breaker, pipe, tool..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
              </div>

              {/* Classification filter pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {[
                  { id: 'ALL', label: 'All Types' },
                  { id: MATERIAL_TYPES.CONSUMABLE, label: 'Consumable' },
                  { id: MATERIAL_TYPES.RETURNABLE, label: 'Returnable Tool' },
                  { id: MATERIAL_TYPES.FIXED, label: 'Fixed Asset' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCatalogTypeFilter(t.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: catalogTypeFilter === t.id ? '#16325c' : '#cbd5e1',
                      background: catalogTypeFilter === t.id ? '#16325c' : '#ffffff',
                      color: catalogTypeFilter === t.id ? '#ffffff' : '#475569',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Category selector */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {storeCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCat(cat)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 10.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: catalogCat === cat ? '#0284c7' : '#e2e8f0',
                      background: catalogCat === cat ? '#e0f2fe' : '#ffffff',
                      color: catalogCat === cat ? '#0369a1' : '#64748b',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Item List */}
            <div style={{ overflowY: 'auto', padding: '12px 20px', flex: 1 }}>
              {filteredStoreItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                  No store items found matching your search.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 }}>
                  {filteredStoreItems.map((item) => {
                    const isFixed = item.type === MATERIAL_TYPES.FIXED;
                    const isRet = item.type === MATERIAL_TYPES.RETURNABLE;
                    return (
                      <div
                        key={item.id}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '10px 12px',
                          background: '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                          transition: 'border-color 0.2s',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: isFixed ? '#f3e8ff' : isRet ? '#e0f2fe' : '#ecfdf5',
                                color: isFixed ? '#7e22ce' : isRet ? '#0369a1' : '#047857',
                              }}
                            >
                              {item.type.replace(' Material', '')}
                            </span>
                            <span style={{ fontSize: 10.5, color: '#64748b' }}>{item.category}</span>
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                            Stock: <strong style={{ color: '#059669' }}>{item.stock}</strong> &nbsp;•&nbsp; Loc: {item.location}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectCatalogItem(item)}
                          style={{
                            background: '#16325c',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Check size={12} /> Select
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
