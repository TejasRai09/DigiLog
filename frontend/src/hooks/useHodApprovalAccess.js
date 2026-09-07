import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import useAuth from './useAuth';

export default function useHodApprovalAccess() {
  const { user } = useAuth();
  const [access, setAccess] = useState({ sugar: false, power: false, enabled: false });
  const [loading, setLoading] = useState(Boolean(user));

  const refresh = useCallback(async () => {
    if (!user) {
      setAccess({ sugar: false, power: false, enabled: false });
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/approvals/access');
      setAccess({
        sugar: Boolean(data.sugar),
        power: Boolean(data.power),
        enabled: Boolean(data.enabled || data.sugar || data.power),
      });
    } catch {
      setAccess({ sugar: false, power: false, enabled: false });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...access, loading, refresh };
}
