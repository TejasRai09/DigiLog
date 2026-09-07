import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import useAuth from './useAuth';

const EMPTY = { sugar: false, power: false, production: false };

/**
 * Whether the signed-in user can edit/rename/delete locked equipment cards
 * (imported Sugar, built-in Power, extracted Production).
 * Requires an explicit domain grant — role alone (including admin) is not enough.
 */
export default function useLockedCardManageAccess() {
  const { user } = useAuth();
  const userKey = user?.id ?? user?._id;

  const [access, setAccess] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(() => Boolean(user));

  const refresh = useCallback(async () => {
    if (!user) {
      setAccess({ ...EMPTY });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/locked-card-manage-access/me');
      setAccess({
        sugar: Boolean(data?.sugar),
        power: Boolean(data?.power),
        production: Boolean(data?.production),
      });
    } catch {
      setAccess({ ...EMPTY });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [userKey, user?.role, refresh]);

  const canManage = (domain) => Boolean(access[domain]);
  const domainForApiBase = (apiBase) => {
    if (apiBase === '/sugar-new') return 'sugar';
    if (apiBase === '/power-new' || apiBase === '/power') return 'power';
    if (apiBase === '/production-house') return 'production';
    return null;
  };

  return {
    access,
    loading,
    refresh,
    canManage,
    canManageApiBase: (apiBase) => {
      const domain = domainForApiBase(apiBase);
      return domain ? canManage(domain) : false;
    },
  };
}
