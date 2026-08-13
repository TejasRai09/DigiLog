const crypto = require('crypto');
const { clientIp } = require('./auditLog');

const SESSION_STALE_MINUTES = 5;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

function newSessionId() {
  return crypto.randomUUID();
}

function clip(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length <= max ? s : s.slice(0, max);
}

function userFields(user) {
  return {
    user_id: user?.id ?? null,
    user_name: clip(user?.name, 200),
    user_email: clip(user?.email, 200),
    user_role: clip(user?.role, 20),
    user_department: clip(user?.department, 255),
  };
}

async function startSession(pool, req, user) {
  const sessionId = newSessionId();
  const uf = userFields(user);
  const ip = clientIp(req);
  const ua = clip(req.headers['user-agent'], 500);

  await pool.query(
    `INSERT INTO user_sessions
       (session_id, user_id, user_name, user_email, user_role, user_department,
        login_at, is_active, last_heartbeat, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), 1, NOW(), ?, ?)`,
    [
      sessionId,
      uf.user_id,
      uf.user_name,
      uf.user_email,
      uf.user_role,
      uf.user_department,
      ip,
      ua,
    ],
  );

  return sessionId;
}

async function heartbeatSession(pool, sessionId, userId) {
  if (!sessionId) return false;
  const [result] = await pool.query(
    `UPDATE user_sessions
     SET last_heartbeat = NOW()
     WHERE session_id = ? AND user_id = ? AND is_active = 1`,
    [sessionId, userId],
  );
  return result.affectedRows > 0;
}

async function endSession(pool, sessionId, userId) {
  if (!sessionId) return false;
  const [result] = await pool.query(
    `UPDATE user_sessions
     SET logout_at = NOW(),
         is_active = 0,
         duration_minutes = TIMESTAMPDIFF(MINUTE, login_at, NOW()),
         last_heartbeat = NOW()
     WHERE session_id = ? AND user_id = ? AND is_active = 1`,
    [sessionId, userId],
  );
  return result.affectedRows > 0;
}

async function expireStaleSessions(pool, staleMinutes = SESSION_STALE_MINUTES) {
  const [result] = await pool.query(
    `UPDATE user_sessions
     SET logout_at = COALESCE(last_heartbeat, login_at),
         is_active = 0,
         duration_minutes = TIMESTAMPDIFF(
           MINUTE,
           login_at,
           COALESCE(last_heartbeat, login_at)
         )
     WHERE is_active = 1
       AND COALESCE(last_heartbeat, login_at) < (NOW() - INTERVAL ? MINUTE)`,
    [staleMinutes],
  );
  return result.affectedRows || 0;
}

async function bumpPagesVisited(pool, sessionId) {
  if (!sessionId) return;
  await pool.query(
    `UPDATE user_sessions
     SET pages_visited = pages_visited + 1, last_heartbeat = NOW()
     WHERE session_id = ? AND is_active = 1`,
    [sessionId],
  );
}

