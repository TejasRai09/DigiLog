const {
  approveByToken: approveRequestByToken,
  rejectByToken: rejectRequestByToken,
  getReviewByToken,
  getInboxByToken,
  actionLabel,
  DOMAIN_TABLES,
} = require('../services/maintenanceHistoryApproval.service');
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
    @media (max-width: 480px) { .brand-text { display: none; } }
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
      <p class="meta">Submitted by ${escapeHtml(review.submitterName)}${review.submitterEmail ? ` (${escapeHtml(review.submitterEmail)})` : ''}</p>
      ${expires ? `<p class="meta">This link expires on ${escapeHtml(expires)}.</p>` : ''}
      ${table}
      ${photoGridHtml('Before photos', review.photosBefore)}
      ${photoGridHtml('After photos', review.photosAfter)}
      <div class="actions">
        <a class="btn btn-accept" href="${escapeHtml(acceptUrl)}">Accept</a>
        <a class="btn btn-reject" href="${escapeHtml(rejectUrl)}">Send for modification</a>
      </div>
      <p class="hint">Accept saves this entry only. Other pending items are not changed.</p>
    </div>
  </main>
</body>
</html>`;
}

function renderInboxPage(inbox) {
  const entriesJson = JSON.stringify(
    (inbox.entries || []).map((entry) => ({
      id: entry.id,
      acceptToken: entry.acceptToken,
      rejectToken: entry.rejectToken,
      equipmentName: entry.equipmentName,
      actionLabel: entry.actionLabel,
      submitterName: entry.submitterName,
      submitterEmail: entry.submitterEmail,
    })),
  ).replace(/</g, '\\u003c');

  const rows = (inbox.entries || []).map((entry, index) => {
    const submitter = entry.submitterEmail
      ? `${entry.submitterName} (${entry.submitterEmail})`
      : entry.submitterName;
    return `
      <tr data-id="${Number(entry.id)}">
        <td class="num"></td>
        <td class="equip">${escapeHtml(entry.equipmentName)}</td>
        <td>${escapeHtml(entry.actionLabel)}</td>
        <td>${escapeHtml(submitter)}</td>
        <td class="act">
          <button type="button" class="link" data-review="${Number(entry.id)}">Review</button>
        </td>
      </tr>
    `;
  }).join('');

  const body = rows
    ? `<table class="grid" id="inbox-table">
        <thead>
          <tr>
            <th style="width:48px;">#</th>
            <th>Equipment</th>
            <th>Action</th>
            <th>Submitted by</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
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
    .page-body { max-width: 960px; margin: 0 auto; padding: 28px 16px 48px; }
    .card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:28px; box-shadow:0 4px 24px rgba(15,23,42,.06); overflow-x:auto; }
    h1 { font-size:22px; margin:0 0 8px; color:#0f172a; }
    .meta { color:#64748b; font-size:14px; line-height:1.6; margin:0 0 16px; }
    table.grid { width:100%; border-collapse:collapse; font-size:13px; }
    table.grid th { background:#1d4ed8; color:#fff; text-align:left; padding:10px 12px; border:1px solid #1e40af; }
    table.grid td { padding:10px 12px; border:1px solid #e2e8f0; vertical-align:middle; }
    table.grid tbody tr:nth-child(even) { background:#f8fafc; }
    td.equip { font-weight:700; color:#0f172a; }
    td.act { text-align:center; }
    button.link {
      background:none; border:0; padding:0; cursor:pointer;
      color:#2563eb; font-weight:700; font-size:13px; font-family:inherit;
    }
    button.link:hover { text-decoration:underline; }
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
    }
    .modal h2 { font-size:18px; margin:0 0 8px; color:#0f172a; }
    .modal .meta { margin:0 0 4px; }
    .modal-close {
      float:right; border:0; background:#f1f5f9; color:#334155; width:32px; height:32px;
      border-radius:8px; cursor:pointer; font-size:18px; line-height:1;
    }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:20px; }
    .btn { display:inline-block; border:0; cursor:pointer; text-decoration:none; font-weight:700;
      font-size:13px; padding:12px 20px; border-radius:8px; color:#fff; font-family:inherit; }
    .btn:disabled { opacity:.6; cursor:not-allowed; }
    .btn-accept { background:#059669; }
    .btn-reject { background:#dc2626; }
    .btn-ghost { background:#e2e8f0; color:#334155; }
    table.grid.fields { margin-top:12px; }
    table.grid.fields th { background:#1d4ed8; }
    .photos { margin-top:16px; }
    .photos p { margin:0 0 8px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; }
    .photos-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .photos-grid img { width:100%; height:88px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0; }
    .hint { margin-top:16px; font-size:12px; color:#94a3b8; }
    .modal-error { color:#dc2626; font-size:14px; margin:12px 0 0; }
  </style>
</head>
<body>
  ${headerHtml()}
  <main class="page-body">
    <div class="card">
      <h1>Pending maintenance approvals</h1>
      <p class="meta" id="inbox-meta"><strong>${escapeHtml(inbox.domainLabel)}</strong> · <span id="inbox-count">${inbox.entries.length}</span> item(s). Open Review to see every field before you decide.</p>
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
  <script>
    (function () {
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
      function renumber() {
        var nums = document.querySelectorAll('#inbox-table tbody tr td.num');
        nums.forEach(function (td, i) { td.textContent = String(i + 1); });
        var count = nums.length;
        var countEl = document.getElementById('inbox-count');
        if (countEl) countEl.textContent = String(count);
        if (!count) {
          var table = document.getElementById('inbox-table');
          if (table) {
            var empty = document.createElement('p');
            empty.className = 'empty';
            empty.id = 'inbox-empty';
            empty.textContent = 'There are no pending approvals right now.';
            table.parentNode.replaceChild(empty, table);
          }
        }
      }
      function photoBlock(label, srcs) {
        if (!srcs || !srcs.length) return '';
        return '<div class="photos"><p>' + esc(label) + '</p><div class="photos-grid">' +
          srcs.map(function (src) { return '<img src="' + esc(src) + '" alt="" />'; }).join('') +
          '</div></div>';
      }
      function closeModal() {
        backdrop.classList.remove('open');
        modalBody.innerHTML = '';
        busy = false;
      }
      function openModal() { backdrop.classList.add('open'); }

      function renderReview(data) {
        var rows = (data.diff || []).map(function (row) {
          return '<tr><td style="font-weight:600;width:32%;">' + esc(row.label) +
            '</td><td style="color:#64748b;white-space:pre-wrap;">' + esc(row.oldValue) +
            '</td><td style="white-space:pre-wrap;">' + esc(row.newValue) + '</td></tr>';
        }).join('');
        var table = rows
          ? '<table class="grid fields"><thead><tr><th>Field</th><th>Previous</th><th>New</th></tr></thead><tbody>' + rows + '</tbody></table>'
          : '<p class="meta">No field details available.</p>';
        var submitter = data.submitterName + (data.submitterEmail ? ' (' + data.submitterEmail + ')' : '');
        modalBody.innerHTML =
          '<h2 id="modal-title">Review maintenance history change</h2>' +
          '<p class="meta"><strong>' + esc(data.domainLabel || '') + '</strong> · ' + esc(data.actionLabel || '') + '</p>' +
          '<p class="meta">Equipment: <strong>' + esc(data.equipmentName) + '</strong></p>' +
          '<p class="meta">Submitted by ' + esc(submitter) + '</p>' +
          (data.tokenExpiresAtDisplay ? '<p class="meta">This link expires on ' + esc(data.tokenExpiresAtDisplay) + '.</p>' : '') +
          table +
          photoBlock('Before photos', data.photosBefore) +
          photoBlock('After photos', data.photosAfter) +
          '<div class="actions">' +
            '<button type="button" class="btn btn-accept" data-act="accept">Accept</button>' +
            '<button type="button" class="btn btn-reject" data-act="reject">Send for modification</button>' +
            '<button type="button" class="btn btn-ghost" data-act="close">Close</button>' +
          '</div>' +
          '<p class="hint">Accept saves this entry only. Other pending items are not changed.</p>';
        modalBody.querySelector('[data-act="accept"]').onclick = function () { decide('accept', data); };
        modalBody.querySelector('[data-act="reject"]').onclick = function () { decide('reject', data); };
        modalBody.querySelector('[data-act="close"]').onclick = closeModal;
      }

      async function postJson(path, token) {
        var res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ token: token })
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
          var data = await postJson('/api/maintenance-approval/review', entry.acceptToken);
          if (data.alreadyResolved || data.status !== 'pending') {
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
        busy = true;
        var acceptBtn = modalBody.querySelector('[data-act="accept"]');
        var rejectBtn = modalBody.querySelector('[data-act="reject"]');
        if (acceptBtn) acceptBtn.disabled = true;
        if (rejectBtn) rejectBtn.disabled = true;
        try {
          var path = kind === 'accept' ? '/api/maintenance-approval/accept' : '/api/maintenance-approval/reject';
          var token = kind === 'accept' ? data.acceptToken : data.rejectToken;
          var result = await postJson(path, token);
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
          if (acceptBtn) acceptBtn.disabled = false;
          if (rejectBtn) rejectBtn.disabled = false;
          showToast(err.message || 'Action failed.', 'err');
        }
      }

      document.querySelectorAll('[data-review]').forEach(function (btn) {
        btn.addEventListener('click', function (ev) {
          ev.preventDefault();
          openReview(btn.getAttribute('data-review'));
        });
      });
      document.getElementById('modal-close').onclick = closeModal;
      backdrop.addEventListener('click', function (ev) {
        if (ev.target === backdrop) closeModal();
      });
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
      });
      renumber();
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
    if (review.status === 'rejected') {
      return res.send(renderHtmlPage({
        title: 'Already processed',
        message: alreadyRejectedMessage(review.equipmentName, review.resolvedAt),
        tone: 'warning',
      }));
    }
    if (review.status !== 'pending') {
      return res.status(409).send(renderHtmlPage({
        title: 'Unable to review',
        message: `This request was already ${review.status}.`,
        tone: 'error',
      }));
    }
    return res.send(renderReviewPage(review));
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
      action: review.action,
      actionLabel: review.actionLabel,
      domain: review.domain,
      domainLabel: review.domainLabel,
      submitterName: review.submitterName,
      submitterEmail: review.submitterEmail,
      diff: review.diff,
      photosBefore: review.photosBefore,
      photosAfter: review.photosAfter,
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
    return res.send(renderInboxPage(inbox));
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).send(renderHtmlPage({
      title: 'Unable to load approvals',
      message: err.message || 'Something went wrong.',
      tone: 'error',
    }));
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
};
