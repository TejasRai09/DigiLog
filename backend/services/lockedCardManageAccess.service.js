/**
 * Per-user grants to edit/rename/delete locked equipment cards
 * (Sugar imported hierarchy, Power built-in hierarchy, Production imported equipment).
 * Explicit domain grants only — no role auto-bypass (including admin).
 */
const { pool } = require('../config/mysql');

const LOCKED_CARD_DOMAINS = ['sugar', 'power', 'production'];

const DOMAIN_LABELS = {
  sugar: 'Sugar House',
  power: 'Power Plant',
  production: 'Production House',
};

function normalizeDomains(raw) {
  if (!Array.isArray(raw)) return [];
  const set = new Set();
  for (const value of raw) {
    const key = String(value || '').trim().toLowerCase();
    if (LOCKED_CARD_DOMAINS.includes(key)) set.add(key);
  }
  return LOCKED_CARD_DOMAINS.filter((d) => set.has(d));
}

function emptyAccess() {
  return { sugar: false, power: false, production: false };
}

async function getLockedCardManageAccessMap(userId) {
  const access = emptyAccess();
  if (!userId) return access;
  const [rows] = await pool.query(
    `SELECT domain FROM user_locked_card_manage_access WHERE user_id = ?`,
    [userId],
  );
  for (const row of rows) {
    const domain = String(row.domain || '').toLowerCase();
    if (access[domain] != null) access[domain] = true;
  }
  return access;
}

/** True only when the user has an explicit domain grant. */
async function canManageLockedCards(user, domain) {
  if (!user?.id) return false;
  const key = String(domain || '').trim().toLowerCase();
  if (!LOCKED_CARD_DOMAINS.includes(key)) return false;
  const access = await getLockedCardManageAccessMap(user.id);
  return Boolean(access[key]);
}

async function listAdminLockedCardManageAccess() {
  const [users] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role
     FROM users u
     WHERE u.role IN ('employee', 'admin')
     ORDER BY u.name`,
  );
  const [grants] = await pool.query(
    'SELECT user_id, domain, granted_by, created_at FROM user_locked_card_manage_access',
  );
  const domainsByUser = new Map();
  for (const g of grants) {
    const uid = Number(g.user_id);
    const list = domainsByUser.get(uid) || [];
    list.push(String(g.domain).toLowerCase());
    domainsByUser.set(uid, list);
  }

  return {
    domains: LOCKED_CARD_DOMAINS.map((key) => ({
      key,
      label: DOMAIN_LABELS[key],
    })),
    assignments: users.map((u) => {
      const domains = normalizeDomains(domainsByUser.get(Number(u.id)) || []);
      return {
        user: { _id: u.id, id: u.id, name: u.name, email: u.email, role: u.role },
        domains,
        enabled: domains.length > 0,
      };
    }),
  };
}

async function upsertLockedCardManageAccess(userId, domainsRaw, grantedByUserId) {
  const domains = normalizeDomains(domainsRaw);
  const [[target]] = await pool.query('SELECT id, role FROM users WHERE id = ?', [userId]);
  if (!target) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }
  if (!['employee', 'admin'].includes(target.role)) {
    const err = new Error('Locked-card manage access applies to employees and admins only.');
    err.status = 400;
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_locked_card_manage_access WHERE user_id = ?', [userId]);
    for (const domain of domains) {
      await conn.query(
        `INSERT INTO user_locked_card_manage_access (user_id, domain, granted_by)
         VALUES (?, ?, ?)`,
        [userId, domain, grantedByUserId || null],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return {
    userId,
    domains,
    enabled: domains.length > 0,
  };
}

async function getMyLockedCardManageAccess(user) {
  if (!user?.id) return emptyAccess();
  return getLockedCardManageAccessMap(user.id);
}

module.exports = {
  LOCKED_CARD_DOMAINS,
  DOMAIN_LABELS,
  normalizeDomains,
  getLockedCardManageAccessMap,
  canManageLockedCards,
  listAdminLockedCardManageAccess,
  upsertLockedCardManageAccess,
  getMyLockedCardManageAccess,
};
