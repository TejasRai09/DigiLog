const {
  approveByToken: approveRequestByToken,
  rejectByToken: rejectRequestByToken,
  actionLabel,
  DOMAIN_TABLES,
} = require('../services/maintenanceHistoryApproval.service');

function renderHtmlPage({ title, message, tone = 'info' }) {
  const colors = {
    success: '#059669',
    error: '#dc2626',
    info: '#2563eb',
    warning: '#d97706',
  };
  const color = colors[tone] || colors.info;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; background:#f8fafc; margin:0; padding:40px 16px; }
    .card { max-width:520px; margin:0 auto; background:#fff; border-radius:16px; padding:32px; box-shadow:0 10px 30px rgba(15,23,42,.08); text-align:center; }
    h1 { color:${color}; font-size:22px; margin:0 0 12px; }
    p { color:#475569; line-height:1.6; margin:0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

function equipmentLabel(request) {
  try {
    const ctx = typeof request.equipment_context_json === 'string'
      ? JSON.parse(request.equipment_context_json)
      : request.equipment_context_json;
    return ctx?.name || ctx?.equip_no || 'equipment';
  } catch {
    return 'equipment';
  }
}

const acceptByToken = async (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.status(400).send(renderHtmlPage({
      title: 'Invalid link',
      message: 'Approval token is missing.',
      tone: 'error',
    }));
  }

  try {
    const result = await approveRequestByToken(token);
    const label = equipmentLabel(result.request);
    const domainLabel = DOMAIN_TABLES[result.request.domain]?.label || '';
    const msg = result.alreadyResolved
      ? `This maintenance history change for ${label} was already approved.`
      : `The ${actionLabel(result.request.action).toLowerCase()} maintenance history entry for ${label} (${domainLabel}) has been saved in DigiLog.`;
    return res.send(renderHtmlPage({
      title: result.alreadyResolved ? 'Already approved' : 'Approved',
      message: msg,
      tone: 'success',
    }));
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).send(renderHtmlPage({
      title: 'Unable to approve',
      message: err.message || 'Something went wrong.',
      tone: 'error',
    }));
  }
};

const rejectByToken = async (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.status(400).send(renderHtmlPage({
      title: 'Invalid link',
      message: 'Rejection token is missing.',
      tone: 'error',
    }));
  }

  try {
    const result = await rejectRequestByToken(token);
    const label = equipmentLabel(result.request);
    const msg = result.alreadyResolved
      ? `This maintenance history change for ${label} was already sent back for modification.`
      : `The submitter has been notified that the entry for ${label} was not saved. They should contact you for modification.`;
    return res.send(renderHtmlPage({
      title: result.alreadyResolved ? 'Already processed' : 'Sent for modification',
      message: msg,
      tone: 'warning',
    }));
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).send(renderHtmlPage({
      title: 'Unable to process',
      message: err.message || 'Something went wrong.',
      tone: 'error',
    }));
  }
};

/** JSON endpoints for SPA landing pages */
const acceptByTokenJson = async (req, res) => {
  const token = String(req.query.token || req.body?.token || '').trim();
  if (!token) return res.status(400).json({ message: 'Token is required.' });
  try {
    const result = await approveRequestByToken(token);
    return res.json({
      status: result.status,
      alreadyResolved: result.alreadyResolved,
      equipmentName: equipmentLabel(result.request),
      action: result.request.action,
      domain: result.request.domain,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Approval failed.' });
  }
};

const rejectByTokenJson = async (req, res) => {
  const token = String(req.query.token || req.body?.token || '').trim();
  if (!token) return res.status(400).json({ message: 'Token is required.' });
  try {
    const result = await rejectRequestByToken(token);
    return res.json({
      status: result.status,
      alreadyResolved: result.alreadyResolved,
      equipmentName: equipmentLabel(result.request),
      action: result.request.action,
      domain: result.request.domain,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Rejection failed.' });
  }
};

module.exports = {
  acceptByToken,
  rejectByToken,
  acceptByTokenJson,
  rejectByTokenJson,
};
