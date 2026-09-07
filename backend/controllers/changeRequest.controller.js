const {
  getHodAccess,
  getRequestById,
  serializeApprovalRequest,
  assertHodForRequest,
  assertCanViewRequest,
  approveRequest,
  sendForModification,
  resubmitRequest,
  resolveConflict,
  bulkApprove,
  listMyRequests,
  listPendingForHod,
  loadConflictState,
} = require('../services/maintenanceHistoryApproval.service');
const { sendServerError, MSG } = require('../utils/httpError');

function actorFromUser(user) {
  return { id: user.id, userId: user.id, email: user.email };
}

const getApprovalAccess = async (req, res) => {
  try {
    const access = await getHodAccess(req.user.id);
    res.json({
      ...access,
      enabled: Boolean(access.sugar || access.power),
    });
  } catch (err) {
    sendServerError(res, 'getApprovalAccess:', err, MSG.LOAD);
  }
};

const getPendingApprovals = async (req, res) => {
  try {
    const data = await listPendingForHod(req.user, req.query);
    res.json(data);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'getPendingApprovals:', err, MSG.LOAD);
  }
};

const approveChangeRequest = async (req, res) => {
  try {
    const request = await getRequestById(req.params.id);
    await assertHodForRequest(req.user, request);
    const result = await approveRequest(request, actorFromUser(req.user));
    const extra = result.conflict ? { conflict: result.conflict } : {};
    res.json({
      message: result.status === 'conflict'
        ? 'Version conflict detected. Review expected vs current vs requested values.'
        : (result.alreadyResolved ? 'Already approved.' : 'Approved.'),
      status: result.status,
      alreadyResolved: result.alreadyResolved,
      item: serializeApprovalRequest(result.request, extra),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'approveChangeRequest:', err, MSG.SAVE);
  }
};

const sendChangeForModification = async (req, res) => {
  try {
    const request = await getRequestById(req.params.id);
    await assertHodForRequest(req.user, request);
    const result = await sendForModification(request, req.body?.comment, actorFromUser(req.user));
    res.json({
      message: result.alreadyResolved ? 'Already sent for modification.' : 'Sent for modification.',
      status: result.status,
      alreadyResolved: result.alreadyResolved,
      item: serializeApprovalRequest(result.request),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'sendChangeForModification:', err, MSG.SAVE);
  }
};

const bulkApproveChangeRequests = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) {
      return res.status(400).json({ message: 'Select at least one change request.' });
    }
    const results = await bulkApprove(ids, req.user);
    res.json({ results });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'bulkApproveChangeRequests:', err, MSG.SAVE);
  }
};

const resolveChangeConflict = async (req, res) => {
  try {
    const request = await getRequestById(req.params.id);
    await assertHodForRequest(req.user, request);
    const result = await resolveConflict(request, String(req.body?.resolution || '').trim(), actorFromUser(req.user));
    const extra = result.conflict ? { conflict: result.conflict } : {};
    res.json({
      message: result.status === 'cancelled' ? 'Conflict discarded.' : 'Conflict applied.',
      status: result.status,
      item: serializeApprovalRequest(result.request, extra),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'resolveChangeConflict:', err, MSG.SAVE);
  }
};

const getMyChangeRequests = async (req, res) => {
  try {
    const data = await listMyRequests(req.user.id, req.query);
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getMyChangeRequests:', err, MSG.LOAD);
  }
};

const getChangeRequestById = async (req, res) => {
  try {
    const request = await getRequestById(req.params.id);
    await assertCanViewRequest(req.user, request);
    const extra = request.status === 'conflict'
      ? { conflict: await loadConflictState(request) }
      : {};
    res.json(serializeApprovalRequest(request, extra));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'getChangeRequestById:', err, MSG.LOAD);
  }
};

const resubmitChangeRequest = async (req, res) => {
  try {
    const request = await getRequestById(req.params.id);
    const updated = await resubmitRequest(request, req.body || {}, req.user);
    res.json({
      message: 'Resubmitted for HOD approval.',
      item: serializeApprovalRequest(updated),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'resubmitChangeRequest:', err, MSG.SAVE);
  }
};

module.exports = {
  getApprovalAccess,
  getPendingApprovals,
  approveChangeRequest,
  sendChangeForModification,
  bulkApproveChangeRequests,
  resolveChangeConflict,
  getMyChangeRequests,
  getChangeRequestById,
  resubmitChangeRequest,
};
