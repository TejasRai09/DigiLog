const {
  createEditRequest,
  listEditRequests,
  countPending,
  approveEditRequest,
  rejectEditRequest,
} = require('../services/formEditRequest.service');
const { isFormsHubViewOnly, VIEW_ONLY_MESSAGE } = require('../utils/formsHubViewOnly');

function sendError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error('[formEditRequest]', err);
  return res.status(500).json({ message: fallback });
}

const postEditRequest = async (req, res) => {
  if (isFormsHubViewOnly(req.user)) {
    return res.status(403).json({ message: VIEW_ONLY_MESSAGE });
  }
  try {
    const comment = String(req.body?.editRequestComment || '').trim();
    const body = { ...req.body };
    delete body.editRequestComment;
    const result = await createEditRequest({
      user: req.user,
      formKey: req.params.formKey,
      recordKey: req.params.recordKey,
      body,
      comment,
    });
    res.status(201).json({ message: 'Edit request sent.', id: result.id });
  } catch (err) {
    sendError(res, err, 'Could not send the edit request.');
  }
};

const getEditRequests = async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const requests = await listEditRequests(status || null);
    res.json({ requests });
  } catch (err) {
    sendError(res, err, 'Could not load edit requests.');
  }
};

const getEditRequestCount = async (_req, res) => {
  try {
    const pending = await countPending();
    res.json({ pending });
  } catch (err) {
    sendError(res, err, 'Could not count edit requests.');
  }
};

const postApproveEditRequest = async (req, res) => {
  try {
    await approveEditRequest(req.params.id, req.user);
    res.json({ message: 'Edit request approved.' });
  } catch (err) {
    sendError(res, err, 'Could not approve the edit request.');
  }
};

const postRejectEditRequest = async (req, res) => {
  try {
    await rejectEditRequest(req.params.id, req.user);
    res.json({ message: 'Edit request rejected.' });
  } catch (err) {
    sendError(res, err, 'Could not reject the edit request.');
  }
};

module.exports = {
  postEditRequest,
  getEditRequests,
  getEditRequestCount,
  postApproveEditRequest,
  postRejectEditRequest,
};
