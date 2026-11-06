const { pool } = require('../config/mysql');
const {
  actionTypeFromMethod,
  enrichAuditContext,
  parseStoredAuditBody,
  buildChangeDescription,
  isAuthLoginPath,
  resultLabel,
  friendlyStatus,
} = require('../utils/auditLog');
const { pushAuditLogTreeFilters } = require('../utils/auditFilterMap');
const { pushIstDayRange } = require('../utils/istDayRange');

const ACTION_TO_METHODS = {
  Create: ['POST'],
  Update: ['PUT', 'PATCH'],
  Delete: ['DELETE'],
  Login: null,
};

const AUTH_LOGIN_PATH_SQL = `(
  path LIKE '/api/auth/login%'
  OR path LIKE '/api/auth/outlook%'
  OR path LIKE '/api/auth/google%'
)`;

const APPROVALS_PATH_SQL = `(
  path LIKE '%/change-requests%'
  OR path LIKE '%/maintenance-approval%'
  OR path LIKE '%/form-approvals%'
  OR path LIKE '%/form-approval/%'
  OR path LIKE '%/maintenance-notes-approval%'
)`;

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

function readQuery(req) {
  return {
    q: typeof req.query.q === 'string' ? req.query.q.trim() : '',
    action: typeof req.query.action === 'string' ? req.query.action.trim() : '',
    methodRaw: typeof req.query.method === 'string' ? req.query.method.trim().toUpperCase() : '',
    statusRaw: typeof req.query.status === 'string' ? req.query.status.trim() : '',
    successRaw: typeof req.query.success === 'string' ? req.query.success.trim() : '',
    from: typeof req.query.from === 'string' ? req.query.from.trim() : '',
    to: typeof req.query.to === 'string' ? req.query.to.trim() : '',
    moduleFilter: typeof req.query.module === 'string' ? req.query.module.trim() : '',
    screenFilter: typeof req.query.screen === 'string' ? req.query.screen.trim() : '',
    resourceNameFilter: typeof req.query.resource_name === 'string' ? req.query.resource_name.trim() : '',
    filterRoot: typeof req.query.filter_root === 'string' ? req.query.filter_root.trim() : '',
    filterBranch: typeof req.query.filter_branch === 'string' ? req.query.filter_branch.trim() : '',
    filterLeaf: typeof req.query.filter_leaf === 'string' ? req.query.filter_leaf.trim() : '',
    filterCard: typeof req.query.filter_card === 'string' ? req.query.filter_card.trim() : '',
    filterScreen: typeof req.query.filter_screen === 'string' ? req.query.filter_screen.trim() : '',
    quick: typeof req.query.quick === 'string' ? req.query.quick.trim() : '',
  };
}

function pushQuickFilter(where, params, quick) {
  if (quick === 'problems') {
    where.push('(success = 0 OR (success IS NULL AND (status_code < 200 OR status_code >= 400)))');
    return;
  }
  if (quick === 'edits') {
    where.push(`(
      action_type IN ('Update', 'Delete')
      OR (action_type IS NULL AND method IN ('PUT', 'PATCH', 'DELETE'))
    )`);
    return;
  }
  if (quick === 'approvals') {
    where.push(APPROVALS_PATH_SQL);
    return;
  }
  if (quick === 'uploads') {
    where.push(`(module = 'Data Upload' OR path LIKE '/api/data-upload%')`);
    return;
  }
  if (quick === 'logins') {
    where.push(`(action_type = 'Login' OR ${AUTH_LOGIN_PATH_SQL})`);
  }
}

function buildAuditWhere(q, opts = {}) {
  const where = [];
  const params = [];
  const skipAction = opts.skipAction === true;
  const skipSuccess = opts.skipSuccess === true;
  const skipQuick = opts.skipQuick === true;

  if (q.q) {
    where.push(`(
      path LIKE ? OR user_email LIKE ? OR user_name LIKE ? OR action_summary LIKE ?
      OR display_path LIKE ? OR resource_name LIKE ? OR user_department LIKE ?
      OR outcome_message LIKE ?
    )`);
    const like = `%${q.q}%`;
    params.push(like, like, like, like, like, like, like, like);
  }

  const treeAction = q.filterRoot === 'Config' && ['Create', 'Update', 'Delete'].includes(q.filterLeaf)
    ? q.filterLeaf
    : '';
  const effectiveAction = treeAction || q.action;

  if (!skipAction) {
    const methodsFromAction = ACTION_TO_METHODS[effectiveAction];
    if (effectiveAction === 'Login') {
      where.push(`(action_type = ? OR ${AUTH_LOGIN_PATH_SQL})`);
      params.push('Login');
    } else if (methodsFromAction && !treeAction) {
      const methodSql = `action_type = ? OR (action_type IS NULL AND method IN (${methodsFromAction.map(() => '?').join(',')}))`;
      if (effectiveAction === 'Create') {
        where.push(`((${methodSql}) AND NOT ${AUTH_LOGIN_PATH_SQL})`);
      } else {
        where.push(`(${methodSql})`);
      }
      params.push(effectiveAction, ...methodsFromAction);
    } else if (!treeAction && q.methodRaw && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(q.methodRaw)) {
      where.push('method = ?');
      params.push(q.methodRaw);
    }
  }

  if (q.statusRaw && /^\d{3}$/.test(q.statusRaw)) {
    where.push('status_code = ?');
    params.push(Number(q.statusRaw));
  }

  if (!skipSuccess) {
    if (q.successRaw === '1' || q.successRaw === 'true') {
      where.push('(success = 1 OR (success IS NULL AND status_code >= 200 AND status_code < 400))');
    } else if (q.successRaw === '0' || q.successRaw === 'false') {
      where.push('(success = 0 OR (success IS NULL AND (status_code < 200 OR status_code >= 400)))');
    }
  }

  if (q.filterRoot) {
    pushAuditLogTreeFilters(where, params, {
      root: q.filterRoot,
      branch: q.filterBranch,
      leaf: q.filterLeaf,
      card: q.filterCard,
      screen: q.filterScreen,
    });
  } else {
    if (q.moduleFilter) {
      where.push('module = ?');
      params.push(q.moduleFilter);
    }
    if (q.screenFilter) {
      where.push('screen = ?');
      params.push(q.screenFilter);
    }
    if (q.resourceNameFilter) {
      where.push('resource_name = ?');
      params.push(q.resourceNameFilter);
    }
  }

  if (!skipQuick) pushQuickFilter(where, params, q.quick);

  pushIstDayRange(where, params, 'created_at', q.from, q.to);

  return { where, params };
}

