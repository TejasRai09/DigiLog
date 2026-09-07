import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from './useAuth';
import { consumePostLoginRedirect } from '../utils/postLoginRedirect';

/** After SSO/manual login lands on a public page, continue to the saved deep link. */
export function usePostLoginRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    const redirect = consumePostLoginRedirect();
    if (redirect) navigate(redirect, { replace: true });
  }, [user, loading, navigate]);
}
