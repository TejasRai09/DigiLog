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

const publicBase = String(CLIENT_ORIGIN || '').replace(/\/+$/, '');
const loginUrl = `${publicBase}/login`;
const logoUrl = APP_LOGO_URL || `${publicBase}/logo.png`;

const createTransporter = () =>
  nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   parseInt(SMTP_PORT, 10),
    secure: false, // STARTTLS
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: { ciphers: 'SSLv3' },
  });

const sendAccountActivationEmail = async ({ to, name, tempPassword }) => {
  const transporter = createTransporter();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <a href="${publicBase}" style="text-decoration:none; color: inherit;">
        <img src="${logoUrl}" alt="DigiLog" width="72" height="72"
             style="display:block; margin: 0 auto 16px; border:0;" />
      </a>
      <h2 style="color: #2563EB; text-align: center; margin: 0;">Welcome to DigiLog</h2>
      <p style="color:#4b5563; font-size:14px; margin-top:4px; text-align: center;">Your digital logbook</p>
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
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your account has been created and is now <strong>active</strong>.</p>
      <table style="border-collapse:collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; font-weight:bold;">Email:</td>
          <td style="padding: 8px;">${to}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight:bold;">Temporary Password:</td>
          <td style="padding: 8px;">${tempPassword}</td>
        </tr>
      </table>
      <p>Please log in and change your password immediately.</p>
      <p style="color:#6b7280; font-size:12px;">This is an automated message. Do not reply.</p>
    </div>
  `;

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: 'Your DigiLog Account is Active',
    html,
  });
};

module.exports = { sendAccountActivationEmail };
