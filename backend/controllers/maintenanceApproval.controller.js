const {
  approveByToken: approveRequestByToken,
  rejectByToken: rejectRequestByToken,
  actionLabel,
  DOMAIN_TABLES,
} = require('../services/maintenanceHistoryApproval.service');
const { CLIENT_ORIGIN, APP_LOGO_URL } = require('../config/env');

const ZUARI_LOGO_URL =
  'https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusIconSvg(tone) {
  const styles = {
    success: { bg: '#ecfdf5', border: '#a7f3d0', stroke: '#059669' },
    error: { bg: '#fef2f2', border: '#fecaca', stroke: '#dc2626' },
    warning: { bg: '#fffbeb', border: '#fde68a', stroke: '#d97706' },
    info: { bg: '#eff6ff', border: '#bfdbfe', stroke: '#2563eb' },
  };
  const cfg = styles[tone] || styles.info;

  let path = '';
  if (tone === 'success') {
    path = '<polyline points="20 34 28 42 44 26" />';
  } else if (tone === 'error') {
    path = '<line x1="26" y1="26" x2="38" y2="38" /><line x1="38" y1="26" x2="26" y2="38" />';
  } else if (tone === 'warning') {
    path = '<line x1="32" y1="22" x2="32" y2="36" /><circle cx="32" cy="44" r="2.5" fill="currentColor" stroke="none" />';
  } else {
    path = '<circle cx="32" cy="24" r="2.5" fill="currentColor" stroke="none" /><line x1="32" y1="30" x2="32" y2="44" />';
  }

  return `<div class="status-icon" style="background:${cfg.bg};border-color:${cfg.border};color:${cfg.stroke}">
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      ${path}
    </svg>
  </div>`;
}

function renderHtmlPage({ title, message, tone = 'info' }) {
  const colors = {
    success: '#059669',
    error: '#dc2626',
    info: '#2563eb',
    warning: '#d97706',
  };
  const color = colors[tone] || colors.info;
  const publicBase = String(CLIENT_ORIGIN || '').replace(/\/+$/, '');
  const logoUrl = APP_LOGO_URL || `${publicBase}/logo.png`;
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} · DigiLog</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f8fafc;
      margin: 0;
      min-height: 100vh;
      color: #334155;
    }
    .app-header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 64px;
      padding: 8px 16px;
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
    }
    .app-header a { text-decoration: none; }
    .zuari-logo {
      height: 36px;
      width: auto;
      max-width: 140px;
      object-fit: contain;
      object-position: left center;
    }
    .brand-link {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-left: 4px;
    }
    .digilog-logo {
      width: 44px;
      height: 44px;
      object-fit: contain;
    }
    .brand-text {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }
    .brand-name {
      font-size: 16px;
      font-weight: 700;
      color: #1d4ed8;
    }
    .brand-tagline {
      font-size: 11px;
      color: #6b7280;
    }
    .page-body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: calc(100vh - 64px);
      padding: 40px 16px;
    }
    .card {
      width: 100%;
      max-width: 520px;
      background: #fff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      padding: 40px 32px;
      box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06);
      text-align: center;
    }
    .status-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      border-radius: 9999px;
      border: 4px solid;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .status-icon svg {
      width: 44px;
      height: 44px;
    }
    h1 {
      color: ${color};
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 12px;
    }
    p {
      color: #475569;
      line-height: 1.65;
      font-size: 14px;
      margin: 0;
    }
    @media (max-width: 480px) {
      .brand-text { display: none; }
      .card { padding: 32px 20px; }
    }
  </style>
</head>
<body>
  <header class="app-header">
    <a href="https://www.zuariindustries.in/" target="_blank" rel="noopener noreferrer" aria-label="Zuari Industries">
      <img class="zuari-logo" src="${escapeHtml(ZUARI_LOGO_URL)}" alt="Zuari Industries" />
    </a>
    <a class="brand-link" href="${escapeHtml(publicBase || '/')}">
      <img class="digilog-logo" src="${escapeHtml(logoUrl)}" alt="DigiLog" />
      <span class="brand-text">
        <span class="brand-name">DigiLog</span>
        <span class="brand-tagline">Your digital logbook</span>
      </span>
    </a>
  </header>
  <main class="page-body">
    <div class="card">
      ${statusIconSvg(tone)}
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
    </div>
  </main>
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

function formatResolvedAt(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function alreadyApprovedMessage(label, resolvedAt) {
  const when = formatResolvedAt(resolvedAt);
  if (when) {
    return `This maintenance history change for ${label} was already approved on ${when}.`;
  }
  return `This maintenance history change for ${label} was already approved.`;
}

function alreadyRejectedMessage(label, resolvedAt) {
  const when = formatResolvedAt(resolvedAt);
  if (when) {
    return `This request for ${label} was already sent back for modification on ${when}.`;
  }
  return `This request for ${label} was already sent back for modification.`;
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
      ? alreadyApprovedMessage(label, result.request.resolved_at)
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
      ? alreadyRejectedMessage(label, result.request.resolved_at)
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
      resolvedAt: result.request.resolved_at || null,
      resolvedAtDisplay: formatResolvedAt(result.request.resolved_at),
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
      resolvedAt: result.request.resolved_at || null,
      resolvedAtDisplay: formatResolvedAt(result.request.resolved_at),
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
