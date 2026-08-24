/** Data Ingestion Center section keys (employee mapping). */
const { pool } = require('../config/mysql');

const DATA_UPLOAD_SECTIONS = [
  { key: 'purchy', label: 'Purchy Analysis' },
  { key: 'management', label: 'Management Dashboard' },
  { key: 'milling', label: 'Milling Operations' },
];

const DATA_UPLOAD_SECTION_KEYS = DATA_UPLOAD_SECTIONS.map((s) => s.key);

function normalizeSectionKeys(input) {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(DATA_UPLOAD_SECTION_KEYS);
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    const key = String(raw || '').trim().toLowerCase();
    if (!allowed.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

async function getUserDataUploadSections(user) {
  if (!user) return [];
  if (user.role === 'admin') return [...DATA_UPLOAD_SECTION_KEYS];
  const userId = user.id ?? user._id;
  if (userId == null) return [];
  const [rows] = await pool.query(
    'SELECT section_key FROM user_data_upload_access WHERE user_id = ?',
    [userId],
  );
  return normalizeSectionKeys(rows.map((r) => r.section_key));
}

module.exports = {
  DATA_UPLOAD_SECTIONS,
  DATA_UPLOAD_SECTION_KEYS,
  normalizeSectionKeys,
  getUserDataUploadSections,
};
