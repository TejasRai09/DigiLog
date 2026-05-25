import { useEffect, useState } from 'react';
import api from '../api/axios';
import useAuth from './useAuth';

/** Whether the signed-in user can see the Data Upload tab and page. */
export default function useDataUploadAccess() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(user?.role === 'admin');
  const [loading, setLoading] = useState(!!user);

  useEffect(() => {
    if (!user) {
      setEnabled(false);
      setLoading(false);
      return;
    }
    if (user.role === 'admin') {
      setEnabled(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api
      .get('/data-upload/access')
      .then(({ data }) => {
        if (!cancelled) setEnabled(!!data.enabled);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  return { enabled, loading };
}
