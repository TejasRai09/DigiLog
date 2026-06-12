const { pool } = require('../config/mysql');

// ─── Form configuration ──────────────────────────────────────
// pattern:
//   A  →  Date, Shift, Time          (mill logbooks)
//   B  →  Date, start_time, end_time (stoppages)
//   C  →  Date, Shift, Sampling_time (lab logbooks)
//   D  →  Date, Shift                (syrup – no time field)
//   E  →  Date, Time                 (power logbooks)
//   G  →  Date only                  (daily snapshot forms)

// Columns MySQL computes (GENERATED … STORED); must not appear in INSERT payload
const GENERATED_INSERT_EXCLUDE = {
  distillery_ops: new Set(['FS%', 'total_mol_in_store_qtls']),
};

// tsCol = tie-breaker column when multiple rows share the same operation Date (usually inserted-at timestamp)
const FORM_CONFIG = {
  // App 1 – Mill Logbook
  mill_logbook1:    { table: 'mill_logbook1',    pattern: 'A', tsCol: 'timestamp' },
  mill_logbook2:    { table: 'mill_logbook2',    pattern: 'A', tsCol: 'timestamp' },
  mill_logbook3:    { table: 'mill_logbook3',    pattern: 'A', tsCol: 'timestamp' },
  mill_stoppages:   { table: 'mill_stoppages',   pattern: 'B', tsCol: 'timestamp' },

  // App 2 – Lab Logbook
  ds_logbook:       { table: 'ds_logbook',       pattern: 'C', tsCol: 'timestamp' },
  rs_logbook:       { table: 'rs_logbook',       pattern: 'C', tsCol: 'timestamp' },
  ops_logbook:      { table: 'ops_logbook',      pattern: 'C', tsCol: 'timestamp' },
  sa_logbook:       { table: 'sa_logbook',       pattern: 'C', tsCol: 'timestamp_col' }, // sa_logbook uses timestamp_col
  syrp_logbook:     { table: 'syrp_logbook',     pattern: 'D', tsCol: 'timestamp' },
  stoppage_logbook: { table: 'stoppage_logbook', pattern: 'B', tsCol: 'timestamp' },

  // App 3 – Power Logbook
  ph_power:         { table: 'ph_power',         pattern: 'E', tsCol: 'timestamp' },
  ph_steam:         { table: 'ph_steam',         pattern: 'E', tsCol: 'timestamp' },
  ph_stoppage:      { table: 'ph_stoppage',      pattern: 'B', tsCol: 'timestamp' },

  // App 4 – Distillery
  distillery_ops:   { table: 'distillery_operations', pattern: 'G', tsCol: 'timestamp' },
  // EHS – Environment Health & Safety
  ehs_near_miss:    { table: 'ehs_near_miss',    pattern: 'E', tsCol: 'timestamp' },
  ehs_accident:     { table: 'ehs_accident',     pattern: 'E', tsCol: 'timestamp' },
  ehs_water_gwa:    { table: 'ehs_water_gwa',    pattern: 'G', tsCol: 'timestamp' },
  ehs_water_etp:    { table: 'ehs_water_etp',    pattern: 'G', tsCol: 'timestamp' },
  ehs_water_cpu:    { table: 'ehs_water_cpu',    pattern: 'G', tsCol: 'timestamp' },

  // Production Forms
  prod_shift_chemist: { table: 'prod_shift_chemist', pattern: 'G', tsCol: 'timestamp' },
  prod_centrifugal:   { table: 'prod_centrifugal',   pattern: 'H', tsCol: 'timestamp' },
  prod_pan_logbook:   { table: 'prod_pan_logbook',   pattern: 'G', tsCol: 'timestamp' },
  prod_decanter:      { table: 'prod_decanter',      pattern: 'G', tsCol: 'timestamp' },
  prod_clarification: { table: 'prod_clarification', pattern: 'G', tsCol: 'timestamp' },
};

// ─── Access guard ─────────────────────────────────────────────
const canAccessForm = async (user, formKey) => {
  if (user.role === 'admin') return true;

  // Look up the form row
  const [[formRow]] = await pool.query(
    'SELECT id, app_id FROM forms WHERE form_key = ?', [formKey]
  );
  if (!formRow) return false;

  // Check mapping exists for this user + app
  const [[mapping]] = await pool.query(
    'SELECT id FROM mappings WHERE user_id = ? AND app_id = ?',
    [user.id, formRow.app_id]
  );
  if (!mapping) return false;

  // Check mapping_forms: if empty → full access; else verify form is listed
  const [mf] = await pool.query(
    'SELECT form_id FROM mapping_forms WHERE mapping_id = ?',
    [mapping.id]
  );
  if (mf.length === 0) return true;
  return mf.some((r) => r.form_id === formRow.id);
};

