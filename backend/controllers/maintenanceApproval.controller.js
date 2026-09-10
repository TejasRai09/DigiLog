const {
  approveByToken: approveRequestByToken,
  rejectByToken: rejectRequestByToken,
  getReviewByToken,
  getInboxByToken,
  getRequestForRejectToken,
  getDocumentForReviewToken,
  bulkApproveByInboxToken,
  equipmentDisplayNameFromRequest,
  equipmentDisplayPartsFromRequest,
  actionLabel,
  DOMAIN_TABLES,
} = require('../services/maintenanceHistoryApproval.service');
const path = require('path');
const fs = require('fs');
const { CLIENT_ORIGIN, APP_LOGO_URL } = require('../config/env');
const { brandTitleHtml } = require('../utils/digilogBrand');

const ZUARI_LOGO_URL =
  'https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Entry / request created_at for HOD inbox & review UI (IST). */
function formatEntryCreatedAt(value) {
  if (!value) return '—';
  const s = String(value).trim();
  // mysql2 dateStrings + session UTC → treat bare DATETIME as UTC
  const mysqlUtc = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(s);
  const d = mysqlUtc
    ? new Date(`${mysqlUtc[1]}T${mysqlUtc[2]}${mysqlUtc[3] || ''}Z`)
    : new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} IST`;
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
    .brand-version {
      font-size: 10px;
      font-weight: 600;
      color: #94a3b8;
      margin-left: 2px;
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
        ${brandTitleHtml({ color: '#1d4ed8', fontSize: '16px', versionColor: '#94a3b8' })}
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

function headerHtml() {
  const publicBase = String(CLIENT_ORIGIN || '').replace(/\/+$/, '');
  const logoUrl = APP_LOGO_URL || `${publicBase}/logo.png`;
  return `
  <header class="app-header">
    <a href="https://www.zuariindustries.in/" target="_blank" rel="noopener noreferrer" aria-label="Zuari Industries">
      <img class="zuari-logo" src="${escapeHtml(ZUARI_LOGO_URL)}" alt="Zuari Industries" />
    </a>
    <a class="brand-link" href="${escapeHtml(publicBase || '/')}">
      <img class="digilog-logo" src="${escapeHtml(logoUrl)}" alt="DigiLog" />
      <span class="brand-text">
        ${brandTitleHtml({ color: '#1d4ed8', fontSize: '16px', versionColor: '#94a3b8' })}
        <span class="brand-tagline">Your digital logbook</span>
      </span>
    </a>
  </header>`;
}

function sharedHeaderCss() {
  return `
    .app-header {
      position: sticky; top: 0; z-index: 10;
      display: flex; align-items: center; gap: 12px;
      min-height: 64px; padding: 8px 16px;
      background: #fff; border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
    }
    .app-header a { text-decoration: none; }
    .zuari-logo { height: 36px; width: auto; max-width: 140px; object-fit: contain; object-position: left center; }
    .brand-link { display: inline-flex; align-items: center; gap: 10px; margin-left: 4px; }
    .digilog-logo { width: 44px; height: 44px; object-fit: contain; }
    .brand-text { display: flex; flex-direction: column; line-height: 1.2; }
    .brand-tagline { font-size: 11px; color: #6b7280; }
    @media (max-width: 480px) {
      .brand-text { display: none; }
      .app-header { min-height: 56px; padding: 8px 10px; gap: 8px; }
      .zuari-logo { height: 28px; max-width: 110px; }
      .digilog-logo { width: 36px; height: 36px; }
    }
  `;
}

function photoGridHtml(label, srcs) {
  if (!srcs?.length) return '';
  const imgs = srcs.map((src) => (
    `<img src="${escapeHtml(src)}" alt="" style="width:100%;height:88px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;" />`
  )).join('');
  return `<div style="margin-top:16px;">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">${escapeHtml(label)}</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">${imgs}</div>
  </div>`;
}

function renderReviewPage(review) {
  const publicBase = String(CLIENT_ORIGIN || '').replace(/\/+$/, '');
  const acceptUrl = `${publicBase}/api/maintenance-approval/accept?token=${encodeURIComponent(review.acceptToken)}`;
  const rejectUrl = `${publicBase}/api/maintenance-approval/reject?token=${encodeURIComponent(review.rejectToken)}`;
  const expires = formatResolvedAt(review.tokenExpiresAt);
  const rows = (review.diff || []).map((row) => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #e2e8f0;font-weight:600;width:32%;">${escapeHtml(row.label)}</td>
      <td style="padding:8px 10px;border:1px solid #e2e8f0;color:#64748b;">${escapeHtml(row.oldValue)}</td>
      <td style="padding:8px 10px;border:1px solid #e2e8f0;">${escapeHtml(row.newValue)}</td>
    </tr>
  `).join('');
  const table = rows
    ? `<table class="grid">
        <thead><tr>
          <th>Field</th>
          <th>Previous</th>
          <th>New</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    : '<p style="color:#64748b;margin-top:12px;">No field details available.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Review maintenance change · DigiLog</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; background:#f8fafc; margin:0; min-height:100vh; color:#334155; }
    ${sharedHeaderCss()}
    .page-body { max-width: 760px; margin: 0 auto; padding: 28px 16px 48px; }
    .card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:28px; box-shadow:0 4px 24px rgba(15,23,42,.06); }
    h1 { font-size:22px; margin:0 0 8px; color:#0f172a; }
    .meta { color:#64748b; font-size:14px; line-height:1.6; margin:0 0 4px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:24px; }
    .btn { display:inline-block; text-decoration:none; font-weight:700; font-size:13px; padding:12px 20px; border-radius:8px; color:#fff; }
    .btn-accept { background:#059669; }
    .btn-reject { background:#dc2626; }
    table.grid { width:100%; border-collapse:collapse; font-size:13px; margin-top:12px; }
    table.grid th { background:#1d4ed8; color:#fff; text-align:left; padding:10px 12px; border:1px solid #1e40af; }
    table.grid td { padding:10px 12px; border:1px solid #e2e8f0; vertical-align:top; }
    table.grid tbody tr:nth-child(even) { background:#f8fafc; }
    .hint { margin-top:16px; font-size:12px; color:#94a3b8; }
    .hint a { color:#2563eb; font-weight:700; text-decoration:none; }
  </style>
</head>
<body>
  ${headerHtml()}
  <main class="page-body">
    <div class="card">
      <h1>Review maintenance history change</h1>
      <p class="meta"><strong>${escapeHtml(review.domainLabel)}</strong> · ${escapeHtml(review.actionLabel)}</p>
      <p class="meta">Equipment: <strong>${escapeHtml(review.equipmentName)}</strong></p>
      <p class="meta">Path: <strong>${escapeHtml(review.equipmentPath || '—')}</strong></p>
      <p class="meta">Submitted by ${escapeHtml(review.submitterName)}${review.submitterEmail ? ` (${escapeHtml(review.submitterEmail)})` : ''}</p>
      <p class="meta">Created at: <strong>${escapeHtml(formatEntryCreatedAt(review.createdAt))}</strong></p>
      ${expires ? `<p class="meta">This link expires on ${escapeHtml(expires)}.</p>` : ''}
      ${table}
      ${photoGridHtml('Before photos', review.photosBefore)}
      ${photoGridHtml('After photos', review.photosAfter)}
      <div class="actions">
        <a class="btn btn-accept" href="${escapeHtml(acceptUrl)}">Accept</a>
        <a class="btn btn-reject" href="${escapeHtml(rejectUrl)}">Send for modification</a>
      </div>
      <p class="hint">Accept saves this entry only. Prefer the <a href="/api/maintenance-approval/inbox?token=${encodeURIComponent(review.acceptToken)}">pending inbox</a> to review and approve many items without logging in.</p>
    </div>
  </main>
</body>
</html>`;
}

