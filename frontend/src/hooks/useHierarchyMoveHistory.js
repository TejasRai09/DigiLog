import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';

export default function useHierarchyMoveHistory(apiBase, { enabled = true } = {}) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!apiBase) return;
    setLoading(true);
    try {
      const { data } = await api.get(`${apiBase}/hierarchy/move-history`);
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`${apiBase}/hierarchy/move-history`);
        if (!cancelled) setEntries(Array.isArray(data?.entries) ? data.entries : []);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBase, enabled]);

  return { entries, loading, reload };
}
