const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const { pushIstDayRange } = require('../utils/istDayRange');
const {
  auditFilterRoots,
  auditFilterBranches,
  auditFilterLeaves,
  pushActivityTreeFilters,
  pushSessionTreeFilters,
} = require('../utils/auditFilterMap');
const {
  EXPORT_ROW_CAP,
  formatIstDateTime,
  formatDurationMinutes,
  formatDwellSeconds,
  istYmd,
  streamXlsx,
} = require('../utils/auditExcelExport');

const EVENT_LABELS = {
  page_view: 'Opened page',
  section_open: 'Opened page',
  card_open: 'Opened page',
  form_open: 'Opened form',
  dashboard_open: 'Opened page',
  equipment_section_open: 'Opened page',
  view_data: 'Viewed data',
  download_csv: 'Downloaded CSV',
  download_pdf: 'Downloaded PDF',
  chart_download_csv: 'Downloaded chart',
  dashboard_tab: 'Opened page',
  dashboard_filter: 'Opened page',
  form_submit: 'Opened form',
  logout: 'Signed out',
};

const CLICK_EVENTS = new Set([
  'download_csv',
  'download_pdf',
  'chart_download_csv',
  'dashboard_tab',
  'dashboard_filter',
  'view_data',
]);

function clampInt(v, min, max, fallback) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function readTreeQuery(req) {
  return {
    root: String(req.query.filter_root || '').trim(),
    branch: String(req.query.filter_branch || '').trim(),
    leaf: String(req.query.filter_leaf || '').trim(),
    card: String(req.query.filter_card || '').trim(),
    screen: String(req.query.filter_screen || '').trim(),
  };
}

function eventLabel(type) {
  const key = String(type || '');
  return EVENT_LABELS[key] || (key ? key.replace(/_/g, ' ') : '');
}

function stayLabel(row) {
  if (CLICK_EVENTS.has(String(row.event_type || ''))) return 'Not a page stay';
  return formatDwellSeconds(row.dwell_seconds);
}

function buildActivityWhere(req) {
  const where = [];
  const params = [];

  const q = String(req.query.q || '').trim();
  if (q) {
    where.push(`(
      user_name LIKE ? OR user_email LIKE ? OR section LIKE ?
      OR card LIKE ? OR form_or_dashboard LIKE ? OR display_path LIKE ?
      OR page_path LIKE ?
    )`);
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like, like);
  }

  const tree = readTreeQuery(req);
  if (tree.root) {
    pushActivityTreeFilters(where, params, tree);
  } else {
    if (req.query.section) {
      where.push('section = ?');
      params.push(String(req.query.section));
    }
    if (req.query.card) {
      where.push('card = ?');
      params.push(String(req.query.card));
    }
    if (req.query.form_or_dashboard) {
      where.push('form_or_dashboard = ?');
      params.push(String(req.query.form_or_dashboard));
    }
  }

  if (req.query.event_type) {
    where.push('event_type = ?');
    params.push(String(req.query.event_type));
  }
  if (req.query.user_id) {
    where.push('user_id = ?');
    params.push(Number(req.query.user_id));
  }

  pushIstDayRange(where, params, 'entered_at', req.query.from, req.query.to);
  return { where, params };
}

