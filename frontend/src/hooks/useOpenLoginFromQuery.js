import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/** When URL contains `?login=1`, open the login modal and strip the param (no separate /login page). */
export function useOpenLoginFromQuery(setLoginOpen) {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('login') !== '1') return;
    setLoginOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('login');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, setLoginOpen]);
}
