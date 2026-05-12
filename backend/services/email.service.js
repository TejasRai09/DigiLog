const nodemailer = require('nodemailer');
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = require('../config/env');

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
      <h2 style="color: #2563EB;">Welcome to DigiLog</h2>
      <p style="color:#4b5563; font-size:14px; margin-top:4px;">Your digital logbook</p>
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