function buildSessionWhere(req) {
  const where = [];
  const params = [];

  const q = String(req.query.q || '').trim();
  if (q) {
    where.push('(user_name LIKE ? OR user_email LIKE ? OR session_id LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  if (req.query.active === '1' || req.query.active === 'true') {
    where.push('is_active = 1');
  } else if (req.query.active === '0' || req.query.active === 'false') {
    where.push('is_active = 0');
  }

  if (req.query.user_id) {
    where.push('user_id = ?');
    params.push(Number(req.query.user_id));
  }

  pushIstDayRange(where, params, 'login_at', req.query.from, req.query.to);

  const tree = readTreeQuery(req);
  if (tree.root) {
    pushSessionTreeFilters(where, params, tree);
  }

  return { where, params };
}

/** GET /admin/activity-logs */
async function listActivityLogs(req, res) {
  try {
    const page = clampInt(req.query.page, 1, 100000, 1);
    const limit = clampInt(req.query.limit, 1, 100, 25);
    const offset = (page - 1) * limit;
    const { where, params } = buildActivityWhere(req);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM user_activity_logs ${whereSql}`,
      params,
    );

    const [rows] = await pool.query(
      `SELECT id, session_id, user_id, user_name, user_email, user_role, user_department,
              event_type, section, card, form_or_dashboard, page_path, display_path,
              element_id, element_label, metadata, entered_at, exited_at, dwell_seconds,
              ip, user_agent
       FROM user_activity_logs
       ${whereSql}
       ORDER BY entered_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return res.json({
      data: rows,
      pagination: { page, limit, total, totalPages },
    });
  } catch (err) {
    return sendServerError(res, 'listActivityLogs', err, MSG.SERVER);
  }
}

/** GET /admin/sessions */
async function listSessions(req, res) {
  try {
    const page = clampInt(req.query.page, 1, 100000, 1);
    const limit = clampInt(req.query.limit, 1, 100, 25);
    const offset = (page - 1) * limit;
    const { where, params } = buildSessionWhere(req);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM user_sessions ${whereSql}`,
      params,
    );

    const [rows] = await pool.query(
      `SELECT id, session_id, user_id, user_name, user_email, user_role, user_department,
              login_at, logout_at, duration_minutes, is_active, last_heartbeat,
              ip, user_agent, pages_visited, actions_performed
       FROM user_sessions
       ${whereSql}
       ORDER BY login_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return res.json({
      data: rows,
      pagination: { page, limit, total, totalPages },
    });
  } catch (err) {
    return sendServerError(res, 'listSessions', err, MSG.SERVER);
  }
}

/** GET /admin/audit-filter-options — static IA tree (not DISTINCT from logs) */
async function listAuditFilterOptions(req, res) {
  try {
    const section = String(req.query.section || req.query.filter_root || '').trim();
    const card = String(req.query.card || req.query.filter_branch || '').trim();

    if (!section) {
      return res.json({ level: 'section', options: auditFilterRoots() });
    }
    if (!card) {
      return res.json({ level: 'card', options: auditFilterBranches(section) });
    }
    return res.json({
      level: 'form_or_dashboard',
      options: auditFilterLeaves(section, card),
    });
  } catch (err) {
    return sendServerError(res, 'listAuditFilterOptions', err, MSG.SERVER);
  }
}

const ACTIVITY_EXPORT_COLUMNS = [
  { header: 'Time (IST)', key: 'time', width: 22 },
  { header: 'Person', key: 'person', width: 24 },
  { header: 'Role', key: 'role', width: 14 },
  { header: 'What happened', key: 'what', width: 22 },
  { header: 'Form / Dashboard', key: 'form', width: 28 },
  { header: 'Where', key: 'where', width: 36 },
  { header: 'Stay time', key: 'stay', width: 16 },
  { header: 'Path', key: 'path', width: 40 },
];

const SESSION_EXPORT_COLUMNS = [
  { header: 'Login (IST)', key: 'login', width: 22 },
  { header: 'Name', key: 'name', width: 24 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Role', key: 'role', width: 14 },
  { header: 'Dept', key: 'dept', width: 18 },
  { header: 'Logout (IST)', key: 'logout', width: 22 },
  { header: 'Duration', key: 'duration', width: 14 },
  { header: 'Pages', key: 'pages', width: 10 },
  { header: 'Status', key: 'status', width: 12 },
];

/** GET /admin/activity-logs/export */
async function exportActivityLogs(req, res) {
  try {
    const { where, params } = buildActivityWhere(req);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM user_activity_logs ${whereSql}`,
      params,
    );
    if (!Number(total)) {
      return res.status(404).json({ message: 'No matching rows to export.' });
    }
    const [rows] = await pool.query(
      `SELECT user_name, user_role, event_type, form_or_dashboard, display_path,
              page_path, card, section, dwell_seconds, entered_at
       FROM user_activity_logs
       ${whereSql}
       ORDER BY entered_at DESC, id DESC
       LIMIT ?`,
      [...params, EXPORT_ROW_CAP],
    );
    await streamXlsx(res, {
      filename: `audit-activity-${istYmd()}.xlsx`,
      sheetName: 'Views and downloads',
      columns: ACTIVITY_EXPORT_COLUMNS,
      rows: rows.map((row) => ({
        time: formatIstDateTime(row.entered_at),
        person: row.user_name || '',
        role: row.user_role || '',
        what: eventLabel(row.event_type),
        form: row.form_or_dashboard || '',
        where: row.display_path || row.card || row.section || '',
        stay: stayLabel(row),
        path: row.page_path || '',
      })),
    });
  } catch (err) {
    if (!res.headersSent) return sendServerError(res, 'exportActivityLogs', err, MSG.SERVER);
    console.error('[exportActivityLogs]', err);
  }
}

/** GET /admin/sessions/export */
async function exportSessions(req, res) {
  try {
    const { where, params } = buildSessionWhere(req);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM user_sessions ${whereSql}`,
      params,
    );
    if (!Number(total)) {
      return res.status(404).json({ message: 'No matching rows to export.' });
    }
    const [rows] = await pool.query(
      `SELECT user_name, user_email, user_role, user_department, login_at, logout_at,
              duration_minutes, is_active, pages_visited
       FROM user_sessions
       ${whereSql}
       ORDER BY login_at DESC, id DESC
       LIMIT ?`,
      [...params, EXPORT_ROW_CAP],
    );
    await streamXlsx(res, {
      filename: `audit-sessions-${istYmd()}.xlsx`,
      sheetName: 'Sign-ins',
      columns: SESSION_EXPORT_COLUMNS,
      rows: rows.map((row) => ({
        login: formatIstDateTime(row.login_at),
        name: row.user_name || '',
        email: row.user_email || '',
        role: row.user_role || '',
        dept: row.user_department || '',
        logout: formatIstDateTime(row.logout_at),
        duration: formatDurationMinutes(row.duration_minutes),
        pages: row.pages_visited ?? 0,
        status: (row.is_active === 1 || row.is_active === true) ? 'Online' : 'Ended',
      })),
    });
  } catch (err) {
    if (!res.headersSent) return sendServerError(res, 'exportSessions', err, MSG.SERVER);
    console.error('[exportSessions]', err);
  }
}

module.exports = {
  listActivityLogs,
  listSessions,
  listAuditFilterOptions,
  exportActivityLogs,
  exportSessions,
};
