/**
 * Official Fast Engineering Solutions (FES) Templates:
 * 1. FES_PROJECT_SITES — Canonical Field Portal Project Options
 * 2. PROJECT_PROGRESS_TEMPLATE — Exact 9-Page Construction Site / Bank Branch Progress Report
 * 3. PROJECT_EXPENSE_TEMPLATE — Construction Expense Categories (retained for office/modal compatibility)
 */

export const FES_PROJECT_SITES = [
  {
    key: 'manawala',
    label: 'Manawala',
    branchName: 'Manawala',
    subtitle: 'Construction Site / Branch Project',
  },
  {
    key: 'kanjwahl',
    label: 'Kanjwahl',
    branchName: 'Kanjwahl',
    subtitle: 'Construction Site / Branch Project',
  },
  {
    key: 'muradshah',
    label: 'Muradshah',
    branchName: 'Muradshah',
    subtitle: 'Construction Site / Branch Project',
  },
  {
    key: 'tordywala',
    label: 'Tordywala',
    branchName: 'Tordywala',
    subtitle: 'Construction Site / Branch Project',
  },
  {
    key: 'other',
    label: 'Other',
    branchName: 'Other',
    subtitle: 'Custom / Additional Site Project',
  },
];

export const PROJECT_STATUS_OPTIONS = [
  { value: 'NOT_STARTED', label: 'Not Started', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.16)' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.16)' },
  { value: 'ON_HOLD', label: 'Pending / Delayed', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.16)' },
  { value: 'COMPLETED', label: 'Completed', color: '#34d399', bg: 'rgba(52, 211, 153, 0.16)' },
];

export const DEMAND_TYPE_OPTIONS = [
  {
    value: 'MATERIAL',
    label: 'Material Demand',
    subtitle: 'Request funds/approval for construction & site material purchase',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.14)',
    border: 'rgba(251, 191, 36, 0.45)',
  },
  {
    value: 'PAYMENT',
    label: 'Payment Demand',
    subtitle: 'Request site labour wages, contractor, or operational payment',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.14)',
    border: 'rgba(56, 189, 248, 0.45)',
  },
];

export const DEMAND_STATUS_OPTIONS = [
  {
    value: 'HOLD',
    label: 'Hold',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.16)',
    border: 'rgba(251, 191, 36, 0.45)',
  },
  {
    value: 'ACCEPT',
    label: 'Accept',
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.16)',
    border: 'rgba(52, 211, 153, 0.45)',
  },
  {
    value: 'REJECT',
    label: 'Reject',
    color: '#f87171',
    bg: 'rgba(248, 113, 113, 0.16)',
    border: 'rgba(248, 113, 113, 0.45)',
  },
];

function makeAdditionalRows(count = 4) {
  return Array.from({ length: count }, () => ({
    code: '',
    name: '',
    unit: '',
    workPercent: '',
    remark: '',
    others: '',
    isCustom: true,
  }));
}

