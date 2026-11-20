const {
  createEditRequest,
  listEditRequests,
  countPending,
  approveEditRequest,
  rejectEditRequest,
  isEditRequestFlowEnabled,
  setEditRequestFlowEnabled,
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

const getEditRequestSettings = async (_req, res) => {
  try {
    const enabled = await isEditRequestFlowEnabled();
    res.json({ enabled });
  } catch (err) {
    sendError(res, err, 'Could not load the edit request setting.');
  }
};

const putEditRequestSettings = async (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') {
    return res.status(400).json({ message: 'enabled must be true or false.' });
  }
  try {
    const enabled = await setEditRequestFlowEnabled(req.body.enabled);
    res.json({ enabled });
  } catch (err) {
    sendError(res, err, 'Could not save the edit request setting.');
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
  getEditRequestSettings,
  putEditRequestSettings,
  postApproveEditRequest,
  postRejectEditRequest,
};
