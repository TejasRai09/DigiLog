const MD_DATASETS = {
  'indent-purchase': {
    slot: 'indent-purchase',
    dataset: 'centre_indent_purchase',
    label: 'Centre Indent & Purchase',
    hint: 'One file — 1st sheet: indent (Code, Center Name, Indent Date, No of Purchy, Qty in Qtls, Category). 2nd sheet: purchase (c_Code, Purchase Date, No of Purchy, Qty in Qtls, Category, Center).',
    category: 'Management Dashboard — Centre Indent & Purchase',
    accept: '.xlsx,.xls',
  },
  dmr: {
    slot: 'dmr',
    dataset: 'dmr_workbook',
    label: 'DMR workbook',
    hint: 'Single-sheet DMR (.xlsx) — Sheet1, header row must match DMR_season template (206 columns incl. Date, Crop Day)',
    category: 'Management Dashboard — DMR Workbook',
    accept: '.xlsx,.xls',
  },
};

/** Old separate indent/purchase uploads still listed in history. */
const LEGACY_MD_DATASETS = {
  indent: {
    slot: 'indent',
    dataset: 'centre_indent',
    category: 'Management Dashboard — Centre Indent',
  },
  purchase: {
    slot: 'purchase',
    dataset: 'centre_purchase',
    category: 'Management Dashboard — Centre Purchase',
  },
};

const MD_SLOT_ALIASES = {
  indent: 'indent-purchase',
  purchase: 'indent-purchase',
  cane: 'indent-purchase',
};

const MD_CATEGORIES = new Set([
  ...Object.values(MD_DATASETS).map((d) => d.category),
  ...Object.values(LEGACY_MD_DATASETS).map((d) => d.category),
]);

const MD_ALLOWED_DATASETS = new Set([
  ...Object.values(MD_DATASETS).map((d) => d.dataset),
  ...Object.values(LEGACY_MD_DATASETS).map((d) => d.dataset),
]);

function resolveMdSlot(slot) {
  const key = String(slot || '').trim().toLowerCase();
  const canonical = MD_SLOT_ALIASES[key] || key;
  return MD_DATASETS[canonical] || null;
}

function mdDatasetFromSlot(slot) {
  return resolveMdSlot(slot)?.dataset || null;
}

function mdSlotFromCategory(category) {
  const hit = Object.values(MD_DATASETS).find((d) => d.category === category);
  if (hit) return hit.slot;
  const legacy = Object.values(LEGACY_MD_DATASETS).find((d) => d.category === category);
  return legacy ? 'indent-purchase' : null;
}

function isManagementDashboardCategory(category) {
  return MD_CATEGORIES.has(category);
}

module.exports = {
  MD_DATASETS,
  LEGACY_MD_DATASETS,
  MD_SLOT_ALIASES,
  MD_CATEGORIES,
  MD_ALLOWED_DATASETS,
  resolveMdSlot,
  mdDatasetFromSlot,
  mdSlotFromCategory,
  isManagementDashboardCategory,
};
