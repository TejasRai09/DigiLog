/** Data Ingestion Center section keys (must match backend). */
export const DATA_UPLOAD_SECTIONS = [
  { key: 'purchy', label: 'Purchy Analysis' },
  { key: 'management', label: 'Management Dashboard' },
  { key: 'milling', label: 'Milling Operations' },
];

export const DATA_UPLOAD_SECTION_KEYS = DATA_UPLOAD_SECTIONS.map((s) => s.key);
