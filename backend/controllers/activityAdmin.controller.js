const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const {
  auditFilterRoots,
  auditFilterBranches,
  auditFilterLeaves,
  pushActivityTreeFilters,
  pushSessionTreeFilters,
} = require('../utils/auditFilterMap');

function clampInt(v, min, max, fallback) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function buildDateFilters(from, to, column, where, params) {
  if (from) {
    where.push(`${column} >= ?`);
    params.push(from.length <= 10 ? `${from} 00:00:00` : from);
  }
  if (to) {
    where.push(`${column} <= ?`);
    params.push(to.length <= 10 ? `${to} 23:59:59` : to);
  }
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

/** GET /admin/activity-logs */
async function listActivityLogs(req, res) {
  try {
    const page = clampInt(req.query.page, 1, 100000, 1);
    const limit = clampInt(req.query.limit, 1, 100, 25);
    const offset = (page - 1) * limit;

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

    buildDateFilters(req.query.from, req.query.to, 'entered_at', where, params);

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

    buildDateFilters(req.query.from, req.query.to, 'login_at', where, params);

    const tree = readTreeQuery(req);
    if (tree.root) {
      pushSessionTreeFilters(where, params, tree);
    }

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

module.exports = {
  listActivityLogs,
  listSessions,
  listAuditFilterOptions,
};
