const {
  getHodAccess,
  getRequestById,
  serializeApprovalRequest,
  assertHodForRequest,
  assertCanViewRequest,
  approveRequest,
  sendForModification,
  resubmitRequest,
  updateDraftRequest,
  submitDraftRequest,
  cancelDraftRequest,
  submitEquipmentDrafts,
  resolveConflict,
  bulkApprove,
  listMyRequests,
  listPendingForHod,
  loadConflictState,
  getDocumentForLoggedInUser,
  notifyHodPendingAfterClientSubmit,
} = require('../services/maintenanceHistoryApproval.service');
const { getFormHodAccess } = require('../services/formApproval.service');
const { getNotesHodAccess } = require('../services/maintenanceNotes.service');
const { sendServerError, MSG } = require('../utils/httpError');
const path = require('path');
const fs = require('fs');

function actorFromUser(user) {
  return { id: user.id, userId: user.id, email: user.email };
}

const getApprovalAccess = async (req, res) => {
  try {
    const access = await getHodAccess(req.user);
    const formAccess = await getFormHodAccess(req.user.id);
    const notesAccess = await getNotesHodAccess(req.user);
    const maintenance = Boolean(access.sugar || access.power || access.production);
    res.json({
      ...access,
      forms: Boolean(formAccess.enabled),
      notes: Boolean(notesAccess.enabled),
      enabled: Boolean(maintenance || formAccess.enabled || notesAccess.enabled),
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
    let item = { id: result.request?.id, status: result.status, documents: [] };
    try {
      item = await serializeApprovalRequest(result.request, extra);
    } catch (err) {
      console.error('[approveChangeRequest] serialize after approve failed:', err.message);
    }
    res.json({
      message: result.status === 'conflict'
        ? 'Version conflict detected. Review expected vs current vs requested values.'
        : (result.alreadyResolved ? 'Already approved.' : 'Approved.'),
      status: result.status,
      alreadyResolved: result.alreadyResolved,
      item,
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
      item: await serializeApprovalRequest(result.request),
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
      item: await serializeApprovalRequest(result.request, extra),
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
    res.json(await serializeApprovalRequest(request, extra));
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
      item: await serializeApprovalRequest(updated),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'resubmitChangeRequest:', err, MSG.SAVE);
  }
};

const updateDraftChangeRequest = async (req, res) => {
  try {
    const request = await getRequestById(req.params.id);
    const updated = await updateDraftRequest(request, req.body || {}, req.user);
    res.json({
      message: 'Pending record updated.',
      draft: true,
      approvalRequestId: updated.id,
      item: await serializeApprovalRequest(updated),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'updateDraftChangeRequest:', err, MSG.SAVE);
  }
};

const submitDraftChangeRequest = async (req, res) => {
  try {
    const request = await getRequestById(req.params.id);
    const updated = await submitDraftRequest(request, req.user);
    res.json({
      message: 'Submitted for HOD approval.',
      approvalRequestId: updated.id,
      item: await serializeApprovalRequest(updated),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'submitDraftChangeRequest:', err, MSG.SAVE);
  }
};

const cancelDraftChangeRequest = async (req, res) => {
  try {
    const request = await getRequestById(req.params.id);
    await cancelDraftRequest(request, req.user);
    res.json({ message: 'Pending record deleted.', cancelled: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'cancelDraftChangeRequest:', err, MSG.DELETE);
  }
};

const submitDraftChangeRequests = async (req, res) => {
  try {
    const result = await submitEquipmentDrafts({
      domain: req.body?.domain,
      equipId: req.body?.equipId,
      user: req.user,
    });
    const count = result.submitted;
    res.json({
      submitted: count,
      message: count
        ? `Submitted ${count} record${count === 1 ? '' : 's'} for HOD approval.`
        : 'No pending records to submit.',
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'submitDraftChangeRequests:', err, MSG.SAVE);
  }
};

const notifyHodChangeRequest = async (req, res) => {
  try {
    const result = await notifyHodPendingAfterClientSubmit(req.params.id, req.user);
    res.json({
      message: result?.skipped ? 'HOD already notified.' : 'HOD notified.',
      ...result,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'notifyHodChangeRequest:', err, MSG.SAVE);
  }
};

const downloadApprovalDocument = async (req, res) => {
  const source = String(req.query.source || 'stored').trim();
  const name = String(req.query.name || '').trim();
  const disposition = String(req.query.disposition || 'inline').trim() === 'attachment'
    ? 'attachment'
    : 'inline';
  try {
    const file = await getDocumentForLoggedInUser(req.user, req.params.id, source, name);
    const safeDownloadName = path.basename(file.displayName || name || 'document');
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${safeDownloadName.replace(/"/g, '')}"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=300');
    return fs.createReadStream(file.absPath).pipe(res);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'downloadApprovalDocument:', err, MSG.LOAD);
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
  updateDraftChangeRequest,
  submitDraftChangeRequest,
  cancelDraftChangeRequest,
  submitDraftChangeRequests,
  notifyHodChangeRequest,
  downloadApprovalDocument,
};
