import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rememberPostLoginRedirect } from '../utils/postLoginRedirect';

/**
 * When URL contains `?login=1`, open the login modal and strip the param.
 * Optional `next` (same-origin path) is saved for post-login navigation —
 * used by email deep links that land on login first.
 */
export function useOpenLoginFromQuery(setLoginOpen) {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const next = String(searchParams.get('next') || '').trim();
    if (next.startsWith('/') && !next.startsWith('//')) {
      rememberPostLoginRedirect(next);
    }

    if (searchParams.get('login') !== '1') return;
    setLoginOpen(true);
    const updated = new URLSearchParams(searchParams);
    updated.delete('login');
    updated.delete('next');
    setSearchParams(updated, { replace: true });
  }, [searchParams, setSearchParams, setLoginOpen]);
}
