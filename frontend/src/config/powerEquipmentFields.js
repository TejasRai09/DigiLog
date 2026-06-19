/** Life history fields for Power Plant equipment cards. */
export const POWER_LIFE_HISTORY_FIELDS = [
  { key: 'category', label: 'Category' },
  { key: 'subcategory', label: 'Subcategory' },
  { key: 'equip_no', label: 'Equipment No.', mono: true },
  { key: 'tag_name', label: 'Tag Name', mono: true },
  { key: 'name', label: 'Name of Equipment', wide: true },
  { key: 'location', label: 'Location' },
  { key: 'commissioned', label: 'Date of Commissioning', date: true },
];

export function powerEquipmentDisplayId(eq) {
  if (!eq) return '—';
  const parts = [eq.equip_no, eq.tag_name].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

export function isZilEquipNo(value) {
  return /^ZIL\/GSM\/PP\//i.test(String(value || '').trim());
}
