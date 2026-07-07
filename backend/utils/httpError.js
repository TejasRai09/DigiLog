const { NODE_ENV } = require('../config/env');

/** Safe, user-facing messages — never expose err.message or SQL details. */
const MSG = {
  SERVER: 'Something went wrong. Please try again.',
  DATABASE: 'We could not complete that request. Please try again.',
  UPLOAD: 'Upload failed. Please check the file and try again.',
  SAVE: 'Could not save your changes. Please try again.',
  LOAD: 'Could not load data. Please try again.',
  DELETE: 'Could not delete. Please try again.',
  MAPPING_SAVE: 'Failed to save mapping. Please try again.',
  MAPPING_DELETE: 'Failed to remove mapping. Please try again.',
};

const SAFE_CLIENT_PATTERNS = [
  /^Only PNG and JPEG/i,
  /^Only CSV and Excel/i,
  /^Image is too large/i,
  /^File is too large/i,
  /^Original image is too large/i,
  /^Please choose/i,
  /^No file uploaded/i,
  /^Invalid upload/i,
  /^Category name must/i,
];

function logServerError(label, err) {
  if (err?.stack) console.error(`[${label}]`, err.stack);
  else console.error(`[${label}]`, err);
}

/** Map known MySQL errors to safe HTTP responses. */
function mapDbError(err) {
  const code = err?.code;
  if (!code) return null;

  switch (code) {
    case 'ER_DUP_ENTRY':
      return { status: 409, message: 'A record with the same key already exists.' };
    case 'ER_NO_REFERENCED_ROW_2':
      return { status: 400, message: 'A linked record was not found.' };
    case 'ER_ROW_IS_REFERENCED_2':
      return { status: 400, message: 'This item is linked to other records and cannot be removed.' };
    case 'ER_LOCK_DEADLOCK':
      return { status: 503, message: 'The request conflicted with another update. Please try again.' };
    default:
      return null;
  }
}

/**
 * Log the real error server-side; respond with a safe message (and mapped status if known).
 * @returns {import('express').Response}
 */
function sendServerError(res, logLabel, err, userMessage = MSG.SERVER) {
  logServerError(logLabel, err);
  const mapped = mapDbError(err);
  if (mapped) {
    return res.status(mapped.status).json({ message: mapped.message });
  }
  return res.status(500).json({ message: userMessage });
}

/** Use for validation/upload errors where the message is authored by this app. */
function clientErrorMessage(err, fallback = MSG.UPLOAD) {
  const msg = typeof err?.message === 'string' ? err.message.trim() : '';
  if (!msg) return fallback;
  if (SAFE_CLIENT_PATTERNS.some((re) => re.test(msg))) return msg;
  if (NODE_ENV === 'development' && msg.length < 120 && !/sql|syntax|column|table|errno/i.test(msg)) {
    return msg;
  }
  return fallback;
}

function globalErrorMessage(err) {
  if (NODE_ENV === 'development' && err?.message && !/sql|syntax|column|table|errno/i.test(err.message)) {
    return err.message;
  }
  return MSG.SERVER;
}

module.exports = {
  MSG,
  logServerError,
  mapDbError,
  sendServerError,
  clientErrorMessage,
  globalErrorMessage,
};
