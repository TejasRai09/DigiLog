/** Fixed categories for Purchy Analysis upload slots (one active file per slot). */
const PURCHY_SLOTS = {
  grower: {
    slot: 'grower',
    category: 'Purchy Analysis — Grower Details',
    label: 'Grower Details Season',
    hint: 'Grower Details Season workbook (.xlsx)',
    accept: '.xlsx,.xls',
  },
  staff: {
    slot: 'staff',
    category: 'Purchy Analysis — Staff Mapping',
    label: 'Staff wise Bonding',
    hint: 'Staff wise Bonding target workbook (.xlsx)',
    accept: '.xlsx,.xls',
  },
};

const PURCHY_CATEGORY_SET = new Set(Object.values(PURCHY_SLOTS).map((s) => s.category));

function purchySlotFromCategory(category) {
  const entry = Object.values(PURCHY_SLOTS).find((s) => s.category === category);
  return entry?.slot ?? null;
}

function isPurchyCategory(category) {
  return PURCHY_CATEGORY_SET.has(category);
}

module.exports = {
  PURCHY_SLOTS,
  PURCHY_CATEGORY_SET,
  purchySlotFromCategory,
  isPurchyCategory,
};
