import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';

export function useSugarHouseHierarchy() {
  const [tree, setTree] = useState(null);
  const [source, setSource] = useState('empty');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/sugar-new/hierarchy');
      if (data.tree) {
        setTree(data.tree);
        setSource(data.source || 'database');
      } else {
        setTree(null);
        setSource('empty');
      }
    } catch (err) {
      setTree(null);
      setSource('empty');
      setError(err.response?.data?.message || 'Could not load hierarchy.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    tree,
    source,
    loading,
    error,
    reload,
    rootId: tree?.id ?? null,
  };
}

export default useSugarHouseHierarchy;