function withoutGsmaLabel(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\bGSMA\s+/gi, '')
    .replace(/\s+at\s+GSMA\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Replace slug-derived labels with the real names users see in the UI
 * (forms/apps catalog, hierarchy node names).
 */
async function resolveActivityLabels(pool, payload) {
  const out = {
    section: payload.section || null,
    card: payload.card || null,
    form_or_dashboard: payload.form_or_dashboard || null,
    display_path: payload.display_path || null,
  };

  const path = String(payload.page_path || '').split('?')[0];

  const appMatch = path.match(/^\/apps\/(\d+)$/);
  if (appMatch) {
    try {
      const [rows] = await pool.query(
        'SELECT name FROM apps WHERE id = ? LIMIT 1',
        [Number(appMatch[1])],
      );
      const appName = withoutGsmaLabel(rows[0]?.name);
      if (appName) {
        out.card = appName;
        out.display_path = ['Dashboard', out.section || 'Forms Hub', appName]
          .filter(Boolean)
          .join(' > ');
      }
    } catch {
      /* keep client labels */
    }
    return out;
  }

  const formMatch = path.match(/^\/forms\/([^/]+)$/);
  if (formMatch) {
    const formKey = decodeURIComponent(formMatch[1]);
    try {
      const [rows] = await pool.query(
        `SELECT f.name AS form_name, a.name AS app_name
         FROM forms f
         LEFT JOIN apps a ON a.id = f.app_id
         WHERE f.form_key = ?
         LIMIT 1`,
        [formKey],
      );
      if (rows[0]) {
        const formName = withoutGsmaLabel(rows[0].form_name);
        const appName = withoutGsmaLabel(rows[0].app_name);
        if (formName) out.form_or_dashboard = formName;
        if (appName) out.card = appName;
        out.display_path = ['Dashboard', out.section || 'Forms Hub', out.card, out.form_or_dashboard]
          .filter(Boolean)
          .join(' > ');
      }
    } catch {
      /* keep client labels */
    }
    return out;
  }

  const nodeMatch = path.match(/^\/(power-plant-equipment-new|sugar-house-equipment-new)\/(\d+)(?:\/([^/]+))?$/);
  if (nodeMatch) {
    const [, hub, nodeId, discipline] = nodeMatch;
    const table = hub === 'sugar-house-equipment-new' ? 'shn_hierarchy_node' : 'ppn_hierarchy_node';
    try {
      const [rows] = await pool.query(
        `SELECT name FROM ${table} WHERE id = ? LIMIT 1`,
        [Number(nodeId)],
      );
      if (rows[0]?.name) {
        out.card = rows[0].name;
        out.form_or_dashboard = discipline
          ? discipline.charAt(0).toUpperCase() + discipline.slice(1)
          : out.form_or_dashboard;
        out.display_path = ['Dashboard', out.section, out.card, out.form_or_dashboard]
          .filter(Boolean)
          .join(' > ');
      }
    } catch {
      /* keep client labels */
    }
  }

  return out;
}

async function insertActivity(pool, req, payload) {
  const user = req.user;
  const uf = userFields(user);
  const sessionId = clip(payload.session_id || req.headers['x-session-id'], 64);
  if (!sessionId || !uf.user_id) {
    const err = new Error('session_id and authenticated user are required');
    err.status = 400;
    throw err;
  }

  const eventType = clip(payload.event_type || 'page_view', 30) || 'page_view';
  const labels = await resolveActivityLabels(pool, payload);
  const metadata = payload.metadata == null
    ? null
    : clip(typeof payload.metadata === 'string' ? payload.metadata : JSON.stringify(payload.metadata), 65000);

  const [result] = await pool.query(
    `INSERT INTO user_activity_logs
       (session_id, user_id, user_name, user_email, user_role, user_department,
        event_type, section, card, form_or_dashboard, page_path, display_path,
        element_id, element_label, metadata, entered_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
    [
      sessionId,
      uf.user_id,
      uf.user_name,
      uf.user_email,
      uf.user_role,
      uf.user_department,
      eventType,
      clip(labels.section, 100),
      clip(labels.card, 200),
      clip(labels.form_or_dashboard, 200),
      clip(payload.page_path, 500),
      clip(labels.display_path, 500),
      clip(payload.element_id, 200),
      clip(payload.element_label, 200),
      metadata,
      clientIp(req),
      clip(req.headers['user-agent'], 500),
    ],
  );

  if (eventType === 'page_view' || eventType === 'section_open' || eventType === 'form_open' || eventType === 'dashboard_open') {
    await bumpPagesVisited(pool, sessionId);
  }

  return result.insertId;
}

async function exitActivity(pool, activityId, userId, dwellSeconds) {
  const dwell = Number.isFinite(Number(dwellSeconds))
    ? Math.max(0, Math.round(Number(dwellSeconds)))
    : null;

  const [result] = await pool.query(
    `UPDATE user_activity_logs
     SET exited_at = NOW(),
         dwell_seconds = COALESCE(?, TIMESTAMPDIFF(SECOND, entered_at, NOW()))
     WHERE id = ? AND user_id = ? AND exited_at IS NULL`,
    [dwell, activityId, userId],
  );
  return result.affectedRows > 0;
}

async function closeOpenActivitiesForSession(pool, sessionId, userId) {
  if (!sessionId) return;
  await pool.query(
    `UPDATE user_activity_logs
     SET exited_at = NOW(),
         dwell_seconds = TIMESTAMPDIFF(SECOND, entered_at, NOW())
     WHERE session_id = ? AND user_id = ? AND exited_at IS NULL`,
    [sessionId, userId],
  );
}

module.exports = {
  SESSION_STALE_MINUTES,
  HEARTBEAT_INTERVAL_MS,
  newSessionId,
  startSession,
  heartbeatSession,
  endSession,
  expireStaleSessions,
  insertActivity,
  exitActivity,
  closeOpenActivitiesForSession,
  bumpPagesVisited,
};
