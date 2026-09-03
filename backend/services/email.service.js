const nodemailer = require('nodemailer');
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  CLIENT_ORIGIN,
  APP_LOGO_URL,
} = require('../config/env');
const { emailLogoBlockHtml } = require('../utils/digilogBrand');

const publicBase = String(CLIENT_ORIGIN || '').replace(/\/+$/, '');
const loginUrl = `${publicBase}/login`;
const logoUrl = APP_LOGO_URL || `${publicBase}/logo.png`;

const createTransporter = () =>
  nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: { ciphers: 'SSLv3' },
  });

async function sendMail({ to, subject, html }) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function diffTableHtml(diff) {
  if (!diff?.length) {
    return '<p style="color:#64748b;font-size:14px;">No field details available.</p>';
  }
  const rows = diff.map((row) => `
    <tr>
      <td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">${escapeHtml(row.label)}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(row.oldValue)}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(row.newValue)}</td>
    </tr>
  `).join('');
  return `
    <table style="border-collapse:collapse;width:100%;font-size:13px;margin:16px 0;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Field</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Previous</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">New</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function actionButtonsHtml(acceptToken, rejectToken) {
  const acceptUrl = `${publicBase}/api/maintenance-approval/accept?token=${encodeURIComponent(acceptToken)}`;
  const rejectUrl = `${publicBase}/api/maintenance-approval/reject?token=${encodeURIComponent(rejectToken)}`;
  return `
    <div style="text-align:center;margin:24px 0;">
      <a href="${acceptUrl}"
         style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;margin:0 8px 8px 0;">
        Accept
      </a>
      <a href="${rejectUrl}"
         style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;margin:0 0 8px 8px;">
        Send for Modification
      </a>
    </div>
    <p style="font-size:12px;color:#64748b;text-align:center;">
      One click approves or sends back — no DigiLog login required.
    </p>
  `;
}

const sendAccountActivationEmail = async ({ to, name, tempPassword }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      ${emailLogoBlockHtml(logoUrl, { width: 72, linkHref: publicBase, withTagline: true })}
      <h2 style="color: #2563EB; text-align: center; margin: 0;">Welcome to DigiLog</h2>
      <p style="text-align: center; margin: 20px 0;">
        <a href="${loginUrl}"
           style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none;
                  font-weight:600; padding:12px 24px; border-radius:8px;">
          Open DigiLog
        </a>
      </p>
      <p style="text-align:center; font-size:13px; color:#6b7280; margin-bottom:20px;">
        Or copy this link: <a href="${loginUrl}" style="color:#2563eb;">${loginUrl}</a>
      </p>
      <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
      <p>Your account has been created and is now <strong>active</strong>.</p>
      <table style="border-collapse:collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; font-weight:bold;">Email:</td>
          <td style="padding: 8px;">${escapeHtml(to)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight:bold;">Temporary Password:</td>
          <td style="padding: 8px;">${escapeHtml(tempPassword)}</td>
        </tr>
      </table>
      <p>Please log in and change your password immediately.</p>
      <p style="color:#6b7280; font-size:12px;">This is an automated message. Do not reply.</p>
    </div>
  `;

  await sendMail({
    to,
    subject: 'Your DigiLog Account is Active',
    html,
  });
};

