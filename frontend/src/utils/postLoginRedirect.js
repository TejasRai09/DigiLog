/** sessionStorage key for where to go after DigiLog login modal succeeds. */
export const POST_LOGIN_REDIRECT_KEY = 'digilog_post_login_redirect';

/** Save a same-origin path (+ query) to return to after login. */
export function rememberPostLoginRedirect(pathWithSearch) {
  try {
    const value = String(pathWithSearch || '').trim();
    if (!value.startsWith('/') || value.startsWith('//')) return;
    if (value === '/' || value.startsWith('/?')) return;
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, value);
  } catch {
    // ignore
  }
}

/** Read and clear the saved post-login redirect (or null). */
export function consumePostLoginRedirect() {
  try {
    const value = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
    return value;
  } catch {
    return null;
  }
}
