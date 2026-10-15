const { sendServerError, MSG } = require('../utils/httpError');
const {
  getRequestById,
  listPendingForHod,
  approveRequest,
  sendForModification,
  bulkApprove,
  serializeRequest,
} = require('../services/formApproval.service');

function actorFromUser(user) {
  return { id: user.id, userId: user.id, email: user.email, name: user.name };
}

const getPendingFormApprovals = async (req, res) => {
  try {
    const data = await listPendingForHod(req.user, req.query);
    res.json(data);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'getPendingFormApprovals:', err, MSG.LOAD);
  }
};

const approveFormRequest = async (req, res) => {
  try {
    const request = await getRequestById(req.params.id);
    const result = await approveRequest(request, actorFromUser(req.user));
    res.json({
      message: result.alreadyResolved ? 'Already approved.' : 'Approved.',
      status: result.status,
      alreadyResolved: result.alreadyResolved,
      item: serializeRequest(result.request),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'approveFormRequest:', err, MSG.SAVE);
  }
};

const sendFormForModification = async (req, res) => {
  try {
    const request = await getRequestById(req.params.id);
    const result = await sendForModification(request, req.body?.comment, actorFromUser(req.user));
    res.json({
      message: result.alreadyResolved ? 'Already sent for modification.' : 'Sent for modification.',
      status: result.status,
      alreadyResolved: result.alreadyResolved,
      item: serializeRequest(result.request),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'sendFormForModification:', err, MSG.SAVE);
  }
};

const bulkApproveFormRequests = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) {
      return res.status(400).json({ message: 'Select at least one change request.' });
    }
    const results = await bulkApprove(ids, req.user);
    res.json({ results });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    sendServerError(res, 'bulkApproveFormRequests:', err, MSG.SAVE);
  }
};

module.exports = {
  getPendingFormApprovals,
  approveFormRequest,
  sendFormForModification,
  bulkApproveFormRequests,
};
