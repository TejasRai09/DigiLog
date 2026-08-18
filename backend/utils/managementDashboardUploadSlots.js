const MD_DATASETS = {
  indent: {
    slot: 'indent',
    dataset: 'centre_indent',
    label: 'Centre Indent',
    hint: 'Sheet1 columns: Code, Center Name, Indent Date, No of Purchy, Qty in Qtls, Category',
    category: 'Management Dashboard — Centre Indent',
    accept: '.xlsx,.xls',
  },
  purchase: {
    slot: 'purchase',
    dataset: 'centre_purchase',
    label: 'Centre Purchase',
    hint: 'Sheet1 columns: c_Code, Purchase Date, No of Purchy, Qty in Qtls, Category, Center',
    category: 'Management Dashboard — Centre Purchase',
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

const MD_CATEGORIES = new Set(Object.values(MD_DATASETS).map((d) => d.category));

function mdDatasetFromSlot(slot) {
  return MD_DATASETS[slot]?.dataset || null;
}

function mdSlotFromCategory(category) {
  const hit = Object.values(MD_DATASETS).find((d) => d.category === category);
  return hit?.slot || null;
}

function isManagementDashboardCategory(category) {
  return MD_CATEGORIES.has(category);
}

module.exports = {
  MD_DATASETS,
  MD_CATEGORIES,
  mdDatasetFromSlot,
  mdSlotFromCategory,
  isManagementDashboardCategory,
};
