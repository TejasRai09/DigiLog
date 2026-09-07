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
  if (!SMTP_HOST || !SMTP_FROM) {
    throw new Error('SMTP is not configured. Set SMTP_HOST and SMTP_FROM in backend/.env');
  }
  const transporter = createTransporter();
  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
  });
  console.log(`[email] sent "${subject}" to ${to}`);
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

function reviewUrl(acceptToken) {
  return `${publicBase}/api/maintenance-approval/review?token=${encodeURIComponent(acceptToken)}`;
}

function inboxUrl(acceptToken) {
  return `${publicBase}/api/maintenance-approval/inbox?token=${encodeURIComponent(acceptToken)}`;
}

function digestEntriesHtml(entries = []) {
  const rows = entries.map((entry, index) => {
    const url = reviewUrl(entry.acceptToken);
    const submitter = entry.submitterEmail
      ? `${entry.submitterName} (${entry.submitterEmail})`
      : entry.submitterName;
    return `
      <tr>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">${index + 1}</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;color:#0f172a;">${escapeHtml(entry.equipmentName)}</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(entry.actionLabel)}</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#475569;">${escapeHtml(submitter)}</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;">
          <a href="${url}" style="color:#2563eb;font-weight:700;text-decoration:none;">Review</a>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;font-size:13px;margin:16px 0;">
      <thead>
        <tr style="background:#1d4ed8;color:#fff;">
          <th style="padding:10px 12px;border:1px solid #1e40af;text-align:center;width:40px;">#</th>
          <th style="padding:10px 12px;border:1px solid #1e40af;text-align:left;">Equipment</th>
          <th style="padding:10px 12px;border:1px solid #1e40af;text-align:left;">Action</th>
          <th style="padding:10px 12px;border:1px solid #1e40af;text-align:left;">Submitted by</th>
          <th style="padding:10px 12px;border:1px solid #1e40af;text-align:center;">Details</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
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
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto;">
      ${emailLogoBlockHtml(logoUrl, { width: 64, withTagline: false })}
      <h2 style="color:#2563eb;text-align:center;margin:0;">Daily Maintenance History Digest</h2>
      <p style="text-align:center;color:#64748b;font-size:14px;margin:4px 0 0;">
        ${escapeHtml(domainLabel)} · ${escapeHtml(digestDate)} (IST)
      </p>
      <p style="margin:20px 0 8px;">Hi <strong>${escapeHtml(hodName || 'HOD')}</strong>,</p>
      <p style="margin:0 0 8px;color:#334155;font-size:14px;">
        ${count} maintenance history change${count === 1 ? '' : 's'} require your review.
        Open <strong>Review</strong> on a row to see every field before you accept or send back.
      </p>
      ${digestEntriesHtml(entries)}
      ${entries[0]?.acceptToken ? `
      <p style="text-align:center;margin:16px 0 0;">
        <a href="${inboxUrl(entries[0].acceptToken)}"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px;font-size:13px;">
          Open all approvals in browser
        </a>
      </p>` : ''}
      <p style="font-size:12px;color:#64748b;margin-top:20px;">
        No DigiLog login required. Review links expire after 7 days.
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
      <div style="text-align:center;margin:20px 0 8px;">
        <a href="${publicBase}/api/maintenance-approval/review?token=${encodeURIComponent(acceptToken)}"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Review details
        </a>
      </div>
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
