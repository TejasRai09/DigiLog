const { pool } = require('../config/mysql');
const {
  actionTypeFromMethod,
  enrichAuditContext,
  parseStoredAuditBody,
  buildChangeDescription,
} = require('../utils/auditLog');

const ACTION_TO_METHODS = {
  Create: ['POST'],
  Update: ['PUT', 'PATCH'],
  Delete: ['DELETE'],
};

/** Best-effort rebuild of original keys from stored readable audit body. */
function rawBodyHintFromReadable(readable) {
  if (!readable || !Array.isArray(readable.fields)) return null;
  const out = {};
  for (const f of readable.fields) {
    const label = String(f.field || '').trim().toLowerCase();
    const val = f.value;
    if (val == null || val === '') continue;
    if (label === 'name' || label === 'name of equipment') out.name = val;
    else if (label === 'node type') out.node_type = val;
    else if (label === 'parent id') out.parent_id = val;
    else if (label === 'season label') out.season_label = val;
    else if (label === 'section') out.section = val;
    else if (label === 'equipment / sub-section' || label === 'sub section') out.sub_section = val;
    else if (label.includes('equip') && label.includes('no')) out.equip_no = val;
    else if (label === 'location') out.location = val;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * GET /admin/audit-logs
 * Query: page, limit, q, action, status, success, from, to
 */
exports.listAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
    const methodRaw = typeof req.query.method === 'string' ? req.query.method.trim().toUpperCase() : '';
    const statusRaw = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const successRaw = typeof req.query.success === 'string' ? req.query.success.trim() : '';
    const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';

    const where = [];
    const params = [];

    if (q) {
      where.push(`(
        path LIKE ? OR user_email LIKE ? OR user_name LIKE ? OR action_summary LIKE ?
        OR display_path LIKE ? OR resource_name LIKE ? OR user_department LIKE ?
      )`);
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like, like);
    }

    const methodsFromAction = ACTION_TO_METHODS[action];
    if (methodsFromAction) {
      where.push(`(action_type = ? OR (action_type IS NULL AND method IN (${methodsFromAction.map(() => '?').join(',')})))`);
      params.push(action, ...methodsFromAction);
    } else if (methodRaw && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(methodRaw)) {
      where.push('method = ?');
      params.push(methodRaw);
    }

    if (statusRaw && /^\d{3}$/.test(statusRaw)) {
      where.push('status_code = ?');
      params.push(Number(statusRaw));
    }

    if (successRaw === '1' || successRaw === 'true') {
      where.push('(success = 1 OR (success IS NULL AND status_code >= 200 AND status_code < 400))');
    } else if (successRaw === '0' || successRaw === 'false') {
      where.push('(success = 0 OR (success IS NULL AND (status_code < 200 OR status_code >= 400)))');
    }

    if (from) {
      where.push('created_at >= ?');
      params.push(from.length <= 10 ? `${from} 00:00:00` : from);
    }

    if (to) {
      where.push('created_at <= ?');
      params.push(to.length <= 10 ? `${to} 23:59:59` : to);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`,
      params,
    );

    const [rows] = await pool.query(
      `SELECT id, created_at, user_id, user_name, user_email, user_role, user_department,
              method, path, status_code, success, action_type, action_summary,
              module, module_key, resource_type, resource_id, resource_name,
              display_path, screen, request_body
         FROM audit_logs
         ${whereSql}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const data = await Promise.all(rows.map(async (row) => {
      const readable = parseStoredAuditBody(row.request_body);
      const bodyHint = rawBodyHintFromReadable(readable);

      let enriched = null;
      try {
        enriched = await enrichAuditContext(
          pool,
          row.method,
          row.path,
          row.status_code,
          bodyHint,
        );
      } catch {
        enriched = null;
      }

      const statusCode = row.status_code;
      const success = row.success != null
        ? !!row.success
        : (statusCode != null ? statusCode >= 200 && statusCode < 400 : null);

      const actionType = row.action_type || enriched?.action_type || actionTypeFromMethod(row.method);
      const displayPath = row.display_path || enriched?.display_path || row.path;
      const screen = row.screen || enriched?.screen || null;
      const resourceName = row.resource_name || enriched?.resource_name || bodyHint?.name || null;
      const resourceType = row.resource_type || enriched?.resource_type || null;

      const description = buildChangeDescription({
        method: row.method,
        path: row.path,
        actionType,
        screen,
        resourceName,
        resourceType,
        displayPath,
        readableBody: readable,
        rawBody: bodyHint,
        parentLabel: enriched?.parent_label || null,
        hierarchyPath: enriched?.hierarchy_path || null,
      });

      const locationParts = [displayPath].filter(Boolean);
      if (row.user_department) locationParts.push(row.user_department);

      return {
        id: row.id,
        created_at: row.created_at,
        user_id: row.user_id,
        user_name: row.user_name,
        user_email: row.user_email,
        user_role: row.user_role,
        user_department: row.user_department,
        method: row.method,
        path: row.path,
        status_code: row.status_code,
        success,
        action_type: actionType,
        description,
        display_path: displayPath,
        location: locationParts.join(' · '),
        request_body_readable: readable,
      };
    }));

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error('[listAuditLogs]', err);
    res.status(500).json({ message: 'Failed to load audit logs.' });
  }
};
