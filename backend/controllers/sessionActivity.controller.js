const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const {
  startSession,
  heartbeatSession,
  endSession,
  insertActivity,
  exitActivity,
  closeOpenActivitiesForSession,
} = require('../utils/sessionActivity');

function sessionIdFromReq(req) {
  return String(req.body?.session_id || req.headers['x-session-id'] || '').trim() || null;
}

/** POST /auth/session/start — create tracking session after login / restore */
async function startTrackingSession(req, res) {
  try {
    const sessionId = await startSession(pool, req, req.user);
    return res.status(201).json({ session_id: sessionId });
  } catch (err) {
    return sendServerError(res, 'startTrackingSession', err, MSG.SERVER);
  }
}

/** POST /auth/session/heartbeat */
async function sessionHeartbeat(req, res) {
  try {
    const sessionId = sessionIdFromReq(req);
    if (!sessionId) return res.status(400).json({ message: 'session_id required.' });
    const ok = await heartbeatSession(pool, sessionId, req.user.id);
    if (!ok) return res.status(404).json({ message: 'Active session not found.' });
    return res.json({ ok: true });
  } catch (err) {
    return sendServerError(res, 'sessionHeartbeat', err, MSG.SERVER);
  }
}

/** POST /auth/logout — end session (JWT remains client-cleared) */
async function logoutSession(req, res) {
  try {
    const sessionId = sessionIdFromReq(req);
    if (sessionId) {
      await closeOpenActivitiesForSession(pool, sessionId, req.user.id);
      await endSession(pool, sessionId, req.user.id);
    }
    return res.json({ ok: true });
  } catch (err) {
    return sendServerError(res, 'logoutSession', err, MSG.SERVER);
  }
}

/** POST /activity/page-view (and other event types via event_type) */
async function recordActivity(req, res) {
  try {
    const id = await insertActivity(pool, req, {
      session_id: sessionIdFromReq(req),
      ...req.body,
    });
    return res.status(201).json({ id });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ message: err.message });
    return sendServerError(res, 'recordActivity', err, MSG.SERVER);
  }
}

/** PATCH /activity/:id/exit */
async function exitActivityEvent(req, res) {
  try {
    const activityId = Number(req.params.id);
    if (!Number.isFinite(activityId)) {
      return res.status(400).json({ message: 'Invalid activity id.' });
    }
    const ok = await exitActivity(pool, activityId, req.user.id, req.body?.dwell_seconds);
    if (!ok) return res.status(404).json({ message: 'Open activity not found.' });
    return res.json({ ok: true });
  } catch (err) {
    return sendServerError(res, 'exitActivityEvent', err, MSG.SERVER);
  }
}

module.exports = {
  startTrackingSession,
  sessionHeartbeat,
  logoutSession,
  recordActivity,
  exitActivityEvent,
};
