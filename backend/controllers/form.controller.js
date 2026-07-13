const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const { validHistoryImageField } = require('../utils/historyImages');

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
  mill_logbook1:    { table: 'mill_logbook1',    pattern: 'A', tsCol: 'timestamp', autoTime: true },
  mill_logbook2:    { table: 'mill_logbook2',    pattern: 'A', tsCol: 'timestamp', autoTime: true },
  mill_logbook3:    { table: 'mill_logbook3',    pattern: 'A', tsCol: 'timestamp', autoTime: true },
  mill_stoppages:   { table: 'mill_stoppages',   pattern: 'B', tsCol: 'timestamp' },

  // App 2 – Lab Logbook
  ds_logbook:       { table: 'ds_logbook',       pattern: 'C', tsCol: 'timestamp' },
  rs_logbook:       { table: 'rs_logbook',       pattern: 'C', tsCol: 'timestamp' },
  ops_logbook:      { table: 'ops_logbook',      pattern: 'C', tsCol: 'timestamp' },
  sa_logbook:       { table: 'sa_logbook',       pattern: 'C', tsCol: 'timestamp_col' }, // sa_logbook uses timestamp_col
  syrp_logbook:     { table: 'syrp_logbook',     pattern: 'D', tsCol: 'timestamp' },
  stoppage_logbook: { table: 'stoppage_logbook', pattern: 'B', tsCol: 'timestamp' },

  // App 3 – Power Logbook
  ph_power:         { table: 'ph_power',         pattern: 'E', tsCol: 'timestamp', autoTime: true },
  ph_steam:         { table: 'ph_steam',         pattern: 'E', tsCol: 'timestamp', autoTime: true },
  ph_stoppage:      { table: 'ph_stoppage',      pattern: 'B', tsCol: 'timestamp' },

  // App 4 – Distillery
  distillery_ops:   { table: 'distillery_operations', pattern: 'G', tsCol: 'timestamp' },
  // EHS – Environment Health & Safety
  ehs_near_miss:    { table: 'ehs_near_miss',    pattern: 'E', tsCol: 'timestamp' },
  ehs_accident:     { table: 'ehs_accident',     pattern: 'E', tsCol: 'timestamp' },
  ehs_water_gwa:    { table: 'ehs_water_gwa',    pattern: 'G', tsCol: 'timestamp' },
  ehs_water_etp:    { table: 'ehs_water_etp',    pattern: 'G', tsCol: 'timestamp' },
  ehs_water_cpu:    { table: 'ehs_water_cpu',    pattern: 'G', tsCol: 'timestamp' },
  ehs_toolbox_talk: { table: 'ehs_toolbox_talk', pattern: 'D', tsCol: 'timestamp' },

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

function formatMySQLDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizeRecordTimestamp(val) {
  if (val == null) return null;
  if (val instanceof Date) return formatMySQLDateTime(val);
  const s = String(val);
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  if (iso) return `${iso[1]} ${iso[2]}`;
  return s.length >= 19 ? s.slice(0, 19) : s;
}

function decodeRecordKey(encoded) {
  return normalizeRecordTimestamp(decodeURIComponent(encoded));
}

function requireAdmin(req, res) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Access denied: admin only.' });
    return false;
  }
  return true;
}

const RECORD_SYSTEM_COLS = new Set(['timestamp', 'timestamp_col']);

async function fetchRecordByKey(config, recordKey) {
  const ts = decodeRecordKey(recordKey);
  if (!ts) return null;
  const [[row]] = await pool.query(
    `SELECT * FROM \`${config.table}\` WHERE \`${config.tsCol}\` = ? LIMIT 1`,
    [ts],
  );
  return row || null;
}

