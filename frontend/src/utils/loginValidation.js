/** Practical email check (not exhaustive RFC). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function normalizeLoginEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

/**
 * Client-side checks before POST /auth/login.
 * @returns {{ ok: true, email: string } | { ok: false, message: string }}
 */
export function validateLoginForm(email, password) {
  const trimmedEmail = String(email ?? '').trim();
  const pwd = String(password ?? '');

  if (!trimmedEmail && !pwd) {
    return { ok: false, message: 'Please enter your email and password.' };
  }
  if (!trimmedEmail) {
    return { ok: false, message: 'Please enter your email address.' };
  }
  if (!pwd) {
    return { ok: false, message: 'Please enter your password.' };
  }
  if (!EMAIL_RE.test(trimmedEmail)) {
    return { ok: false, message: 'Please enter a valid email address.' };
  }
  if (pwd.length < 1) {
    return { ok: false, message: 'Please enter your password.' };
  }

  return { ok: true, email: normalizeLoginEmail(trimmedEmail) };
}

/** Map API / network errors to user-facing login messages. */
export function getLoginErrorMessage(err, fallback = 'Sign-in failed. Please try again.') {
  if (!err) return fallback;

  const status = err.response?.status;
  const serverMsg = err.response?.data?.message;

  if (typeof serverMsg === 'string' && serverMsg.trim()) {
    return serverMsg.trim();
  }

  if (!err.response) {
    return 'Cannot reach the server. Check your connection and try again.';
  }

  if (status === 401) return 'Invalid email or password.';
  if (status === 403) return 'Your account is deactivated. Contact your administrator.';
  if (status === 400) return 'Please check your email and password.';
  if (status === 429) return 'Too many login attempts. Please wait and try again.';
  if (status >= 500) return 'Server error. Please try again in a moment.';

  return fallback;
}
