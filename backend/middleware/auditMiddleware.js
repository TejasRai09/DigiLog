const { pool } = require('../config/mysql');
const {
  sanitizeRequestBody,
  buildChangeDescription,
  enrichAuditContext,
  parseStoredAuditBody,
  shouldSkipAudit,
  clientIp,
  captureSpecsBefore,
  outcomeMessageFromResponse,
  extractResponseText,
} = require('../utils/auditLog');

const AUDIT_INSERT_COLUMNS = [
  'user_id', 'user_name', 'user_email', 'user_role', 'user_department',
  'method', 'path', 'status_code', 'success', 'action_type', 'action_summary',
  'outcome_message', 'error_detail',
  'module', 'module_key', 'resource_type', 'resource_id', 'resource_name',
  'display_path', 'screen', 'duration_ms', 'request_body', 'ip', 'user_agent',
];

function actorDisplayName(user) {
  if (user?.name && String(user.name).trim()) return String(user.name).trim();
  if (user?.email) return `Unknown user (tried: ${user.email})`;
  return 'Unknown user';
}

function wrapJsonCapture(res) {
  const origJson = res.json.bind(res);
  res.json = (body) => {
    res.locals.auditResponse = body;
    return origJson(body);
  };
}

/**
 * Logs mutating API requests after the response finishes.
 * Never blocks or fails the original request.
 */
async function auditMiddleware(req, res, next) {
  const startedAt = Date.now();
  const path = req.originalUrl || req.url || '';
  const pathOnly = String(path).split('?')[0];
  wrapJsonCapture(res);

  // Must complete before the route replaces specs rows
  let beforeSpecs = null;
  if (!shouldSkipAudit(req.method, pathOnly) && /\/specs$/.test(pathOnly)) {
    try {
      beforeSpecs = await captureSpecsBefore(pool, pathOnly);
    } catch {
      beforeSpecs = null;
    }
  }

  res.on('finish', () => {
    try {
      if (shouldSkipAudit(req.method, pathOnly)) return;

      const user = req.auditActor || req.user || null;
      const pathStored = String(path).slice(0, 500);
      const ua = String(req.headers['user-agent'] || '').slice(0, 500) || null;
      const method = String(req.method || '').toUpperCase().slice(0, 10);
      const statusCode = res.statusCode || null;
      const durationMs = Math.max(0, Date.now() - startedAt);
      const responseBody = res.locals.auditResponse;
      const outcomeMessage = outcomeMessageFromResponse(
        statusCode,
        responseBody,
        statusCode != null && statusCode >= 200 && statusCode < 400,
      );
      const errorDetail = res.locals.auditError
        ? String(res.locals.auditError).slice(0, 1000)
        : (statusCode >= 400 ? extractResponseText(responseBody).slice(0, 1000) || null : null);

      setImmediate(async () => {
        try {
          const bodyJson = sanitizeRequestBody(req.body, {
            beforeSpecs,
            beforeValues: req.auditBefore || null,
          });
          const readableBody = parseStoredAuditBody(bodyJson);
          const ctx = await enrichAuditContext(pool, method, pathOnly, statusCode, req.body);
          const actorName = actorDisplayName(user);
          const description = buildChangeDescription({
            method,
            path: pathOnly,
            actionType: ctx.action_type,
            screen: ctx.screen,
            resourceName: ctx.resource_name,
            resourceType: ctx.resource_type,
            displayPath: ctx.display_path,
            readableBody,
            rawBody: req.body,
            parentLabel: ctx.parent_label,
            hierarchyPath: ctx.hierarchy_path,
            success: ctx.success,
            actorName,
            outcomeMessage,
            beforeValues: req.auditBefore || null,
          });

          await pool.query(
            `INSERT INTO audit_logs
               (user_id, user_name, user_email, user_role, user_department,
                method, path, status_code, success, action_type, action_summary,
                outcome_message, error_detail,
                module, module_key, resource_type, resource_id, resource_name,
                display_path, screen, duration_ms, request_body, ip, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              user?.id ?? null,
              user?.name || (user?.email ? `Unknown user (tried: ${user.email})` : null),
              user?.email ?? null,
              user?.role ?? null,
              user?.department ?? null,
              method,
              pathStored,
              statusCode,
              ctx.success,
              ctx.action_type,
              description,
              outcomeMessage,
              errorDetail,
              ctx.module,
              ctx.module_key,
              ctx.resource_type,
              ctx.resource_id != null ? String(ctx.resource_id).slice(0, 64) : null,
              ctx.resource_name != null ? String(ctx.resource_name).slice(0, 255) : null,
              ctx.display_path != null ? String(ctx.display_path).slice(0, 500) : null,
              ctx.screen,
              durationMs,
              bodyJson,
              clientIp(req),
              ua,
            ],
          );
        } catch (err) {
          console.error(
            `[auditMiddleware] insert failed method=${method} path=${pathOnly} user=${user?.email || user?.name || '—'} :`,
            err.message,
          );
        }
      });
    } catch (err) {
      console.error('[auditMiddleware]', err.message);
    }
  });

  next();
}

async function assertAuditLogsSchema(db) {
  try {
    const [cols] = await db.query('SHOW COLUMNS FROM audit_logs');
    const have = new Set((cols || []).map((c) => c.Field));
    const missing = AUDIT_INSERT_COLUMNS.filter((c) => !have.has(c));
    if (missing.length) {
      console.error(
        `[audit] audit_logs is missing columns: ${missing.join(', ')}. Apply mysql/migrate_audit_outcome.sql so Change Log inserts are not dropped.`,
      );
    }
  } catch (err) {
    console.error('[audit] could not verify audit_logs columns:', err.message);
  }
}

module.exports = { auditMiddleware, AUDIT_INSERT_COLUMNS, assertAuditLogsSchema };