// ─── Inject date/time columns by pattern ─────────────────────
const injectDateCols = (payload, pattern, body) => {
  switch (pattern) {
    case 'A':
      payload.Date  = body.date  ?? null;
      payload.Shift = body.shift ?? null;
      payload.Time  = body.time  ?? null;
      break;
    case 'B':
      payload.Date       = body.date      ?? null;
      payload.start_time = body.startTime ?? null;
      payload.end_time   = body.endTime   ?? null;
      break;
    case 'C':
      payload.Date          = body.date         ?? null;
      payload.Shift         = body.shift        ?? null;
      payload.Sampling_time = body.samplingTime ?? null;
      break;
    case 'D':
      payload.Date  = body.date  ?? null;
      payload.Shift = body.shift ?? null;
      break;
    case 'E':
      payload.Date = body.date ?? null;
      payload.Time = body.time ?? null;
      break;
    case 'G':
      payload.Date = body.date ?? null;
      break;
    case 'H':
      payload.Date  = body.date  ?? null;
      payload.Shift = body.shift ?? null;
      break;
    default:
      break;
  }
};

// ─── Reserved meta keys (not data columns) ───────────────────
const META_KEYS = new Set(['date', 'shift', 'time', 'startTime', 'endTime', 'samplingTime']);

const PH_FIELD_LABELS = {
  inlet_ph_a: 'Inlet pH — A Shift',
  inlet_ph_b: 'Inlet pH — B Shift',
  inlet_ph_c: 'Inlet pH — C Shift',
  outlet_ph: 'Outlet pH',
  ph_g_shift: 'pH (G Shift)',
};

/** pH must be 0–14; rejects cane-crush-scale values accidentally entered in pH fields. */
function validatePhFields(payload, keys) {
  for (const key of keys) {
    if (!(key in payload)) continue;
    const raw = payload[key];
    if (raw === null || raw === '') {
      payload[key] = null;
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 14) {
      const label = PH_FIELD_LABELS[key] || key;
      return {
        ok: false,
        message: `${label} must be a number between 0 and 14 (e.g. 7.2).`,
      };
    }
    payload[key] = Math.round(n * 10000) / 10000;
  }
  return { ok: true };
}

function validateFormPayload(formKey, payload) {
  switch (formKey) {
    case 'ehs_water_cpu':
      return validatePhFields(payload, ['inlet_ph_a', 'inlet_ph_b', 'inlet_ph_c', 'outlet_ph']);
    case 'ehs_water_etp':
      return validatePhFields(payload, ['ph_g_shift']);
    default:
      return { ok: true };
  }
}

/** Shown when operational key (date + shift/time etc.) already exists for this form table. */
const DUPLICATE_OPERATION_MSG =
  'Duplicate operation: a record already exists for this date, shift, and time. Change those fields or edit the existing entry.';

/**
 * True if another row exists with the same operational key for this table/pattern.
 * Uses NULL-safe <=> so null keys match only other nulls.
 */
async function hasDuplicateOperationRow(pool, table, pattern, payload) {
  const parts = [];
  const vals = [];
  switch (pattern) {
    case 'A':
      parts.push('`Date` <=> ?', '`Shift` <=> ?', '`Time` <=> ?');
      vals.push(payload.Date ?? null, payload.Shift ?? null, payload.Time ?? null);
      break;
    case 'B':
      parts.push('`Date` <=> ?', '`start_time` <=> ?', '`end_time` <=> ?');
      vals.push(payload.Date ?? null, payload.start_time ?? null, payload.end_time ?? null);
      break;
    case 'C':
      parts.push('`Date` <=> ?', '`Shift` <=> ?', '`Sampling_time` <=> ?');
      vals.push(payload.Date ?? null, payload.Shift ?? null, payload.Sampling_time ?? null);
      break;
    case 'D':
      parts.push('`Date` <=> ?', '`Shift` <=> ?');
      vals.push(payload.Date ?? null, payload.Shift ?? null);
      break;
    case 'E':
      parts.push('`Date` <=> ?', '`Time` <=> ?');
      vals.push(payload.Date ?? null, payload.Time ?? null);
      break;
    case 'G':
      parts.push('`Date` <=> ?');
      vals.push(payload.Date ?? null);
      break;
    case 'H':
      parts.push('`Date` <=> ?', '`Shift` <=> ?');
      vals.push(payload.Date ?? null, payload.Shift ?? null);
      break;
    default:
      return false;
  }

  const [rows] = await pool.query(
    `SELECT 1 AS x FROM \`${table}\` WHERE ${parts.join(' AND ')} LIMIT 1`,
    vals
  );
  return rows.length > 0;
}