function renderInboxPage(inbox, options = {}) {
  const seedToken = String(options.seedToken || '');
  const openId = options.openId != null && Number.isFinite(Number(options.openId))
    ? Number(options.openId)
    : null;
  const entriesJson = JSON.stringify(
    (inbox.entries || []).map((entry) => ({
      id: entry.id,
      acceptToken: entry.acceptToken,
      rejectToken: entry.rejectToken,
      equipmentName: entry.equipmentName,
      equipmentPath: entry.equipmentPath || '',
      actionLabel: entry.actionLabel,
      submitterName: entry.submitterName,
      submitterEmail: entry.submitterEmail,
      createdAt: entry.createdAt || null,
      createdAtLabel: formatEntryCreatedAt(entry.createdAt),
    })),
  ).replace(/</g, '\\u003c');

  const rows = (inbox.entries || []).map((entry) => {
    const submitter = entry.submitterEmail
      ? `${entry.submitterName} (${entry.submitterEmail})`
      : entry.submitterName;
    return `
      <tr data-id="${Number(entry.id)}">
        <td class="check" data-label="Select"><input type="checkbox" class="row-check" value="${Number(entry.id)}" /></td>
        <td class="num" data-label="#"></td>
        <td class="equip" data-label="Equipment">${escapeHtml(entry.equipmentName)}</td>
        <td class="path" data-label="Path">${escapeHtml(entry.equipmentPath || '—')}</td>
        <td data-label="Action">${escapeHtml(entry.actionLabel)}</td>
        <td class="created" data-label="Created at">${escapeHtml(formatEntryCreatedAt(entry.createdAt))}</td>
        <td class="submitter" data-label="Submitted by">${escapeHtml(submitter)}</td>
        <td class="act" data-label="">
          <button type="button" class="link" data-review="${Number(entry.id)}">Review</button>
        </td>
      </tr>
    `;
  }).join('');

  const body = rows
    ? `<div class="toolbar" id="inbox-toolbar">
        <label class="select-all"><input type="checkbox" id="check-all" /> Select all</label>
        <button type="button" class="btn btn-accept" id="btn-approve-selected" disabled>Approve selected</button>
      </div>
      <div class="table-wrap">
      <table class="grid inbox" id="inbox-table">
        <thead>
          <tr>
            <th style="width:40px;"></th>
            <th style="width:48px;">#</th>
            <th>Equipment</th>
            <th>Path</th>
            <th>Action</th>
            <th>Created at</th>
            <th>Submitted by</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      </div>`
    : '<p class="empty" id="inbox-empty">There are no pending approvals right now.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pending approvals · DigiLog</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; background:#f8fafc; margin:0; min-height:100vh; color:#334155; }
    ${sharedHeaderCss()}
    .page-body { max-width: 1100px; margin: 0 auto; padding: 28px 16px 48px; }
    .card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:28px; box-shadow:0 4px 24px rgba(15,23,42,.06); }
    h1 { font-size:22px; margin:0 0 8px; color:#0f172a; line-height:1.3; }
    .meta { color:#64748b; font-size:14px; line-height:1.6; margin:0 0 16px; }
    .toolbar {
      display:flex; flex-wrap:wrap; gap:8px; align-items:center;
      margin:0 0 14px; padding:10px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;
    }
    .select-all { font-size:13px; font-weight:600; color:#334155; display:inline-flex; align-items:center; gap:6px; margin-right:4px; }
    .table-wrap { width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; }
    table.grid { width:100%; border-collapse:collapse; font-size:13px; }
    table.grid th { background:#1d4ed8; color:#fff; text-align:left; padding:10px 12px; border:1px solid #1e40af; }
    table.grid td { padding:10px 12px; border:1px solid #e2e8f0; vertical-align:middle; }
    table.grid tbody tr:nth-child(even) { background:#f8fafc; }
    td.equip { font-weight:700; color:#0f172a; word-break:break-word; max-width:220px; }
    td.path { color:#475569; word-break:break-word; max-width:280px; }
    td.act, td.check { text-align:center; }
    button.link {
      background:none; border:0; padding:8px 4px; cursor:pointer;
      color:#2563eb; font-weight:700; font-size:13px; font-family:inherit;
      min-height:44px;
    }
    button.link:hover { text-decoration:underline; }
    .row-check, #check-all { width:18px; height:18px; }
    .empty { color:#64748b; font-size:14px; }
    .toast {
      display:none; margin:0 0 16px; padding:10px 12px; border-radius:8px;
      font-size:13px; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;
    }
    .toast.show { display:block; }
    .toast.warn { background:#fffbeb; color:#b45309; border-color:#fde68a; }
    .toast.err { background:#fef2f2; color:#b91c1c; border-color:#fecaca; }
    .modal-backdrop {
      display:none; position:fixed; inset:0; z-index:50;
      background:rgba(15,23,42,.45); align-items:center; justify-content:center;
      padding:16px;
    }
    .modal-backdrop.open { display:flex; }
    .modal {
      width:100%; max-width:760px; max-height:calc(100vh - 32px);
      overflow:auto; background:#fff; border-radius:16px;
      border:1px solid #e2e8f0; box-shadow:0 20px 50px rgba(15,23,42,.2); padding:24px;
      -webkit-overflow-scrolling:touch;
    }
    .modal h2 { font-size:18px; margin:0 0 8px; color:#0f172a; padding-right:40px; line-height:1.3; }
    .modal .meta { margin:0 0 4px; }
    .modal-close {
      float:right; border:0; background:#f1f5f9; color:#334155; width:40px; height:40px;
      border-radius:8px; cursor:pointer; font-size:20px; line-height:1;
    }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:20px; }
    .btn { display:inline-flex; align-items:center; justify-content:center; border:0; cursor:pointer; text-decoration:none; font-weight:700;
      font-size:13px; padding:12px 16px; border-radius:8px; color:#fff; font-family:inherit; min-height:44px; }
    .btn:disabled { opacity:.6; cursor:not-allowed; }
    .btn-accept { background:#059669; }
    .btn-reject { background:#dc2626; }
    .btn-ghost { background:#e2e8f0; color:#334155; }
    table.grid.fields { margin-top:12px; }
    table.grid.fields th { background:#1d4ed8; }
    .photos { margin-top:16px; }
    .photos p { margin:0 0 8px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; }
    .photos-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .photos-grid button {
      display:block; width:100%; padding:0; border:1px solid #e2e8f0; border-radius:8px;
      overflow:hidden; cursor:zoom-in; background:#f8fafc;
    }
    .photos-grid img { width:100%; height:88px; object-fit:cover; display:block; }
    .docs { margin-top:16px; }
    .docs p { margin:0 0 8px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; }
    .doc-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
    .doc-list li {
      display:flex; align-items:center; justify-content:space-between; gap:10px;
      padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc;
    }
    .doc-list .doc-name { font-size:13px; font-weight:600; color:#0f172a; word-break:break-word; }
    .doc-list .doc-meta { font-size:11px; color:#64748b; margin-top:2px; }
    .doc-list .doc-actions { display:flex; gap:6px; flex-shrink:0; }
    .btn-sm { padding:10px 12px; font-size:12px; min-height:40px; }
    .hint { margin-top:16px; font-size:12px; color:#94a3b8; }
    .modal-error { color:#dc2626; font-size:14px; margin:12px 0 0; }
    .lightbox {
      display:none; position:fixed; inset:0; z-index:80;
      background:rgba(15,23,42,.82); align-items:center; justify-content:center; padding:16px;
    }
    .lightbox.open { display:flex; }
    .lightbox-inner {
      position:relative; width:min(960px, 100%); max-height:calc(100vh - 32px);
      background:#0f172a; border-radius:12px; overflow:hidden;
      box-shadow:0 20px 50px rgba(0,0,0,.35);
    }
    .lightbox-toolbar {
      display:flex; align-items:center; justify-content:space-between; gap:12px;
      padding:10px 12px; background:#1e293b; color:#e2e8f0; font-size:13px;
    }
    .lightbox-toolbar span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .lightbox-toolbar button {
      border:0; background:#334155; color:#fff; border-radius:8px; padding:10px 14px;
      cursor:pointer; font-weight:700; font-family:inherit; min-height:40px; flex-shrink:0;
    }
    .lightbox-body {
      display:flex; align-items:center; justify-content:center;
      min-height:240px; max-height:calc(100vh - 96px); background:#0f172a; overflow:auto;
    }
    .lightbox-body img { max-width:100%; max-height:calc(100vh - 96px); object-fit:contain; }
    .lightbox-body iframe { width:100%; height:calc(100vh - 96px); border:0; background:#fff; }

    @media (max-width: 768px) {
      .page-body { padding: 12px 10px 32px; }
      .card { padding: 16px 12px; border-radius: 12px; }
      h1 { font-size: 18px; }
      .meta { font-size: 13px; margin-bottom: 12px; }
      .toolbar {
        flex-direction: column; align-items: stretch; gap: 10px;
        position: sticky; top: 64px; z-index: 5;
        background: #fff; border-color: #e2e8f0;
        box-shadow: 0 4px 12px rgba(15,23,42,.06);
      }
      .toolbar .btn { width: 100%; }
      .select-all { margin: 0; min-height: 40px; }

      .table-wrap { overflow: visible; }
      table.grid.inbox thead { display: none; }
      table.grid.inbox,
      table.grid.inbox tbody,
      table.grid.inbox tr,
      table.grid.inbox td {
        display: block;
        width: 100%;
        border: 0;
      }
      table.grid.inbox tbody { display: flex; flex-direction: column; gap: 10px; }
      table.grid.inbox tr {
        background: #fff !important;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 1px 2px rgba(15,23,42,.04);
      }
      table.grid.inbox td {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        padding: 6px 0;
        border-bottom: 1px solid #f1f5f9;
        text-align: right;
      }
      table.grid.inbox td:last-child { border-bottom: 0; padding-bottom: 0; }
      table.grid.inbox td::before {
        content: attr(data-label);
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: .02em;
        text-align: left;
        flex: 0 0 38%;
      }
      table.grid.inbox td.check {
        order: -2;
        justify-content: flex-start;
        align-items: center;
        padding-top: 0;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 10px;
        margin-bottom: 4px;
      }
      table.grid.inbox td.check::before { content: 'Select'; flex: none; margin-right: 8px; }
      table.grid.inbox td.num { display: none; }
      table.grid.inbox td.equip {
        order: -1;
        font-size: 15px;
        text-align: left;
        flex-direction: column;
        gap: 2px;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 10px;
        margin-bottom: 4px;
      }
      table.grid.inbox td.equip::before { content: 'Equipment'; }
      table.grid.inbox td.path {
        order: 0;
        text-align: left;
        flex-direction: column;
        gap: 2px;
        color: #475569;
        font-size: 13px;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 10px;
        margin-bottom: 4px;
      }
      table.grid.inbox td.path::before { content: 'Path'; }
      table.grid.inbox td.act {
        margin-top: 8px;
        padding-top: 10px;
        border-top: 1px solid #e2e8f0;
        border-bottom: 0;
        justify-content: stretch;
      }
      table.grid.inbox td.act::before { display: none; }
      table.grid.inbox td.act .link {
        width: 100%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #eff6ff;
        border-radius: 8px;
        text-decoration: none !important;
      }

      .modal-backdrop { padding: 0; align-items: stretch; }
      .modal {
        max-width: none;
        max-height: none;
        height: 100%;
        border-radius: 0;
        border: 0;
        padding: 16px 14px 28px;
      }
      .modal-close { position: sticky; top: 0; float: right; z-index: 2; }
      .actions { flex-direction: column; }
      .actions .btn { width: 100%; }
      table.grid.fields thead { display: none; }
      table.grid.fields,
      table.grid.fields tbody,
      table.grid.fields tr,
      table.grid.fields td { display: block; width: 100%; border: 0; }
      table.grid.fields tbody { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
      table.grid.fields tr {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
        background: #fff;
      }
      table.grid.fields td {
        padding: 10px 12px;
        border-bottom: 1px solid #f1f5f9;
        text-align: left;
        white-space: pre-wrap;
      }
      table.grid.fields td:last-child { border-bottom: 0; }
      table.grid.fields td::before {
        content: attr(data-label);
        display: block;
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        margin-bottom: 4px;
      }
      .photos-grid { grid-template-columns: repeat(2, 1fr); }
      .photos-grid img { height: 110px; }
      .doc-list li { flex-direction: column; align-items: stretch; }
      .doc-list .doc-actions { width: 100%; }
      .doc-list .doc-actions .btn,
      .doc-list .doc-actions a { flex: 1; text-align: center; }
      .lightbox { padding: 0; }
      .lightbox-inner {
        width: 100%;
        max-height: none;
        height: 100%;
        border-radius: 0;
      }
      .lightbox-body {
        min-height: calc(100vh - 56px);
        max-height: calc(100vh - 56px);
      }
      .lightbox-body img { max-height: calc(100vh - 56px); }
      .lightbox-body iframe { height: calc(100vh - 56px); }
    }

    @media (max-width: 380px) {
      .photos-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  ${headerHtml()}
  <main class="page-body">
    <div class="card">
      <h1>Pending maintenance approvals</h1>
      <p class="meta" id="inbox-meta"><strong>${escapeHtml(inbox.domainLabel)}</strong> · <span id="inbox-count">${inbox.entries.length}</span> item(s)</p>
      <p class="toast" id="inbox-toast"></p>
      ${body}
    </div>
  </main>
  <div class="modal-backdrop" id="review-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal">
      <button type="button" class="modal-close" id="modal-close" aria-label="Close">&times;</button>
      <div id="modal-body"></div>
    </div>
  </div>
  <div class="lightbox" id="media-lightbox" role="dialog" aria-modal="true" aria-label="Media viewer">
    <div class="lightbox-inner">
      <div class="lightbox-toolbar">
        <span id="lightbox-caption">Preview</span>
        <button type="button" id="lightbox-close">Close</button>
      </div>
      <div class="lightbox-body" id="lightbox-body"></div>
    </div>
  </div>
  <script>
    (function () {
      var seedToken = ${JSON.stringify(seedToken)};
      var openId = ${openId == null ? 'null' : String(openId)};
      var entries = ${entriesJson};
      var byId = {};
      entries.forEach(function (e) { byId[String(e.id)] = e; });
      var backdrop = document.getElementById('review-modal');
      var modalBody = document.getElementById('modal-body');
      var toast = document.getElementById('inbox-toast');
      var busy = false;

      function esc(v) {
        return String(v == null ? '' : v)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }
      function showToast(msg, kind) {
        toast.textContent = msg;
        toast.className = 'toast show' + (kind === 'warn' ? ' warn' : kind === 'err' ? ' err' : '');
      }
      function selectedIds() {
        return Array.prototype.map.call(
          document.querySelectorAll('#inbox-table .row-check:checked'),
          function (el) { return Number(el.value); }
        );
      }
      function syncToolbar() {
        var btn = document.getElementById('btn-approve-selected');
        var all = document.getElementById('check-all');
        var checks = document.querySelectorAll('#inbox-table .row-check');
        var n = selectedIds().length;
        if (btn) btn.disabled = !n || busy;
        if (all) {
          all.checked = checks.length > 0 && n === checks.length;
          all.indeterminate = n > 0 && n < checks.length;
        }
      }
      function renumber() {
        var nums = document.querySelectorAll('#inbox-table tbody tr td.num');
        nums.forEach(function (td, i) { td.textContent = String(i + 1); });
        var count = nums.length;
        var countEl = document.getElementById('inbox-count');
        if (countEl) countEl.textContent = String(count);
        if (!count) {
          var table = document.getElementById('inbox-table');
          var toolbar = document.getElementById('inbox-toolbar');
          if (toolbar) toolbar.remove();
          if (table) {
            var wrap = table.closest('.table-wrap') || table;
            var empty = document.createElement('p');
            empty.className = 'empty';
            empty.id = 'inbox-empty';
            empty.textContent = 'There are no pending approvals right now.';
            wrap.parentNode.replaceChild(empty, wrap);
          }
        }
        syncToolbar();
      }
      function formatBytes(n) {
        var size = Number(n) || 0;
        if (size < 1024) return size + ' B';
        if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
        return (size / (1024 * 1024)).toFixed(1) + ' MB';
      }
      function isPdf(doc) {
        var mime = String((doc && doc.mimeType) || '').toLowerCase();
        var name = String((doc && (doc.displayName || doc.name)) || '').toLowerCase();
        return mime === 'application/pdf' || name.endsWith('.pdf');
      }
      function openLightbox(kind, src, caption) {
        var lb = document.getElementById('media-lightbox');
        var body = document.getElementById('lightbox-body');
        var cap = document.getElementById('lightbox-caption');
        if (!lb || !body) return;
        cap.textContent = caption || 'Preview';
        body.innerHTML = '';
        if (kind === 'iframe') {
          var frame = document.createElement('iframe');
          frame.src = src;
          frame.title = caption || 'Document';
          body.appendChild(frame);
        } else {
          var img = document.createElement('img');
          img.src = src;
          img.alt = caption || '';
          body.appendChild(img);
        }
        lb.classList.add('open');
      }
      function closeLightbox() {
        var lb = document.getElementById('media-lightbox');
        var body = document.getElementById('lightbox-body');
        if (lb) lb.classList.remove('open');
        if (body) body.innerHTML = '';
      }
      function photoBlock(label, srcs) {
        if (!srcs || !srcs.length) return '';
        return '<div class="photos"><p>' + esc(label) + ' · click to enlarge</p><div class="photos-grid">' +
          srcs.map(function (src, i) {
            return '<button type="button" data-photo-src="' + esc(src) + '" data-photo-label="' +
              esc(label + ' #' + (i + 1)) + '"><img src="' + esc(src) + '" alt="" /></button>';
          }).join('') +
          '</div></div>';
      }
      function documentsBlock(docs) {
        if (!docs || !docs.length) return '';
        return '<div class="docs"><p>Documents · click to view</p><ul class="doc-list">' +
          docs.map(function (doc, i) {
            return '<li data-doc-idx="' + i + '">' +
              '<div><div class="doc-name">' + esc(doc.displayName || doc.name || 'Document') + '</div>' +
              '<div class="doc-meta">' + esc(doc.mimeType || 'file') +
              (doc.size ? (' · ' + formatBytes(doc.size)) : '') +
              (doc.source === 'staged' ? ' · new upload' : '') +
              '</div></div>' +
              '<div class="doc-actions">' +
                '<button type="button" class="btn btn-ghost btn-sm" data-doc-view="' + i + '">View</button>' +
                '<a class="btn btn-ghost btn-sm" href="' + esc(doc.url) + '&disposition=attachment" target="_blank" rel="noopener">Download</a>' +
              '</div></li>';
          }).join('') +
          '</ul></div>';
      }
      function closeModal() {
        closeLightbox();
        backdrop.classList.remove('open');
        modalBody.innerHTML = '';
        busy = false;
      }
      function openModal() { backdrop.classList.add('open'); }

      function renderReview(data) {
        var rows = (data.diff || []).map(function (row) {
          return '<tr>' +
            '<td data-label="Field" style="font-weight:600;width:32%;">' + esc(row.label) + '</td>' +
            '<td data-label="Previous" style="color:#64748b;white-space:pre-wrap;">' + esc(row.oldValue) + '</td>' +
            '<td data-label="New" style="white-space:pre-wrap;">' + esc(row.newValue) + '</td>' +
            '</tr>';
        }).join('');
        var table = rows
          ? '<table class="grid fields"><thead><tr><th>Field</th><th>Previous</th><th>New</th></tr></thead><tbody>' + rows + '</tbody></table>'
          : '<p class="meta">No field details available.</p>';
        var submitter = data.submitterName + (data.submitterEmail ? ' (' + data.submitterEmail + ')' : '');
        modalBody.innerHTML =
          '<h2 id="modal-title">Review maintenance history change</h2>' +
          '<p class="meta"><strong>' + esc(data.domainLabel || '') + '</strong> · ' + esc(data.actionLabel || '') + '</p>' +
          '<p class="meta">Equipment: <strong>' + esc(data.equipmentName) + '</strong></p>' +
          '<p class="meta">Path: <strong>' + esc(data.equipmentPath || '—') + '</strong></p>' +
          '<p class="meta">Submitted by ' + esc(submitter) + '</p>' +
          '<p class="meta">Created at: <strong>' + esc(data.createdAtLabel || '—') + '</strong></p>' +
          (data.tokenExpiresAtDisplay ? '<p class="meta">This link expires on ' + esc(data.tokenExpiresAtDisplay) + '.</p>' : '') +
          table +
          photoBlock('Before photos', data.photosBefore) +
          photoBlock('After photos', data.photosAfter) +
          documentsBlock(data.documents) +
          '<div class="actions">' +
            '<button type="button" class="btn btn-accept" data-act="accept">Accept</button>' +
            '<button type="button" class="btn btn-reject" data-act="reject">Send for modification</button>' +
            '<button type="button" class="btn btn-ghost" data-act="close">Close</button>' +
          '</div>' +
          '<div id="mod-comment-wrap" style="display:none;margin-top:12px;">' +
            '<label style="display:block;font-size:12px;font-weight:700;margin-bottom:6px;">Comment (required)</label>' +
            '<textarea id="mod-comment" rows="3" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-family:inherit;font-size:16px;"></textarea>' +
            '<div class="actions" style="margin-top:10px;">' +
              '<button type="button" class="btn btn-reject" data-act="reject-confirm">Submit comment</button>' +
            '</div>' +
          '</div>';
        modalBody.querySelector('[data-act="accept"]').onclick = function () { decide('accept', data); };
        modalBody.querySelector('[data-act="reject"]').onclick = function () {
          document.getElementById('mod-comment-wrap').style.display = 'block';
        };
        modalBody.querySelector('[data-act="reject-confirm"]').onclick = function () { decide('reject', data); };
        modalBody.querySelector('[data-act="close"]').onclick = closeModal;
        modalBody.querySelectorAll('[data-photo-src]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            openLightbox('image', btn.getAttribute('data-photo-src'), btn.getAttribute('data-photo-label'));
          });
        });
        modalBody.querySelectorAll('[data-doc-view]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var idx = Number(btn.getAttribute('data-doc-view'));
            var doc = (data.documents || [])[idx];
            if (!doc || !doc.url) return;
            if (isPdf(doc)) {
              openLightbox('iframe', doc.url + '&disposition=inline', doc.displayName || 'Document');
            } else {
              window.open(doc.url + '&disposition=inline', '_blank', 'noopener');
            }
          });
        });
      }

      async function postJson(path, body) {
        var res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(body)
        });
        var json = {};
        try { json = await res.json(); } catch (e) {}
        if (!res.ok) throw new Error(json.message || 'Request failed.');
        return json;
      }

      async function openReview(id) {
        var entry = byId[String(id)];
        if (!entry) return;
        openModal();
        modalBody.innerHTML = '<h2 id="modal-title">Review</h2><p class="meta">Loading details…</p>';
        try {
          var data = await postJson('/api/maintenance-approval/review', { token: entry.acceptToken });
          if (data.alreadyResolved || (data.status !== 'pending' && data.status !== 'resubmitted')) {
            modalBody.innerHTML = '<h2 id="modal-title">Already processed</h2><p class="meta">' +
              esc(data.equipmentName || entry.equipmentName) + ' is already ' + esc(data.status) + '.</p>' +
              '<div class="actions"><button type="button" class="btn btn-ghost" data-act="close">Close</button></div>';
            modalBody.querySelector('[data-act="close"]').onclick = closeModal;
            removeRow(id);
            return;
          }
          renderReview(data);
        } catch (err) {
          modalBody.innerHTML = '<h2 id="modal-title">Unable to review</h2><p class="modal-error">' +
            esc(err.message || 'Something went wrong.') + '</p>' +
            '<div class="actions"><button type="button" class="btn btn-ghost" data-act="close">Close</button></div>';
          modalBody.querySelector('[data-act="close"]').onclick = closeModal;
        }
      }

      function removeRow(id) {
        var tr = document.querySelector('#inbox-table tr[data-id="' + id + '"]');
        if (tr) tr.remove();
        delete byId[String(id)];
        renumber();
      }

      async function decide(kind, data) {
        if (busy) return;
        var extra = { token: kind === 'accept' ? data.acceptToken : data.rejectToken };
        if (kind === 'reject') {
          var box = document.getElementById('mod-comment');
          var comment = box ? String(box.value || '').trim() : '';
          if (!comment) {
            showToast('A comment is required when sending for modification.', 'err');
            return;
          }
          extra.comment = comment;
        }
        busy = true;
        var acceptBtn = modalBody.querySelector('[data-act="accept"]');
        var rejectBtn = modalBody.querySelector('[data-act="reject"]');
        var rejectConfirm = modalBody.querySelector('[data-act="reject-confirm"]');
        function setBtnBusy(btn, label) {
          if (!btn) return;
          btn.disabled = true;
          btn.dataset.prevLabel = btn.textContent;
          btn.textContent = label;
        }
        if (kind === 'accept') {
          setBtnBusy(acceptBtn, 'Approving…');
          if (rejectBtn) rejectBtn.disabled = true;
        } else {
          setBtnBusy(rejectConfirm || rejectBtn, 'Sending…');
          if (acceptBtn) acceptBtn.disabled = true;
        }
        try {
          var path = kind === 'accept' ? '/api/maintenance-approval/accept' : '/api/maintenance-approval/reject';
          var result = await postJson(path, extra);
          closeModal();
          removeRow(data.id || Object.keys(byId).find(function (k) {
            return byId[k].acceptToken === data.acceptToken;
          }));
          if (kind === 'accept') {
            showToast(result.alreadyResolved
              ? (result.equipmentName + ' was already approved.')
              : (result.equipmentName + ' has been saved in DigiLog.'));
          } else {
            showToast(result.alreadyResolved
              ? (result.equipmentName + ' was already sent back.')
              : ('Sent back for modification: ' + result.equipmentName), 'warn');
          }
        } catch (err) {
          busy = false;
          [acceptBtn, rejectBtn, rejectConfirm].forEach(function (btn) {
            if (!btn) return;
            btn.disabled = false;
            if (btn.dataset.prevLabel) btn.textContent = btn.dataset.prevLabel;
          });
          showToast(err.message || 'Action failed.', 'err');
        }
      }

      async function approveSelected() {
        var ids = selectedIds();
        if (!ids.length) {
          showToast('Select at least one item to approve.', 'warn');
          return;
        }
        if (!window.confirm('Approve the ' + ids.length + ' selected item(s)?')) return;
        if (busy) return;
        busy = true;
        var bulkBtn = document.getElementById('btn-approve-selected');
        if (bulkBtn) {
          bulkBtn.disabled = true;
          bulkBtn.dataset.prevLabel = bulkBtn.textContent;
          bulkBtn.textContent = 'Approving…';
        }
        syncToolbar();
        try {
          var result = await postJson('/api/maintenance-approval/bulk-accept', {
            token: seedToken,
            ids: ids
          });
          (result.results || []).forEach(function (row) {
            if (row.ok) removeRow(row.id);
          });
          var failed = (result.results || []).filter(function (r) { return !r.ok; });
          if (failed.length) {
            showToast(
              'Approved ' + result.approved + '. ' + failed.length + ' failed'
                + (failed[0].message ? (': ' + failed[0].message) : '.'),
              'warn'
            );
          } else {
            showToast('Approved ' + result.approved + ' item(s).');
          }
        } catch (err) {
          showToast(err.message || 'Bulk approve failed.', 'err');
        } finally {
          busy = false;
          if (bulkBtn) {
            bulkBtn.disabled = false;
            if (bulkBtn.dataset.prevLabel) bulkBtn.textContent = bulkBtn.dataset.prevLabel;
          }
          syncToolbar();
        }
      }

      document.querySelectorAll('[data-review]').forEach(function (btn) {
        btn.addEventListener('click', function (ev) {
          ev.preventDefault();
          openReview(btn.getAttribute('data-review'));
        });
      });
      var checkAll = document.getElementById('check-all');
      if (checkAll) {
        checkAll.addEventListener('change', function () {
          document.querySelectorAll('#inbox-table .row-check').forEach(function (el) {
            el.checked = checkAll.checked;
          });
          syncToolbar();
        });
      }
      document.querySelectorAll('#inbox-table .row-check').forEach(function (el) {
        el.addEventListener('change', syncToolbar);
      });
      var btnSel = document.getElementById('btn-approve-selected');
      if (btnSel) btnSel.addEventListener('click', approveSelected);

      document.getElementById('modal-close').onclick = closeModal;
      document.getElementById('lightbox-close').onclick = closeLightbox;
      document.getElementById('media-lightbox').addEventListener('click', function (ev) {
        if (ev.target === document.getElementById('media-lightbox')) closeLightbox();
      });
      backdrop.addEventListener('click', function (ev) {
        if (ev.target === backdrop) closeModal();
      });
      document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Escape') return;
        if (document.getElementById('media-lightbox').classList.contains('open')) {
          closeLightbox();
          return;
        }
        if (backdrop.classList.contains('open')) closeModal();
      });
      renumber();
      if (openId && byId[String(openId)]) {
        openReview(openId);
      }
    })();
  </script>
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
    const label = await equipmentDisplayNameFromRequest(result.request);
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

function renderModificationForm(request, token, errorMessage, equipmentName, equipmentPath) {
  const label = equipmentName || equipmentLabel(request);
  const path = equipmentPath || '—';
  const err = errorMessage
    ? `<p class="hint" style="color:#dc2626;">${escapeHtml(errorMessage)}</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Send for modification · DigiLog</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; background:#f8fafc; margin:0; min-height:100vh; color:#334155; }
    ${sharedHeaderCss()}
    .page-body { max-width: 640px; margin: 0 auto; padding: 28px 16px 48px; }
    .card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:28px; box-shadow:0 4px 24px rgba(15,23,42,.06); }
    h1 { font-size:22px; margin:0 0 8px; color:#0f172a; }
    .meta { color:#64748b; font-size:14px; line-height:1.6; margin:0 0 12px; }
    label { display:block; font-size:13px; font-weight:700; margin:16px 0 8px; }
    textarea { width:100%; min-height:120px; border:1px solid #e2e8f0; border-radius:8px; padding:10px; font-family:inherit; }
    .btn { display:inline-block; border:0; cursor:pointer; font-weight:700; font-size:13px; padding:12px 20px; border-radius:8px; color:#fff; background:#dc2626; margin-top:16px; }
  </style>
</head>
<body>
  ${headerHtml()}
  <main class="page-body">
    <div class="card">
      <h1>Send for modification</h1>
      <p class="meta">Equipment: <strong>${escapeHtml(label)}</strong></p>
      <p class="meta">Path: <strong>${escapeHtml(path)}</strong></p>
      <p class="meta">A comment is required so the employee can correct this request. The approved record will not change.</p>
      ${err}
      <form method="POST" action="/api/maintenance-approval/reject">
        <input type="hidden" name="token" value="${escapeHtml(token)}" />
        <label for="comment">Comment</label>
        <textarea id="comment" name="comment" required placeholder="Describe what should be changed"></textarea>
        <button class="btn" type="submit">Send for modification</button>
      </form>
    </div>
  </main>
</body>
</html>`;
}

const rejectByToken = async (req, res) => {
  const token = String(req.query.token || req.body?.token || '').trim();
  if (!token) {
    return res.status(400).send(renderHtmlPage({
      title: 'Invalid link',
      message: 'Modification token is missing.',
      tone: 'error',
    }));
  }

  if (req.method === 'GET') {
    try {
      const request = await getRequestForRejectToken(token);
      const display = await equipmentDisplayPartsFromRequest(request);
      const label = display.equipmentName;
      if (request.tokenExpired) {
        return res.status(410).send(renderHtmlPage({
          title: 'Link expired',
          message: 'This link has expired. Use the latest daily digest email, or ask an admin to resend the digest (no DigiLog login required).',
          tone: 'warning',
        }));
      }
      if (request.status === 'needs_modification') {
        return res.send(renderHtmlPage({
          title: 'Already processed',
          message: alreadyRejectedMessage(label, request.resolved_at),
          tone: 'warning',
        }));
      }
      return res.send(renderModificationForm(request, token, null, label, display.equipmentPath));
    } catch (err) {
      return res.status(err.status || 500).send(renderHtmlPage({
        title: 'Unable to process',
        message: err.message || 'Something went wrong.',
        tone: 'error',
      }));
    }
  }

  const comment = String(req.body?.comment || '').trim();
  if (!comment) {
    try {
      const request = await getRequestForRejectToken(token);
      const display = await equipmentDisplayPartsFromRequest(request);
      return res.status(400).send(renderModificationForm(
        request,
        token,
        'A comment is required.',
        display.equipmentName,
        display.equipmentPath,
      ));
    } catch (err) {
      return res.status(err.status || 500).send(renderHtmlPage({
        title: 'Unable to process',
        message: err.message || 'Something went wrong.',
        tone: 'error',
      }));
    }
  }

  try {
    const result = await rejectRequestByToken(token, comment);
    const label = await equipmentDisplayNameFromRequest(result.request);
    const msg = result.alreadyResolved
      ? alreadyRejectedMessage(label, result.request.resolved_at)
      : `The submitter has been asked to modify the entry for ${label}.`;
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
      equipmentName: await equipmentDisplayNameFromRequest(result.request),
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
  const comment = String(req.body?.comment || '').trim();
  if (!token) return res.status(400).json({ message: 'Token is required.' });
  if (!comment) return res.status(400).json({ message: 'A comment is required when sending for modification.' });
  try {
    const result = await rejectRequestByToken(token, comment);
    return res.json({
      status: result.status,
      alreadyResolved: result.alreadyResolved,
      equipmentName: await equipmentDisplayNameFromRequest(result.request),
      action: result.request.action,
      domain: result.request.domain,
      resolvedAt: result.request.resolved_at || null,
      resolvedAtDisplay: formatResolvedAt(result.request.resolved_at),
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Request failed.' });
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
    if (review.status === 'approved') {
      return res.send(renderHtmlPage({
        title: 'Already approved',
        message: alreadyApprovedMessage(review.equipmentName, review.resolvedAt),
        tone: 'success',
      }));
    }
    if (review.status === 'rejected' || review.status === 'needs_modification') {
      return res.send(renderHtmlPage({
        title: 'Already processed',
        message: alreadyRejectedMessage(review.equipmentName, review.resolvedAt),
        tone: 'warning',
      }));
    }
    if (review.status === 'pending' || review.status === 'resubmitted') {
      const openId = review.request?.id;
      const qs = new URLSearchParams({ token });
      if (openId) qs.set('open', String(openId));
      return res.redirect(302, `/api/maintenance-approval/inbox?${qs.toString()}`);
    }
    return res.status(409).send(renderHtmlPage({
      title: 'Unable to review',
      message: `This request was already ${review.status}.`,
      tone: 'error',
    }));
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).send(renderHtmlPage({
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
      id: review.request?.id || null,
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
      createdAtLabel: formatEntryCreatedAt(review.createdAt),
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
      seedToken: token,
      openId: Number.isFinite(openId) ? openId : null,
    }));
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).send(renderHtmlPage({
      title: 'Unable to load approvals',
      message: err.message || 'Something went wrong.',
      tone: 'error',
    }));
  }
};

const documentByToken = async (req, res) => {
  const token = String(req.query.token || '').trim();
  const source = String(req.query.source || 'stored').trim();
  const name = String(req.query.name || '').trim();
  const disposition = String(req.query.disposition || 'inline').trim() === 'attachment'
    ? 'attachment'
    : 'inline';
  if (!token) return res.status(400).json({ message: 'Token is required.' });
  try {
    const file = await getDocumentForReviewToken(token, source, name);
    const safeDownloadName = path.basename(file.displayName || name || 'document');
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${safeDownloadName.replace(/"/g, '')}"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=300');
    return fs.createReadStream(file.absPath).pipe(res);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Document unavailable.' });
  }
};

const bulkAcceptByTokenJson = async (req, res) => {
  const token = String(req.body?.token || req.query.token || '').trim();
  if (!token) return res.status(400).json({ message: 'Token is required.' });
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) {
    return res.status(400).json({ message: 'Select at least one item to approve.' });
  }
  try {
    const result = await bulkApproveByInboxToken(token, ids);
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Bulk approve failed.' });
  }
};

module.exports = {
  acceptByToken,
  rejectByToken,
  acceptByTokenJson,
  rejectByTokenJson,
  reviewByToken,
  reviewByTokenJson,
  inboxByToken,
  documentByToken,
  bulkAcceptByTokenJson,
};
