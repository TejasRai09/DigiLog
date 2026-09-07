/**
 * Generic in-app notifications for DigiLog users.
 * New product flows should call createUserNotification with a stable `type`
 * string and optional meta — no schema change required for new kinds.
 */
const { pool } = require('../config/mysql');

const LIST_LIMIT_DEFAULT = 50;
const LIST_LIMIT_MAX = 100;

function parseMeta(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function serializeNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body || '',
    linkUrl: row.link_url || null,
    ctaLabel: row.cta_label || null,
    refType: row.ref_type || null,
    refId: row.ref_id != null ? Number(row.ref_id) : null,
    meta: parseMeta(row.meta_json),
    read: Boolean(row.read_at),
    readAt: row.read_at || null,
    createdAt: row.created_at,
  };
}

/**
 * @param {{
 *   userId: number,
 *   type: string,
 *   title: string,
 *   body?: string,
 *   linkUrl?: string|null,
 *   ctaLabel?: string|null,
 *   refType?: string|null,
 *   refId?: number|null,
 *   meta?: object|null,
 * }} input
 */
async function createUserNotification(input) {
  const userId = Number(input.userId);
  if (!userId) return null;

  const type = String(input.type || '').trim().slice(0, 64);
  const title = String(input.title || '').trim().slice(0, 255);
  if (!type || !title) return null;

  const body = input.body != null ? String(input.body) : null;
  const linkUrl = input.linkUrl != null ? String(input.linkUrl).slice(0, 500) : null;
  const ctaLabel = input.ctaLabel != null ? String(input.ctaLabel).slice(0, 64) : null;
  const refType = input.refType != null ? String(input.refType).slice(0, 64) : null;
  const refId = input.refId != null ? Number(input.refId) : null;
  const metaJson = input.meta != null ? JSON.stringify(input.meta) : null;

  try {
    const [result] = await pool.execute(
      `INSERT INTO user_notification
         (user_id, type, title, body, link_url, cta_label, ref_type, ref_id, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, type, title, body, linkUrl, ctaLabel, refType, refId || null, metaJson],
    );
    return { id: result.insertId };
  } catch (err) {
    console.error('[userNotification] create failed:', err.message);
    return null;
  }
}

async function listNotificationsForUser(userId, query = {}) {
  const limit = Math.min(
    LIST_LIMIT_MAX,
    Math.max(1, parseInt(query.limit || String(LIST_LIMIT_DEFAULT), 10) || LIST_LIMIT_DEFAULT),
  );
  const [rows] = await pool.query(
    `SELECT * FROM user_notification
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ${limit}`,
    [userId],
  );
  return { items: rows.map(serializeNotification) };
}

async function getUnreadCount(userId) {
  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM user_notification
     WHERE user_id = ? AND read_at IS NULL`,
    [userId],
  );
  return { count: Number(count) || 0 };
}

async function markNotificationRead(userId, notificationId) {
  const [result] = await pool.execute(
    `UPDATE user_notification
     SET read_at = COALESCE(read_at, NOW())
     WHERE id = ? AND user_id = ?`,
    [notificationId, userId],
  );
  if (result.affectedRows === 0) {
    const err = new Error('Notification not found.');
    err.status = 404;
    throw err;
  }
  return { ok: true };
}

async function markAllNotificationsRead(userId) {
  await pool.execute(
    `UPDATE user_notification
     SET read_at = NOW()
     WHERE user_id = ? AND read_at IS NULL`,
    [userId],
  );
  return { ok: true };
}

module.exports = {
  createUserNotification,
  listNotificationsForUser,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  serializeNotification,
};