// ─── Sanitise & build insert payload ─────────────────────────
const sanitisePayload = (rawBody) => {
  const result = {};
  for (const [key, value] of Object.entries(rawBody)) {
    if (META_KEYS.has(key)) continue;
    result[key] = value === '' ? null : value;
  }
  return result;
};

// ─── POST /api/forms/:formKey ─────────────────────────────────
const submitForm = async (req, res) => {
  const { formKey } = req.params;
  const config = FORM_CONFIG[formKey];

  if (!config) return res.status(400).json({ message: 'Unknown form.' });

  const allowed = await canAccessForm(req.user, formKey);
  if (!allowed) return res.status(403).json({ message: 'Access denied to this form.' });

  const payload = sanitisePayload(req.body);
  injectDateCols(payload, config.pattern, req.body);

  const fieldCheck = validateFormPayload(formKey, payload);
  if (!fieldCheck.ok) {
    return res.status(400).json({ message: fieldCheck.message });
  }

  const skipGenerated = GENERATED_INSERT_EXCLUDE[formKey];
  if (skipGenerated) {
    for (const k of skipGenerated) delete payload[k];
  }

  const columns      = Object.keys(payload).map((c) => `\`${c}\``).join(', ');
  const placeholders = Object.keys(payload).map(() => '?').join(', ');
  const values       = Object.values(payload);

  const sql = `INSERT INTO \`${config.table}\` (${columns}) VALUES (${placeholders})`;

  try {
    const dup = await hasDuplicateOperationRow(pool, config.table, config.pattern, payload);
    if (dup) {
      return res.status(409).json({ message: DUPLICATE_OPERATION_MSG });
    }
    await pool.execute(sql, values);
    res.status(201).json({ message: 'Form submitted successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: DUPLICATE_OPERATION_MSG });
    }
    console.error('Form submit error:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
};

// ─── GET /api/forms/:formKey ──────────────────────────────────
const getFormMeta = async (req, res) => {
  const { formKey } = req.params;

  const [[row]] = await pool.query(
    'SELECT name, description, form_key FROM forms WHERE form_key = ? AND is_active = 1',
    [formKey],
  );
  if (!row) return res.status(404).json({ message: 'Form not found.' });

  const allowed = await canAccessForm(req.user, formKey);
  if (!allowed) return res.status(403).json({ message: 'Access denied to this form.' });

  res.json({
    name: row.name,
    description: row.description,
    formKey: row.form_key,
  });
};

// ─── GET /api/forms/:formKey/records?page=1&limit=20 ─────────
const getRecords = async (req, res) => {
  const { formKey } = req.params;
  const config = FORM_CONFIG[formKey];

  if (!config) return res.status(400).json({ message: 'Unknown form.' });

  const allowed = await canAccessForm(req.user, formKey);
  if (!allowed) return res.status(403).json({ message: 'Access denied to this form.' });

  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(10000, parseInt(req.query.limit || '20', 10)); // allow up to 10000 for CSV export
  const offset = (page - 1) * limit;

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM \`${config.table}\``
    );
    const [rows] = await pool.query(
      `SELECT * FROM \`${config.table}\`
       ORDER BY (\`Date\` IS NULL) ASC, \`Date\` DESC, \`${config.tsCol}\` DESC
       LIMIT ${limit} OFFSET ${offset}`
    );
    res.json({ total, page, limit, records: rows });
  } catch (err) {
    console.error('Form records error:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
};

// ─── POST /api/forms/:formKey/batch ──────────────────────────
// Accepts { rows: [...] } — inserts multiple rows at once (pan, decanter, clarification).
const submitBatch = async (req, res) => {
  const { formKey } = req.params;
  const config = FORM_CONFIG[formKey];

  if (!config) return res.status(400).json({ message: 'Unknown form.' });

  const allowed = await canAccessForm(req.user, formKey);
  if (!allowed) return res.status(403).json({ message: 'Access denied to this form.' });

  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: 'rows must be a non-empty array.' });
  }

  try {
    for (const row of rows) {
      const payload = sanitisePayload(row);
      injectDateCols(payload, config.pattern, row);
      const columns      = Object.keys(payload).map((c) => `\`${c}\``).join(', ');
      const placeholders = Object.keys(payload).map(() => '?').join(', ');
      await pool.execute(
        `INSERT INTO \`${config.table}\` (${columns}) VALUES (${placeholders})`,
        Object.values(payload)
      );
    }
    res.status(201).json({ message: `${rows.length} rows inserted.` });
  } catch (err) {
    console.error('Batch submit error:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
};

module.exports = { submitForm, submitBatch, getRecords, getFormMeta, canAccessForm };
