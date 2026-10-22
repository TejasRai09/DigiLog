const path = require('path');
const fs = require('fs');
const {
  approveByToken,
  rejectByToken,
  getReviewByToken,
  getInboxByToken,
  bulkApproveByInboxToken,
  getDocumentForReviewToken,
  formatEntryCreatedAt,
} = require('../services/maintenanceNotesMail.service');
const { renderInboxPage, renderHtmlPage } = require('./maintenanceApproval.controller');

const NOTES_INBOX_LABELS = {
  apiBase: '/api/maintenance-notes-approval',
  pageTitle: 'Maintenance note approvals',
  heading: 'Pending maintenance notes',
  reviewHeading: 'Review maintenance note',
  itemLabel: 'Activity',
  pathLabel: 'Equipment',
};

function formatResolvedAt(value) {
  if (!value) return '';
  return formatEntryCreatedAt(value);
}

const inboxByToken = async (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.status(400).send(renderHtmlPage({
      title: 'Invalid link',
      message: 'Inbox token is missing.',
      tone: 'error',
    }));
  }
  try {
    const inbox = await getInboxByToken(token);
    const openRaw = req.query.open;
    const openId = openRaw != null && String(openRaw).trim() !== ''
      ? Number(openRaw)
      : null;
    return res.send(renderInboxPage(inbox, {
      labels: NOTES_INBOX_LABELS,
      seedToken: token,
      openId: Number.isFinite(openId) ? openId : null,
    }));
  } catch (err) {
    return res.status(err.status || 500).send(renderHtmlPage({
      title: 'Unable to load approvals',
      message: err.message || 'Something went wrong.',
      tone: 'error',
    }));
  }
};

const reviewByToken = async (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.status(400).send(renderHtmlPage({
      title: 'Invalid link',
      message: 'Review token is missing.',
      tone: 'error',
    }));
  }
  try {
    const review = await getReviewByToken(token);
    if (review.status === 'approval_pending') {
      const qs = new URLSearchParams({ token });
      if (review.id) qs.set('open', String(review.id));
      return res.redirect(302, `/api/maintenance-notes-approval/inbox?${qs.toString()}`);
    }
    if (review.status === 'completed') {
      return res.send(renderHtmlPage({
        title: 'Already approved',
        message: `${review.equipmentName} was already completed${review.resolvedAt ? ` on ${formatResolvedAt(review.resolvedAt)}` : ''}.`,
        tone: 'success',
      }));
    }
    return res.send(renderHtmlPage({
      title: 'Already processed',
      message: `${review.equipmentName} was already ${String(review.status || '').replace(/_/g, ' ')}.`,
      tone: 'warning',
    }));
  } catch (err) {
    return res.status(err.status || 500).send(renderHtmlPage({
      title: 'Unable to review',
      message: err.message || 'Something went wrong.',
      tone: 'error',
    }));
  }
};

const reviewByTokenJson = async (req, res) => {
  const token = String(req.query.token || req.body?.token || '').trim();
  if (!token) return res.status(400).json({ message: 'Token is required.' });
  try {
    const review = await getReviewByToken(token);
    return res.json({
      id: review.id,
      status: review.status,
      alreadyResolved: review.alreadyResolved,
      equipmentName: review.equipmentName,
      equipmentPath: review.equipmentPath || '',
      action: review.action,
      actionLabel: review.actionLabel,
      domain: review.domain,
      domainLabel: review.domainLabel,
      submitterName: review.submitterName,
      submitterEmail: review.submitterEmail,
      createdAt: review.createdAt || null,
      createdAtLabel: review.createdAtLabel,
      diff: review.diff,
      photosBefore: review.photosBefore,
      photosAfter: review.photosAfter,
      documents: review.documents || [],
      acceptToken: review.acceptToken,
      rejectToken: review.rejectToken,
      tokenExpiresAt: review.tokenExpiresAt,
      tokenExpiresAtDisplay: formatResolvedAt(review.tokenExpiresAt),
      resolvedAt: review.resolvedAt,
      resolvedAtDisplay: formatResolvedAt(review.resolvedAt),
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Review failed.' });
  }
};

const acceptByTokenJson = async (req, res) => {
  const token = String(req.query.token || req.body?.token || '').trim();
  if (!token) return res.status(400).json({ message: 'Token is required.' });
  try {
    const result = await approveByToken(token);
    return res.json({
      status: result.status,
      alreadyResolved: result.alreadyResolved,
      equipmentName: result.request?.activity_description || '',
      action: 'create',
      resolvedAt: result.request?.hod_decision_at || null,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Approval failed.' });
  }
};

const rejectByTokenJson = async (req, res) => {
  const token = String(req.query.token || req.body?.token || '').trim();
  const comment = String(req.body?.comment || '').trim();
  if (!token) return res.status(400).json({ message: 'Token is required.' });
  if (!comment) return res.status(400).json({ message: 'A comment is required when sending for modification.' });
  try {
    const result = await rejectByToken(token, comment);
    return res.json({
      status: result.status,
      alreadyResolved: result.alreadyResolved,
      equipmentName: result.request?.activity_description || '',
      action: 'create',
      resolvedAt: result.request?.hod_decision_at || null,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Request failed.' });
  }
};

const bulkAcceptByTokenJson = async (req, res) => {
  const token = String(req.query.token || req.body?.token || '').trim();
  if (!token) return res.status(400).json({ message: 'Token is required.' });
  try {
    const result = await bulkApproveByInboxToken(token, req.body?.ids);
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Bulk approve failed.' });
  }
};

const documentByToken = async (req, res) => {
  const token = String(req.query.token || '').trim();
  const name = String(req.query.name || '').trim();
  const disposition = String(req.query.disposition || 'inline').trim() === 'attachment'
    ? 'attachment'
    : 'inline';
  if (!token) return res.status(400).json({ message: 'Token is required.' });
  try {
    const file = await getDocumentForReviewToken(token, name);
    const safeDownloadName = path.basename(file.doc.displayName || name || 'document');
    res.setHeader('Content-Type', file.doc.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${safeDownloadName.replace(/"/g, '')}"`,
    );
    fs.createReadStream(file.abs).pipe(res);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    return res.status(500).json({ message: 'Unable to open document.' });
  }
};

module.exports = {
  inboxByToken,
  reviewByToken,
  reviewByTokenJson,
  acceptByTokenJson,
  rejectByTokenJson,
  bulkAcceptByTokenJson,
  documentByToken,
};
