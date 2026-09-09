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

function formatDigestCreatedAt(value) {
  if (!value) return '—';
  const d = new Date(value);
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

function inboxUrl(acceptToken, openId) {
  let url = `${publicBase}/api/maintenance-approval/inbox?token=${encodeURIComponent(acceptToken)}`;
  if (openId != null && openId !== '') {
    url += `&open=${encodeURIComponent(openId)}`;
  }
  return url;
}

function digestEntriesHtml(entries = []) {
  const rows = entries.map((entry, index) => {
    const url = inboxUrl(entry.acceptToken, entry.id);
    const submitter = entry.submitterEmail
      ? `${entry.submitterName} (${entry.submitterEmail})`
      : entry.submitterName;
    const createdAt = formatDigestCreatedAt(entry.createdAt);
    return `
      <tr>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">${index + 1}</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;color:#0f172a;word-break:break-word;max-width:220px;">${escapeHtml(entry.equipmentName)}</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#475569;word-break:break-word;min-width:280px;">${escapeHtml(entry.equipmentPath || '—')}</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(entry.actionLabel)}</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#475569;white-space:nowrap;">${escapeHtml(createdAt)}</td>
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
          <th style="padding:10px 12px;border:1px solid #1e40af;text-align:left;">Path</th>
          <th style="padding:10px 12px;border:1px solid #1e40af;text-align:left;">Action</th>
          <th style="padding:10px 12px;border:1px solid #1e40af;text-align:left;">Created at</th>
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
  previousCount = 0,
  newTodayCount = 0,
  totalCount,
  mode = 'all',
}) {
  const count = totalCount != null ? totalCount : entries.length;
  const seedToken = entries[0]?.acceptToken;
  const inboxLink = seedToken ? inboxUrl(seedToken) : '';
  const modeNote = mode === 'new'
    ? 'This email lists only items that were not included in a previous digest.'
    : 'This email lists all currently pending items (including carry-forward).';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 1100px; width: 100%; margin: auto;">
      ${emailLogoBlockHtml(logoUrl, { width: 64, withTagline: false })}
      <h2 style="color:#2563eb;text-align:center;margin:0;">Action Required: ${count} Maintenance Change${count === 1 ? '' : 's'} Awaiting Approval</h2>
      <p style="text-align:center;color:#64748b;font-size:14px;margin:4px 0 0;">
        ${escapeHtml(domainLabel)} · ${escapeHtml(digestDate)} (IST)
      </p>
      <p style="margin:20px 0 8px;">Hi <strong>${escapeHtml(hodName || 'HOD')}</strong>,</p>
      <table style="border-collapse:collapse;margin:12px 0;font-size:14px;width:100%;">
        <tr>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;background:#fff7ed;">Previous Pending</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:700;">${Number(previousCount)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;background:#ecfdf5;">New Today</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:700;">${Number(newTodayCount)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;background:#eff6ff;">In this email</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:700;">${count}</td>
        </tr>
      </table>
      <p style="margin:0 0 8px;color:#334155;font-size:14px;">
        Open the approvals inbox — <strong>no DigiLog login required</strong>. Review each row in a modal, then Accept or send for modification.
        ${escapeHtml(modeNote)}
      </p>
      ${inboxLink ? `
      <p style="text-align:center;margin:20px 0 8px;">
        <a href="${inboxLink}"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;font-size:14px;">
          OPEN APPROVALS INBOX (NO LOGIN)
        </a>
      </p>` : ''}
      <p style="text-align:center;font-size:12px;color:#64748b;margin:0 0 16px;">
        Per-row Review links open the same inbox and highlight that item.
      </p>
      ${digestEntriesHtml(entries)}
      <p style="font-size:12px;color:#64748b;margin-top:20px;">
        Links expire after 7 days and are refreshed on each digest. Missed this mail? Ask an admin to resend the digest from DigiLog settings.
      </p>
      <p style="color:#6b7280;font-size:12px;">This is an automated message from DigiLog.</p>
    </div>
  `;

  await sendMail({
    to,
    subject: `[DigiLog] ${count} maintenance change${count === 1 ? '' : 's'} awaiting approval — ${domainLabel}`,
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
  equipmentPath,
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
        <tr><td style="padding:6px;font-weight:bold;vertical-align:top;">Equipment</td><td style="padding:6px;word-break:break-word;">${escapeHtml(equipmentName)}</td></tr>
        <tr><td style="padding:6px;font-weight:bold;vertical-align:top;">Path</td><td style="padding:6px;word-break:break-word;">${escapeHtml(equipmentPath || '—')}</td></tr>
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

async function sendMaintenanceHistoryModificationEmail({
  to,
  submitterName,
  domainLabel,
  equipmentName,
  actionLabel,
  comment,
  openUrl,
}) {
  // Prefer deep link (same as in-app View / Edit). Fallback: login with next= deep path.
  const trimmedOpen = String(openUrl || '').trim();
  let ctaUrl = trimmedOpen || loginUrl;
  if (!trimmedOpen && publicBase) {
    ctaUrl = `${publicBase}/?login=1`;
  }
  const safeCta = escapeHtml(ctaUrl);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      ${emailLogoBlockHtml(logoUrl, { width: 64, withTagline: false })}
      <h2 style="color:#d97706;text-align:center;">Sent back for modification</h2>
      <p>Hi <strong>${escapeHtml(submitterName)}</strong>,</p>
      <p>
        Your maintenance history entry (${escapeHtml(actionLabel.toLowerCase())}) for
        <strong>${escapeHtml(equipmentName)}</strong> in ${escapeHtml(domainLabel)} was
        <strong>sent back for modification</strong>. The approved record was not changed.
      </p>
      ${comment ? `<p style="background:#fffbeb;border:1px solid #fde68a;padding:12px;border-radius:8px;color:#92400e;">
        <strong>HOD comment:</strong><br/>${escapeHtml(comment)}
      </p>` : ''}
      <p>Open DigiLog to go to that entry, edit it, and resubmit for HOD review.</p>
      <p style="text-align:center;margin:20px 0;">
        <a href="${safeCta}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Open DigiLog
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;">Or copy this link: <a href="${safeCta}" style="color:#2563eb;">${safeCta}</a></p>
      <p style="color:#6b7280;font-size:12px;">This is an automated message. Do not reply.</p>
    </div>
  `;

  await sendMail({
    to,
    subject: `[DigiLog] Maintenance history needs modification — ${equipmentName}`,
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
  sendMaintenanceHistoryModificationEmail,
};
