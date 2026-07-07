require('dotenv').config();

const {
  resolveDatabaseName,
  resolveDatabaseUrl,
} = require('./databaseName');

const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = (process.env.JWT_SECRET || '').trim();
const MIN_JWT_SECRET_LEN = 32;

if (!JWT_SECRET || JWT_SECRET.length < MIN_JWT_SECRET_LEN) {
  const msg =
    `JWT_SECRET must be set and at least ${MIN_JWT_SECRET_LEN} characters (see .env.example).`;
  if (NODE_ENV === 'production') {
    console.error(`FATAL: ${msg}`);
    process.exit(1);
  }
  console.error(`FATAL: ${msg}`);
  process.exit(1);
}

module.exports = {
  // Server
  PORT:     process.env.PORT     || '5000',
  NODE_ENV,

  // MySQL – name from MYSQL_DATABASE or DATABASE_URL; URL normalized to match
  MYSQL_HOST:     process.env.MYSQL_HOST     || 'localhost',
  MYSQL_PORT:     process.env.MYSQL_PORT     || '3306',
  MYSQL_USER:     process.env.MYSQL_USER     || 'root',
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ?? '',
  MYSQL_DATABASE: resolveDatabaseName(),
  DATABASE_NAME:  resolveDatabaseName(),
  DATABASE_URL:   resolveDatabaseUrl(),

  // JWT
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // SMTP / Nodemailer
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT || '587',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '',

  // Google OAuth (Sign in with Google)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',

  // CORS & public links (emails)
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  /** Optional absolute logo URL for HTML emails; if empty, CLIENT_ORIGIN + /logo.png */
  APP_LOGO_URL: (process.env.APP_LOGO_URL || '').trim(),

  /** Max bytes for Data Upload CSV/Excel (default 25 MB). */
  DATA_UPLOAD_MAX_BYTES: parseInt(process.env.DATA_UPLOAD_MAX_BYTES || '26214400', 10) || 26214400,

  // MySQL connection pool tuning (keep DB_POOL_LIMIT below MySQL's max_connections)
  DB_POOL_LIMIT:       parseInt(process.env.DB_POOL_LIMIT       || '30',    10) || 30,
  DB_POOL_QUEUE_LIMIT: parseInt(process.env.DB_POOL_QUEUE_LIMIT || '100',   10) || 100,
  DB_CONNECT_TIMEOUT:  parseInt(process.env.DB_CONNECT_TIMEOUT  || '10000', 10) || 10000,
};
