const { pool } = require('../config/mysql');
const {
  sanitizeRequestBody,
  buildChangeDescription,
  enrichAuditContext,
  parseStoredAuditBody,
  shouldSkipAudit,
  clientIp,
  captureSpecsBefore,
} = require('../utils/auditLog');

/**
 * Logs mutating API requests after the response finishes.
 * Never blocks or fails the original request.
 */
async function auditMiddleware(req, res, next) {
  const startedAt = Date.now();
  const path = req.originalUrl || req.url || '';
  const pathOnly = String(path).split('?')[0];

  // Must complete before the route replaces specs rows
  let beforeSubsections = null;
  if (!shouldSkipAudit(req.method, pathOnly) && /\/specs$/.test(pathOnly)) {
    try {
      beforeSubsections = await captureSpecsBefore(pool, pathOnly);
    } catch {
      beforeSubsections = null;
    }
  }

  res.on('finish', () => {
    try {
      if (shouldSkipAudit(req.method, pathOnly)) return;

      const user = req.user || null;
      const pathStored = String(path).slice(0, 500);
      const ua = String(req.headers['user-agent'] || '').slice(0, 500) || null;
      const method = String(req.method || '').toUpperCase().slice(0, 10);
      const statusCode = res.statusCode || null;
      const durationMs = Math.max(0, Date.now() - startedAt);

      setImmediate(async () => {
        try {
          const bodyJson = sanitizeRequestBody(req.body, { beforeSubsections });
          const readableBody = parseStoredAuditBody(bodyJson);
          const ctx = await enrichAuditContext(pool, method, pathOnly, statusCode, req.body);
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
          });

          await pool.query(
            `INSERT INTO audit_logs
               (user_id, user_name, user_email, user_role, user_department,
                method, path, status_code, success, action_type, action_summary,
                module, module_key, resource_type, resource_id, resource_name,
                display_path, screen, duration_ms, request_body, ip, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              user?.id ?? null,
              user?.name ?? null,
              user?.email ?? null,
              user?.role ?? null,
              user?.department ?? null,
              method,
              pathStored,
              statusCode,
              ctx.success,
              ctx.action_type,
              description,
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
          console.error('[auditMiddleware] insert failed:', err.message);
        }
      });
    } catch (err) {
      console.error('[auditMiddleware]', err.message);
    }
  });

  next();
}

module.exports = { auditMiddleware };