export const PROJECT_PROGRESS_TEMPLATE = [
  {
    id: 1,
    sectionCode: '01',
    title: 'CIVIL & FINISHING WORK',
    subtitle: 'Civil & Finishing Work',
    overallSectionProgress: '',
    pendingItems: '',
    siteIssues: '',
    supervisorSignature: '',
    verifiedBy: '',
    items: [
      { code: '1', name: 'Dismantling work', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '2', name: 'Excavation work', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '3', name: 'Back filling', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '4', name: 'P.C.C. floor', unit: 'sft', workPercent: '', remark: '', others: '' },
      { code: '5', name: 'R.C.C. walls', unit: 'sft', workPercent: '', remark: '', others: '' },
      { code: '6', name: 'Genset platform', unit: 'sft', workPercent: '', remark: '', others: '' },
      { code: '7', name: '4-inch brick work', unit: 'sft', workPercent: '', remark: '', others: '' },
      { code: '8', name: '9-inch brick work', unit: 'sft', workPercent: '', remark: '', others: '' },
      { code: '9', name: 'Plaster work', unit: 'sft', workPercent: '', remark: '', others: '' },
      { code: '10', name: 'Tile work', unit: 'sft', workPercent: '', remark: '', others: '' },
      { code: '11', name: 'ACP cladding', unit: 'sft', workPercent: '', remark: '', others: '' },
      { code: '12', name: 'Laminate wood flooring', unit: 'sft', workPercent: '', remark: '', others: '' },
      { code: '13', name: 'Marble work', unit: 'sft', workPercent: '', remark: '', others: '' },
      { code: '14', name: 'Paint work', unit: 'sft', workPercent: '', remark: '', others: '' },
      ...makeAdditionalRows(4),
    ],
  },
  {
    id: 2,
    sectionCode: '02',
    title: 'ELECTRICAL WORK',
    subtitle: 'Electrical Work',
    overallSectionProgress: '',
    pendingItems: '',
    siteIssues: '',
    supervisorSignature: '',
    verifiedBy: '',
    items: [
      { code: '1', name: 'Roof slab conduit piping', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '2', name: 'Floor conduit piping', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '3', name: 'Wall cutting / chasing', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '4', name: 'Distribution panels fitting', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '5', name: 'Main cable installation', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '6', name: 'Lighting wires', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '7', name: 'Circuit wiring', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '8', name: 'Electrical boxes fitting', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '9', name: 'Light fixtures installation', unit: 'Job', workPercent: '', remark: '', others: '' },
      ...makeAdditionalRows(4),
    ],
  },
  {
    id: 3,
    sectionCode: '03',
    title: 'HVAC SYSTEM',
    subtitle: 'HVAC System',
    overallSectionProgress: '',
    pendingItems: '',
    siteIssues: '',
    supervisorSignature: '',
    verifiedBy: '',
    items: [
      { code: '1', name: 'Wall cutting for copper pipes', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '2', name: 'Copper piping', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '3', name: 'Condensate drain piping', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '4', name: 'AC units inspection', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '5', name: 'AC units installation', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '6', name: 'Leakage testing', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '7', name: 'Outdoor brackets', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '8', name: 'Indoor brackets', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '9', name: 'AC commissioning', unit: 'Job', workPercent: '', remark: '', others: '' },
      ...makeAdditionalRows(4),
    ],
  },
  {
    id: 4,
    sectionCode: '04',
    title: 'PLUMBING WORK',
    subtitle: 'Plumbing Work',
    overallSectionProgress: '',
    pendingItems: '',
    siteIssues: '',
    supervisorSignature: '',
    verifiedBy: '',
    items: [
      { code: '1', name: 'Kitchen sink PPRC piping', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '2', name: 'Washroom PPRC piping', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '3', name: 'Pipe route inspection', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '4', name: 'Kitchen 4-inch sewerage pipe', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '5', name: 'Washroom sewerage piping', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '6', name: 'Roof water tank installation', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '7', name: 'Sanitary fittings', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '8', name: 'Porta fittings', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '9', name: 'PPRC / PVC pipe testing', unit: 'Job', workPercent: '', remark: '', others: '' },
      ...makeAdditionalRows(4),
    ],
  },
  {
    id: 5,
    sectionCode: '05',
    title: 'IT & NETWORKING WORK',
    subtitle: 'IT & Networking Work',
    overallSectionProgress: '',
    pendingItems: '',
    siteIssues: '',
    supervisorSignature: '',
    verifiedBy: '',
    items: [
      { code: '1', name: '27U IT rack', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '2', name: 'Network points', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '3', name: 'Conduit route inspection', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '4', name: 'Telephone points', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '5', name: 'Cable trays', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '6', name: 'Power distribution units (PDU)', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '7', name: 'Cable dressing / tagging', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '8', name: 'Cable managers', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '9', name: 'Patch panel installation', unit: 'Job', workPercent: '', remark: '', others: '' },
      ...makeAdditionalRows(4),
    ],
  },
  {
    id: 6,
    sectionCode: '06',
    title: 'WOOD & JOINERY WORK',
    subtitle: 'Wood & Joinery Work',
    overallSectionProgress: '',
    pendingItems: '',
    siteIssues: '',
    supervisorSignature: '',
    verifiedBy: '',
    items: [
      { code: '1', name: 'Cash counter back logo', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '2', name: 'Kitchen cabinets', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '3', name: 'Countertop cabinets', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '4', name: 'Door fitting', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '5', name: 'M.S. doors', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '6', name: 'PVC doors', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '7', name: 'Rafter ceiling', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '8', name: 'Store cabinets', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '9', name: 'Wooden beams', unit: 'Job', workPercent: '', remark: '', others: '' },
      ...makeAdditionalRows(4),
    ],
  },
  {
    id: 7,
    sectionCode: '07',
    title: 'CEILING WORK',
    subtitle: 'Ceiling Work',
    overallSectionProgress: '',
    pendingItems: '',
    siteIssues: '',
    supervisorSignature: '',
    verifiedBy: '',
    items: [
      { code: '1', name: '12 mm gypsum ceiling', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '2', name: '2 x 2 panel ceiling', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '3', name: 'Cement board ceiling', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '4', name: 'Level checking', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '5', name: 'Perimeter angles', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '6', name: 'Cement board columns', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '7', name: 'Ceiling height checking', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '8', name: 'Ceiling installation', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '9', name: 'Suspension rods', unit: 'Job', workPercent: '', remark: '', others: '' },
      ...makeAdditionalRows(4),
    ],
  },
  {
    id: 8,
    sectionCode: '08',
    title: 'GLASS & ALUMINIUM WORK',
    subtitle: 'Glass & Aluminium Work',
    overallSectionProgress: '',
    pendingItems: '',
    siteIssues: '',
    supervisorSignature: '',
    verifiedBy: '',
    items: [
      { code: '1', name: '12 mm tempered glass', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '2', name: 'Door handles', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '3', name: 'Tempered glass doors', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '4', name: 'Front window aluminium section', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '5', name: 'Glass door motor', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '6', name: 'Clear / white glass', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '7', name: 'Black top and bottom patch', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '8', name: 'Washroom mirror', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '9', name: '8 mm glass partition', unit: 'Job', workPercent: '', remark: '', others: '' },
      ...makeAdditionalRows(4),
    ],
  },
  {
    id: 9,
    sectionCode: '09',
    title: 'PAINTING WORK',
    subtitle: 'Painting Work',
    overallSectionProgress: '',
    pendingItems: '',
    siteIssues: '',
    supervisorSignature: '',
    verifiedBy: '',
    items: [
      { code: '1', name: 'ICI paint application', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '2', name: 'Light grey wall paint', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '3', name: 'Three coats of wall paint', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '4', name: 'Surface preparation / putty', unit: 'Job', workPercent: '', remark: '', others: '' },
      { code: '5', name: 'Primer / undercoat', unit: 'Job', workPercent: '', remark: '', others: '' },
      ...makeAdditionalRows(4),
    ],
  },
];

