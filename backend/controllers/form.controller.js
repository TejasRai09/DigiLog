const { pool } = require('../config/mysql');

// ─── Form configuration ──────────────────────────────────────
// pattern:
//   A  →  Date, Shift, Time          (mill logbooks)
//   B  →  Date, start_time, end_time (stoppages)
//   C  →  Date, Shift, Sampling_time (lab logbooks)
//   D  →  Date, Shift                (syrup – no time field)
//   E  →  Date, Time                 (power logbooks)
//   G  →  Date only                  (daily snapshot forms)

// tsCol = the column used for ORDER BY DESC (varies by table)
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
    default:
      break;
  }
};

// ─── Reserved meta keys (not data columns) ───────────────────
const META_KEYS = new Set(['date', 'shift', 'time', 'startTime', 'endTime', 'samplingTime']);

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

  const columns      = Object.keys(payload).map((c) => `\`${c}\``).join(', ');
  const placeholders = Object.keys(payload).map(() => '?').join(', ');
  const values       = Object.values(payload);

  const sql = `INSERT INTO \`${config.table}\` (${columns}) VALUES (${placeholders})`;

  try {
    await pool.execute(sql, values);
    res.status(201).json({ message: 'Form submitted successfully.' });
  } catch (err) {
    console.error('Form submit error:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
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
      `SELECT * FROM \`${config.table}\` ORDER BY \`${config.tsCol}\` DESC LIMIT ${limit} OFFSET ${offset}`
    );
    res.json({ total, page, limit, records: rows });
  } catch (err) {
    console.error('Form records error:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
};

module.exports = { submitForm, getRecords };
