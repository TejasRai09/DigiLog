require('dotenv').config();

module.exports = {
  // Server
  PORT:     process.env.PORT     || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // MySQL – single connection URL used by both the raw pool and Prisma
  DATABASE_URL: process.env.DATABASE_URL || '',

  // JWT
  JWT_SECRET:     process.env.JWT_SECRET     || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // SMTP / Nodemailer
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT || '587',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '',

  // CORS
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