export function cloneFreshProgressTemplate() {
  return JSON.parse(JSON.stringify(PROJECT_PROGRESS_TEMPLATE));
}

/**
 * Merges saved progressData (including legacy formats) onto the official 9-page template
 * so no progress values are lost while always preserving the official FES layout.
 */
export function normalizeProgressSections(rawProgressData) {
  const base = cloneFreshProgressTemplate();
  if (!rawProgressData) return base;

  let parsed = rawProgressData;
  if (typeof rawProgressData === 'string') {
    try {
      parsed = JSON.parse(rawProgressData);
    } catch {
      return base;
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return base;

  return base.map((templateSec, secIdx) => {
    const savedSec = parsed.find((s) => Number(s.id) === Number(templateSec.id)) || parsed[secIdx];
    if (!savedSec) return templateSec;

    const savedStandard = (savedSec.items || []).filter((it) => !it.isCustom);
    const savedCustom = (savedSec.items || []).filter((it) => it.isCustom);
    const templateStandard = templateSec.items.filter((it) => !it.isCustom);

    const mergedStandard = templateStandard.map((tItem, idx) => {
      const match = savedStandard[idx];
      if (!match) return tItem;
      return {
        ...tItem,
        unit: match.unit === 'Jop' ? 'Job' : (match.unit || tItem.unit),
        workPercent: match.workPercent ?? '',
        remark: match.remark ?? '',
        others: match.others ?? '',
      };
    });

    let mergedCustom = makeAdditionalRows(4);
    if (savedCustom.length > 0) {
      const filledOrNeeded = Math.max(4, savedCustom.length);
      mergedCustom = Array.from({ length: filledOrNeeded }, (_, idx) => {
        const sc = savedCustom[idx];
        return {
          code: '',
          name: sc?.name || '',
          unit: sc?.unit === 'Jop' ? 'Job' : (sc?.unit || ''),
          workPercent: sc?.workPercent ?? '',
          remark: sc?.remark ?? '',
          others: sc?.others ?? '',
          isCustom: true,
        };
      });
    }

    return {
      ...templateSec,
      sheetMeta: savedSec.sheetMeta || undefined,
      overallSectionProgress: savedSec.overallSectionProgress ?? '',
      pendingItems: savedSec.pendingItems ?? '',
      siteIssues: savedSec.siteIssues ?? '',
      supervisorSignature: savedSec.supervisorSignature ?? '',
      verifiedBy: savedSec.verifiedBy ?? '',
      items: [...mergedStandard, ...mergedCustom],
    };
  });
}

/**
 * Extracts Material, Labour, and Other expense items + totals from saved expenseData & job expenses.
 */
export function extractProjectExpenses(rawExpenseData, jobExpenses = [], linkedExpenseId = null) {
  const entries = [];

  if (rawExpenseData) {
    let parsed = rawExpenseData;
    if (typeof rawExpenseData === 'string') {
      try {
        parsed = JSON.parse(rawExpenseData);
      } catch {
        parsed = [];
      }
    }

    if (Array.isArray(parsed)) {
      parsed.forEach((sec) => {
        const secType = sec.categoryType || '';
        (sec.items || []).forEach((it, idx) => {
          const amt = parseFloat(it.amount);
          if ((isNaN(amt) || amt <= 0) && !it.qty && !it.others && !it.entryId) return;
          if (!secType && it.isCustom && !it.name && (isNaN(amt) || amt <= 0)) return;

          const lowerName = (it.name || '').toLowerCase();
          let resolvedType = secType;
          if (!resolvedType) {
            if (lowerName.includes('layber') || lowerName.includes('labour') || lowerName.includes('labor')) {
              resolvedType = 'LABOUR';
            } else {
              resolvedType = 'MATERIAL';
            }
          }

          entries.push({
            id: it.entryId || `${sec.id || 0}-${idx}-${resolvedType}`,
            type: resolvedType, // 'MATERIAL' | 'LABOUR' | 'OTHER'
            name: it.name || (resolvedType === 'LABOUR' ? 'Labour Work' : 'Site Material'),
            qty: it.qty || '',
            amount: !isNaN(amt) && amt > 0 ? amt : 0,
            date: it.date || '',
            paidBy: it.paidBy || 'FES',
            remarks: it.others || it.remark || '',
            receiptUrl: it.receiptUrl || '',
          });
        });
      });
    }
  }

  // Also include standalone job expenses that were logged outside the report's linkedExpenseId
  if (Array.isArray(jobExpenses)) {
    jobExpenses.forEach((exp) => {
      if (linkedExpenseId && Number(exp.id) === Number(linkedExpenseId)) return;
      if ((exp.summaryNotes || '').includes('[Project Report #')) return;
      const amt = parseFloat(exp.amount) || 0;
      if (amt <= 0) return;
      const catLower = `${exp.category || ''} ${exp.summaryNotes || ''}`.toLowerCase();
      let type = 'MATERIAL';
      if (catLower.includes('labour') || catLower.includes('labor') || catLower.includes('layber')) {
        type = 'LABOUR';
      } else if (catLower.includes('material')) {
        type = 'MATERIAL';
      }
      entries.push({
        id: `db-exp-${exp.id}`,
        dbExpenseId: exp.id,
        type,
        name: exp.summaryNotes?.replace(/^\[Field Work\]\s*/i, '') || exp.category || 'Site Expense',
        qty: '',
        amount: amt,
        date: exp.expenseDate ? new Date(exp.expenseDate).toISOString().split('T')[0] : '',
        paidBy: exp.paidBy || 'FES',
        remarks: '',
        receiptUrl: exp.imageUrl || '',
        fromStandaloneExpense: true,
      });
    });
  }

  let materialExpense = 0;
  let labourExpense = 0;
  let otherExpense = 0;

  entries.forEach((e) => {
    const val = parseFloat(e.amount) || 0;
    if (e.type === 'LABOUR') labourExpense += val;
    else if (e.type === 'MATERIAL') materialExpense += val;
    else otherExpense += val;
  });

  const projectExpense = materialExpense + labourExpense + otherExpense;

  return {
    entries,
    materialExpense,
    labourExpense,
    otherExpense,
    projectExpense,
  };
}

/**
 * Serializes flat expense entries back into sections compatible with ProjectReportReviewer & PDF export.
 */
export function buildExpenseSectionsFromEntries(entries = []) {
  const cleanEntries = entries.filter((e) => !e.fromStandaloneExpense);
  const materialItems = cleanEntries
    .filter((e) => e.type === 'MATERIAL')
    .map((e, i) => ({
      entryId: e.id,
      code: String(i + 1),
      name: e.name || 'Material Item',
      qty: e.qty || '',
      amount: String(parseFloat(e.amount) || 0),
      date: e.date || '',
      paidBy: e.paidBy || 'FES',
      others: e.remarks || '',
      receiptUrl: e.receiptUrl || '',
      isCustom: false,
    }));

  const labourItems = cleanEntries
    .filter((e) => e.type === 'LABOUR')
    .map((e, i) => ({
      entryId: e.id,
      code: String(i + 1),
      name: e.name || 'Labour Cost',
      qty: e.qty || '',
      amount: String(parseFloat(e.amount) || 0),
      date: e.date || '',
      paidBy: e.paidBy || 'FES',
      others: e.remarks || '',
      receiptUrl: e.receiptUrl || '',
      isCustom: false,
    }));

  const otherItems = cleanEntries
    .filter((e) => e.type !== 'MATERIAL' && e.type !== 'LABOUR')
    .map((e, i) => ({
      entryId: e.id,
      code: String(i + 1),
      name: e.name || 'Project Expense',
      qty: e.qty || '',
      amount: String(parseFloat(e.amount) || 0),
      date: e.date || '',
      paidBy: e.paidBy || 'FES',
      others: e.remarks || '',
      receiptUrl: e.receiptUrl || '',
      isCustom: false,
    }));

  const sections = [
    {
      id: 1,
      title: 'Material Expenses',
      subtitle: 'Construction & Site Materials',
      categoryType: 'MATERIAL',
      items: materialItems,
    },
    {
      id: 2,
      title: 'Labour Expenses',
      subtitle: 'Site Workforce & Wages',
      categoryType: 'LABOUR',
      items: labourItems,
    },
  ];

  if (otherItems.length > 0) {
    sections.push({
      id: 3,
      title: 'Other Project Expenses',
      subtitle: 'Transport, Fuel & Site Operations',
      categoryType: 'OTHER',
      items: otherItems,
    });
  }

  return sections;
}

export const PROJECT_EXPENSE_TEMPLATE = [
  {
    id: 1,
    title: 'Material Expenses',
    subtitle: 'Construction & Site Materials',
    categoryType: 'MATERIAL',
    items: [
      { code: '1', name: 'Cement', qty: '', amount: '', others: '' },
      { code: '2', name: 'Sand & Crush / Aggregate', qty: '', amount: '', others: '' },
      { code: '3', name: 'Steel Reinforcement / Bricks', qty: '', amount: '', others: '' },
      { code: '4', name: 'Tiles, Marble & Flooring Material', qty: '', amount: '', others: '' },
      { code: '5', name: 'Electrical Cables, Conduits & Panels', qty: '', amount: '', others: '' },
      { code: '6', name: 'PPRC / PVC Plumbing & Sanitary Fittings', qty: '', amount: '', others: '' },
      { code: '7', name: 'HVAC Copper Piping & Brackets', qty: '', amount: '', others: '' },
      { code: '8', name: 'IT Networking Cables, Rack & Patch Panel', qty: '', amount: '', others: '' },
      { code: '9', name: 'Wood Sheets, Doors & Joinery Material', qty: '', amount: '', others: '' },
      { code: '10', name: 'Gypsum / 2x2 Ceiling & Glass / Aluminium', qty: '', amount: '', others: '' },
      { code: '11', name: 'ICI Paint, Putty & Primer Material', qty: '', amount: '', others: '' },
    ],
  },
  {
    id: 2,
    title: 'Labour Expenses',
    subtitle: 'Site Workforce & Wages',
    categoryType: 'LABOUR',
    items: [
      { code: '1', name: 'Civil & Masonry Labour', qty: '', amount: '', others: '' },
      { code: '2', name: 'Electrical Installation Labour', qty: '', amount: '', others: '' },
      { code: '3', name: 'Plumbing & HVAC Labour', qty: '', amount: '', others: '' },
      { code: '4', name: 'Wood, Ceiling & Glass Labour', qty: '', amount: '', others: '' },
      { code: '5', name: 'Painting & Finishing Labour', qty: '', amount: '', others: '' },
    ],
  },
];
