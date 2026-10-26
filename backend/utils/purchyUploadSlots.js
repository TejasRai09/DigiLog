/** Fixed categories for Grower Intelligence upload slots (one active file per slot). */
const PURCHY_SLOTS = {
  grower: {
    slot: 'grower',
    category: 'Grower Intelligence — Grower Details',
    label: 'Grower Details Season',
    hint: 'Grower Details Season workbook (.xlsx)',
    accept: '.xlsx,.xls',
  },
  staff: {
    slot: 'staff',
    category: 'Grower Intelligence — Staff Mapping',
    label: 'Staff wise Bonding',
    hint: 'Staff wise Bonding target workbook (.xlsx)',
    accept: '.xlsx,.xls',
  },
};

/** Previous dashboard title — still recognized on existing upload rows. */
const LEGACY_PURCHY_CATEGORIES = {
  'Purchy Analysis — Grower Details': 'grower',
  'Purchy Analysis — Staff Mapping': 'staff',
};

const PURCHY_CATEGORY_SET = new Set([
  ...Object.values(PURCHY_SLOTS).map((s) => s.category),
  ...Object.keys(LEGACY_PURCHY_CATEGORIES),
]);

function purchySlotFromCategory(category) {
  const entry = Object.values(PURCHY_SLOTS).find((s) => s.category === category);
  if (entry) return entry.slot;
  return LEGACY_PURCHY_CATEGORIES[category] ?? null;
}

function isPurchyCategory(category) {
  return PURCHY_CATEGORY_SET.has(category);
}

function categoriesForPurchySlot(slot) {
  const current = PURCHY_SLOTS[slot]?.category;
  const out = [];
  if (current) out.push(current);
  for (const [legacy, mapped] of Object.entries(LEGACY_PURCHY_CATEGORIES)) {
    if (mapped === slot) out.push(legacy);
  }
  return out;
}

module.exports = {
  PURCHY_SLOTS,
  PURCHY_CATEGORY_SET,
  LEGACY_PURCHY_CATEGORIES,
  purchySlotFromCategory,
  isPurchyCategory,
  categoriesForPurchySlot,
};
