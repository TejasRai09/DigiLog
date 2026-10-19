import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import useAuth from './useAuth';

export default function useHodApprovalAccess() {
  const { user } = useAuth();
  const [access, setAccess] = useState({
    sugar: false,
    power: false,
    production: false,
    forms: false,
    notes: false,
    enabled: false,
  });
  const [loading, setLoading] = useState(Boolean(user));

  const refresh = useCallback(async () => {
    if (!user) {
      setAccess({ sugar: false, power: false, production: false, forms: false, notes: false, enabled: false });
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/approvals/access');
      const sugar = Boolean(data.sugar);
      const power = Boolean(data.power);
      const production = Boolean(data.production);
      const forms = Boolean(data.forms);
      const notes = Boolean(data.notes);
      setAccess({
        sugar,
        power,
        production,
        forms,
        notes,
        enabled: Boolean(data.enabled || sugar || power || production || forms || notes),
      });
    } catch {
      setAccess({ sugar: false, power: false, production: false, forms: false, notes: false, enabled: false });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...access, loading, refresh };
}