function buildAdminUpdatePayload(formKey, config, body) {
  const payload = sanitisePayload(body);
  for (const k of RECORD_SYSTEM_COLS) delete payload[k];
  delete payload[config.tsCol];

  const hasMeta = ['date', 'shift', 'time', 'startTime', 'endTime', 'samplingTime']
    .some((k) => Object.prototype.hasOwnProperty.call(body, k));
  if (hasMeta) {
    injectDateCols(payload, config.pattern, body, { autoTime: false });
  }

  const skipGenerated = GENERATED_INSERT_EXCLUDE[formKey];
  if (skipGenerated) {
    for (const k of skipGenerated) delete payload[k];
  }

  if (formKey === 'ph_stoppage' && Object.prototype.hasOwnProperty.call(payload, 'end_time')) {
    payload.end_Time = payload.end_time;
    delete payload.end_time;
  }

  return payload;
}

// ─── Inject date/time columns by pattern ─────────────────────
const injectDateCols = (payload, pattern, body, { autoTime = false } = {}) => {
  switch (pattern) {
    case 'A':
      payload.Date  = body.date  ?? null;
      payload.Shift = body.shift ?? null;
      payload.Time  = autoTime ? formatMySQLDateTime(new Date()) : (body.time ?? null);
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
      payload.Time = autoTime ? formatMySQLDateTime(new Date()) : (body.time ?? null);
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

function isValidHhMm(value) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

function validateStoppagePhotos(value) {
  if (value == null || value === '') return { value: null };
  const validated = validHistoryImageField(value);
  if (!validated) {
    return { error: 'Invalid stoppage photo format.' };
  }
  let count = 1;
  if (validated.startsWith('[')) {
    try {
      count = JSON.parse(validated).length;
    } catch {
      return { error: 'Invalid stoppage photo format.' };
    }
  }
  if (count > 2) {
    return { error: 'Maximum 2 stoppage photos allowed.' };
  }
  return { value: validated };
}

function validateFormPayload(formKey, payload) {
  switch (formKey) {
    case 'ehs_water_cpu':
      return validatePhFields(payload, ['inlet_ph_a', 'inlet_ph_b', 'inlet_ph_c', 'outlet_ph']);
    case 'ehs_water_etp':
      return validatePhFields(payload, ['ph_g_shift']);
    case 'ehs_toolbox_talk': {
      const shift = String(payload.Shift ?? '').trim();
      if (!['A', 'B', 'C'].includes(shift)) {
        return { ok: false, message: 'Shift must be A, B, or C.' };
      }
      payload.Shift = shift;

      const start = String(payload.start_time ?? '').trim();
      const end = String(payload.end_time ?? '').trim();
      if (!isValidHhMm(start)) {
        return { ok: false, message: 'Time — From is required (24-hour HH:mm).' };
      }
      if (!isValidHhMm(end)) {
        return { ok: false, message: 'Time — To is required (24-hour HH:mm).' };
      }
      if (end <= start) {
        return {
          ok: false,
          message: 'Time — To must be later than Time — From (24-hour format).',
        };
      }
      payload.start_time = start;
      payload.end_time = end;

      const topic = String(payload.topic_discussed ?? '').trim();
      const topicChars = topic.replace(/\s/g, '').length;
      if (topicChars < 20) {
        return {
          ok: false,
          message: 'Topic discussed must be at least 20 characters (spaces not counted).',
        };
      }
      if (topicChars > 150) {
        return {
          ok: false,
          message: 'Topic discussed must be at most 150 characters (spaces not counted).',
        };
      }
      if (topic.length > 150) {
        return { ok: false, message: 'Topic discussed must be at most 150 characters in total.' };
      }
      payload.topic_discussed = topic;

      const raw = payload.no_of_attendees;
      if (raw === null || raw === '') {
        return { ok: false, message: 'Number of attendees is required.' };
      }
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        return {
          ok: false,
          message: 'Number of attendees must be a whole number of at least 1.',
        };
      }
      payload.no_of_attendees = n;
      return { ok: true };
    }
    case 'ph_power': {
      const remark = String(payload.remark ?? '').trim();
      if (!remark) {
        return { ok: false, message: 'General remarks is required.' };
      }
      payload.remark = remark;
      return { ok: true };
    }
    case 'ph_stoppage': {
      const remarks = String(payload.remarks ?? '').trim();
      if (!remarks) {
        return { ok: false, message: 'General remarks is required.' };
      }
      if (remarks.length < 20) {
        return { ok: false, message: 'General remarks must be at least 20 characters.' };
      }
      if (remarks.length > 150) {
        return { ok: false, message: 'General remarks must be at most 150 characters.' };
      }
      payload.remarks = remarks;

      const specifyRules = [
        { field: 'section', other: 'Others', specify: 'section_specify', label: 'Section' },
        { field: 'sub_section', other: 'OTHERS', specify: 'sub_section_specify', label: 'Sub-Section' },
        { field: 'machinery', other: 'Others', specify: 'machinery_specify', label: 'Machinery' },
        { field: 'category', other: 'Other', specify: 'category_specify', label: 'Category' },
      ];
      for (const { field, other, specify, label } of specifyRules) {
        const val = String(payload[field] ?? '').trim();
        if (val === other) {
          const spec = String(payload[specify] ?? '').trim();
          if (!spec) {
            return { ok: false, message: `Please specify ${label} is required when ${other} is selected.` };
          }
          if (spec.length > 100) {
            return { ok: false, message: `Please specify ${label} must be at most 100 characters.` };
          }
          payload[specify] = spec;
        } else {
          payload[specify] = null;
        }
      }

      if (payload.stoppage_photos != null && payload.stoppage_photos !== '') {
        const photoCheck = validateStoppagePhotos(payload.stoppage_photos);
        if (photoCheck.error) {
          return { ok: false, message: photoCheck.error };
        }
        payload.stoppage_photos = photoCheck.value;
      } else {
        payload.stoppage_photos = null;
      }
      return { ok: true };
    }
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
async function hasDuplicateOperationRow(pool, table, pattern, payload, {
  autoTime = false,
  tsCol = null,
  excludeRecordKey = null,
} = {}) {
  let dupPattern = pattern;
  if (autoTime) {
    if (pattern === 'A') dupPattern = 'D'; // mill logbooks: one entry per Date + Shift
    else if (pattern === 'E') dupPattern = 'G'; // power daily: one entry per Date
  }
  const endCol = table === 'ph_stoppage' ? 'end_Time' : 'end_time';
  const parts = [];
  const vals = [];
  switch (dupPattern) {
    case 'A':
      parts.push('`Date` <=> ?', '`Shift` <=> ?', '`Time` <=> ?');
      vals.push(payload.Date ?? null, payload.Shift ?? null, payload.Time ?? null);
      break;
    case 'B':
      parts.push('`Date` <=> ?', '`start_time` <=> ?', `\`${endCol}\` <=> ?`);
      vals.push(
        payload.Date ?? null,
        payload.start_time ?? null,
        payload.end_Time ?? payload.end_time ?? null,
      );
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

  let sql = `SELECT 1 AS x FROM \`${table}\` WHERE ${parts.join(' AND ')}`;
  const params = [...vals];
  if (excludeRecordKey != null && tsCol) {
    sql += ` AND NOT (\`${tsCol}\` <=> ?)`;
    params.push(decodeRecordKey(excludeRecordKey));
  }
  sql += ' LIMIT 1';

  const [rows] = await pool.query(sql, params);
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
  injectDateCols(payload, config.pattern, req.body, { autoTime: config.autoTime });

  if (config.autoTime && !payload.Date) {
    return res.status(400).json({ message: 'Date is required.' });
  }

  const fieldCheck = validateFormPayload(formKey, payload);
  if (!fieldCheck.ok) {
    return res.status(400).json({ message: fieldCheck.message });
  }

  // ph_stoppage table column is end_Time (not end_time)
  if (formKey === 'ph_stoppage' && Object.prototype.hasOwnProperty.call(payload, 'end_time')) {
    payload.end_Time = payload.end_time;
    delete payload.end_time;
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
    const dup = await hasDuplicateOperationRow(pool, config.table, config.pattern, payload, {
      autoTime: config.autoTime,
    });
    if (dup) {
      return res.status(409).json({ message: DUPLICATE_OPERATION_MSG });
    }
    await pool.execute(sql, values);
    res.status(201).json({ message: 'Form submitted successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: DUPLICATE_OPERATION_MSG });
    }
    sendServerError(res, 'Form submit error:', err, MSG.SAVE);
  }
};

// ─── GET /api/forms/:formKey ──────────────────────────────────
const getFormMeta = async (req, res) => {
  const { formKey } = req.params;

  try {
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
  } catch (err) {
    sendServerError(res, 'getFormMeta', err, MSG.LOAD);
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
      `SELECT * FROM \`${config.table}\`
       ORDER BY (\`Date\` IS NULL) ASC, \`Date\` DESC, \`${config.tsCol}\` DESC
       LIMIT ${limit} OFFSET ${offset}`
    );
    res.json({ total, page, limit, tsCol: config.tsCol, records: rows });
  } catch (err) {
    sendServerError(res, 'Form records error:', err, MSG.LOAD);
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
    sendServerError(res, 'Batch submit error:', err, MSG.SAVE);
  }
};

// ─── GET /api/forms/:formKey/records/:recordKey (admin) ───────
const getRecord = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { formKey, recordKey } = req.params;
  const config = FORM_CONFIG[formKey];
  if (!config) return res.status(400).json({ message: 'Unknown form.' });

  try {
    const record = await fetchRecordByKey(config, recordKey);
    if (!record) return res.status(404).json({ message: 'Record not found.' });
    res.json({ record, tsCol: config.tsCol });
  } catch (err) {
    sendServerError(res, 'getRecord', err, MSG.LOAD);
  }
};

// ─── PUT /api/forms/:formKey/records/:recordKey (admin) ───────
const updateRecord = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { formKey, recordKey } = req.params;
  const config = FORM_CONFIG[formKey];
  if (!config) return res.status(400).json({ message: 'Unknown form.' });

  try {
    const existing = await fetchRecordByKey(config, recordKey);
    if (!existing) return res.status(404).json({ message: 'Record not found.' });

    const payload = buildAdminUpdatePayload(formKey, config, req.body);
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    const fieldCheck = validateFormPayload(formKey, payload);
    if (!fieldCheck.ok) {
      return res.status(400).json({ message: fieldCheck.message });
    }

    const dup = await hasDuplicateOperationRow(pool, config.table, config.pattern, payload, {
      autoTime: config.autoTime,
      tsCol: config.tsCol,
      excludeRecordKey: recordKey,
    });
    if (dup) {
      return res.status(409).json({ message: DUPLICATE_OPERATION_MSG });
    }

    const setParts = Object.keys(payload).map((c) => `\`${c}\` = ?`);
    const values = [...Object.values(payload), decodeRecordKey(recordKey)];
    await pool.execute(
      `UPDATE \`${config.table}\` SET ${setParts.join(', ')} WHERE \`${config.tsCol}\` = ?`,
      values,
    );

    res.json({ message: 'Record updated successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: DUPLICATE_OPERATION_MSG });
    }
    sendServerError(res, 'updateRecord', err, MSG.SAVE);
  }
};

// ─── DELETE /api/forms/:formKey/records/:recordKey (admin) ────
const deleteRecord = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { formKey, recordKey } = req.params;
  const config = FORM_CONFIG[formKey];
  if (!config) return res.status(400).json({ message: 'Unknown form.' });

  try {
    const ts = decodeRecordKey(recordKey);
    const [result] = await pool.execute(
      `DELETE FROM \`${config.table}\` WHERE \`${config.tsCol}\` = ? LIMIT 1`,
      [ts],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Record not found.' });
    }
    res.json({ message: 'Record deleted successfully.' });
  } catch (err) {
    sendServerError(res, 'deleteRecord', err, MSG.SAVE);
  }
};

module.exports = {
  submitForm,
  submitBatch,
  getRecords,
  getFormMeta,
  getRecord,
  updateRecord,
  deleteRecord,
  canAccessForm,
};