function compactDiffSummaryHtml(diff, maxRows = 3) {
  if (!diff?.length) {
    return '<p style="color:#64748b;font-size:12px;margin:8px 0 0;">No field details available.</p>';
  }
  const shown = diff.slice(0, maxRows);
  const rows = shown.map((row) => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;font-size:12px;">${escapeHtml(row.label)}</td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:12px;">${escapeHtml(row.oldValue)} → ${escapeHtml(row.newValue)}</td>
    </tr>
  `).join('');
  const more = diff.length > maxRows
    ? `<p style="color:#64748b;font-size:11px;margin:6px 0 0;">+ ${diff.length - maxRows} more field(s)</p>`
    : '';
  return `
    <table style="border-collapse:collapse;width:100%;margin:8px 0 0;">
      <tbody>${rows}</tbody>
    </table>
    ${more}
  `;
}

function rowActionButtonsHtml(acceptToken, rejectToken) {
  const acceptUrl = `${publicBase}/api/maintenance-approval/accept?token=${encodeURIComponent(acceptToken)}`;
  const rejectUrl = `${publicBase}/api/maintenance-approval/reject?token=${encodeURIComponent(rejectToken)}`;
  return `
    <div style="margin-top:10px;">
      <a href="${acceptUrl}"
         style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:600;padding:8px 14px;border-radius:6px;margin:0 6px 6px 0;font-size:12px;">
        Accept
      </a>
      <a href="${rejectUrl}"
         style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;padding:8px 14px;border-radius:6px;margin:0 0 6px 0;font-size:12px;">
        Send for Modification
      </a>
    </div>
  `;
}

function digestEntriesHtml(entries = []) {
  return entries.map((entry, index) => `
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:16px 0;background:#f8fafc;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0f172a;">
        ${index + 1}. ${escapeHtml(entry.equipmentName)}
        <span style="color:#64748b;font-weight:600;"> — ${escapeHtml(entry.actionLabel)}</span>
      </p>
      <p style="margin:0;font-size:12px;color:#475569;">
        Submitted by <strong>${escapeHtml(entry.submitterName)}</strong>
        ${entry.submitterEmail ? `(${escapeHtml(entry.submitterEmail)})` : ''}
      </p>
      ${compactDiffSummaryHtml(entry.diff)}
      ${rowActionButtonsHtml(entry.acceptToken, entry.rejectToken)}
    </div>
  `).join('');
}

async function sendMaintenanceHistoryDigestEmail({
  to,
  hodName,
  domainLabel,
  digestDate,
  entries = [],
}) {
  const count = entries.length;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 720px; margin: auto;">
      ${emailLogoBlockHtml(logoUrl, { width: 64, withTagline: false })}
      <h2 style="color:#2563eb;text-align:center;margin:0;">Daily Maintenance History Digest</h2>
      <p style="text-align:center;color:#64748b;font-size:14px;margin:4px 0 0;">
        ${escapeHtml(domainLabel)} · ${escapeHtml(digestDate)} (IST)
      </p>
      <p style="margin:20px 0 8px;">Hi <strong>${escapeHtml(hodName || 'HOD')}</strong>,</p>
      <p style="margin:0 0 8px;color:#334155;font-size:14px;">
        ${count} maintenance history change${count === 1 ? '' : 's'} submitted today require your review.
        Approve or send back each entry individually using the buttons below.
      </p>
      ${digestEntriesHtml(entries)}
      <p style="font-size:12px;color:#64748b;margin-top:20px;">
        One click per entry — no DigiLog login required. Links expire after 7 days.
      </p>
      <p style="color:#6b7280;font-size:12px;">This is an automated message from DigiLog.</p>
    </div>
  `;

  await sendMail({
    to,
    subject: `[DigiLog] Daily maintenance digest (${count}) — ${domainLabel}`,
    html,
  });
}

async function sendMaintenanceHistoryApprovalEmail({
  to,
  hodName,
  submitterName,
  submitterEmail,
  domainLabel,
  equipmentName,
  actionLabel,
  diff,
  acceptToken,
  rejectToken,
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: auto;">
      ${emailLogoBlockHtml(logoUrl, { width: 64, withTagline: false })}
      <h2 style="color:#2563eb;text-align:center;margin:0;">Maintenance History Approval</h2>
      <p style="text-align:center;color:#64748b;font-size:14px;">${escapeHtml(domainLabel)}</p>
      <p>Hi <strong>${escapeHtml(hodName || 'HOD')}</strong>,</p>
      <p>
        <strong>${escapeHtml(submitterName)}</strong>
        (${escapeHtml(submitterEmail)}) submitted a maintenance history change for your review.
      </p>
      <table style="border-collapse:collapse;margin:12px 0;font-size:14px;">
        <tr><td style="padding:6px;font-weight:bold;">Equipment</td><td style="padding:6px;">${escapeHtml(equipmentName)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;">Action</td><td style="padding:6px;">${escapeHtml(actionLabel)}</td></tr>
      </table>
      ${diffTableHtml(diff)}
      ${actionButtonsHtml(acceptToken, rejectToken)}
      <p style="color:#6b7280;font-size:12px;">This is an automated message from DigiLog.</p>
    </div>
  `;

  await sendMail({
    to,
    subject: `[DigiLog] Maintenance history approval — ${equipmentName}`,
    html,
  });
}

async function sendMaintenanceHistoryRejectedEmail({
  to,
  submitterName,
  domainLabel,
  equipmentName,
  actionLabel,
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      ${emailLogoBlockHtml(logoUrl, { width: 64, withTagline: false })}
      <h2 style="color:#dc2626;text-align:center;">Entry Not Saved</h2>
      <p>Hi <strong>${escapeHtml(submitterName)}</strong>,</p>
      <p>
        Your maintenance history entry (${escapeHtml(actionLabel.toLowerCase())}) for
        <strong>${escapeHtml(equipmentName)}</strong> in ${escapeHtml(domainLabel)} was
        <strong>not saved in DigiLog</strong>.
      </p>
      <p>Please contact your HOD for modification or clarification.</p>
      <p style="text-align:center;margin:20px 0;">
        <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Open DigiLog
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;">This is an automated message. Do not reply.</p>
    </div>
  `;

  await sendMail({
    to,
    subject: `[DigiLog] Maintenance history not approved — ${equipmentName}`,
    html,
  });
}

async function sendMaintenanceHistoryApprovedEmail({
  to,
  submitterName,
  domainLabel,
  equipmentName,
  actionLabel,
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      ${emailLogoBlockHtml(logoUrl, { width: 64, withTagline: false })}
      <h2 style="color:#059669;text-align:center;">Entry Approved</h2>
      <p>Hi <strong>${escapeHtml(submitterName)}</strong>,</p>
      <p>
        Your maintenance history entry (${escapeHtml(actionLabel.toLowerCase())}) for
        <strong>${escapeHtml(equipmentName)}</strong> in ${escapeHtml(domainLabel)} has been
        <strong>approved and saved</strong> in DigiLog.
      </p>
      <p style="text-align:center;margin:20px 0;">
        <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Open DigiLog
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;">This is an automated message. Do not reply.</p>
    </div>
  `;

  await sendMail({
    to,
    subject: `[DigiLog] Maintenance history approved — ${equipmentName}`,
    html,
  });
}

module.exports = {
  sendMail,
  sendAccountActivationEmail,
  sendMaintenanceHistoryApprovalEmail,
  sendMaintenanceHistoryDigestEmail,
  sendMaintenanceHistoryRejectedEmail,
  sendMaintenanceHistoryApprovedEmail,
};