/**
 * GET /admin/audit-logs
 * Query: page, limit, q, action, status, success, from, to, quick
 */
exports.listAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;
    const q = readQuery(req);
    const { where, params } = buildAuditWhere(q);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`,
      params,
    );

    const [rows] = await pool.query(
      `SELECT id, created_at, user_id, user_name, user_email, user_role, user_department,
              method, path, status_code, success, action_type, action_summary,
              outcome_message, error_detail, duration_ms,
              module, module_key, resource_type, resource_id, resource_name,
              display_path, screen, request_body, ip, user_agent
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

      const actionType = isAuthLoginPath(row.path)
        ? 'Login'
        : (row.action_type || enriched?.action_type || actionTypeFromMethod(row.method));
      const displayPath = row.display_path || enriched?.display_path || row.path;
      const screen = row.screen || enriched?.screen || null;
      const resourceName = row.resource_name || enriched?.resource_name || bodyHint?.name || null;
      const resourceType = row.resource_type || enriched?.resource_type || null;

      const storedSummary = row.action_summary && String(row.action_summary).trim()
        ? String(row.action_summary).trim()
        : null;
      const description = storedSummary || buildChangeDescription({
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
        success: success == null ? null : (success ? 1 : 0),
        outcomeMessage: row.outcome_message,
      });

      const label = resultLabel({
        success,
        statusCode: row.status_code,
        outcomeMessage: row.outcome_message,
        actionType,
        actionSummary: description,
        path: row.path,
      });

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
        location: displayPath || row.path || '—',
        request_body_readable: readable,
        change_kind: readable?.change_kind || null,
        outcome_message: row.outcome_message || null,
        error_detail: row.error_detail || null,
        duration_ms: row.duration_ms == null ? null : Number(row.duration_ms),
        user_agent: row.user_agent || null,
        ip: row.ip || null,
        result_label: label,
        status_label: friendlyStatus(row.status_code),
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

/**
 * GET /admin/audit-logs/summary
 * Counts for the selected dates (and area cascade / search). Result chips do not shrink this strip.
 */
exports.summaryAuditLogs = async (req, res) => {
  try {
    const q = readQuery(req);
    const { where, params } = buildAuditWhere(q, { skipAction: true, skipSuccess: true, skipQuick: true });
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[row]] = await pool.query(
      `SELECT
         SUM(CASE
           WHEN (success = 1 OR (success IS NULL AND status_code >= 200 AND status_code < 400))
            AND (action_type = 'Create' OR (action_type IS NULL AND method = 'POST'))
            AND path LIKE '/api/forms%'
            AND IFNULL(outcome_message, '') NOT LIKE '%Sent for approval%'
            AND IFNULL(action_summary, '') NOT LIKE '% for approval%'
           THEN 1 ELSE 0 END) AS saved,
         SUM(CASE
           WHEN IFNULL(outcome_message, '') LIKE '%Sent for approval%'
             OR IFNULL(action_summary, '') LIKE '% for approval%'
           THEN 1 ELSE 0 END) AS sent_for_approval,
         SUM(CASE
           WHEN ${APPROVALS_PATH_SQL.replace(/\n/g, ' ')}
           THEN 1 ELSE 0 END) AS approvals,
         SUM(CASE
           WHEN action_type = 'Update' OR (action_type IS NULL AND method IN ('PUT', 'PATCH'))
           THEN 1 ELSE 0 END) AS edits,
         SUM(CASE
           WHEN action_type = 'Delete' OR method = 'DELETE'
           THEN 1 ELSE 0 END) AS deletes,
         SUM(CASE
           WHEN success = 0 OR (success IS NULL AND (status_code < 200 OR status_code >= 400))
           THEN 1 ELSE 0 END) AS failed
       FROM audit_logs
       ${whereSql}`,
      params,
    );

    res.json({
      saved: Number(row?.saved || 0),
      sent_for_approval: Number(row?.sent_for_approval || 0),
      approvals: Number(row?.approvals || 0),
      edits: Number(row?.edits || 0),
      deletes: Number(row?.deletes || 0),
      failed: Number(row?.failed || 0),
    });
  } catch (err) {
    console.error('[summaryAuditLogs]', err);
    res.status(500).json({ message: 'Failed to load audit summary.' });
  }
};
