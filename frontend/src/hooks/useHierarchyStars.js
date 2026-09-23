import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function useHierarchyStars(apiBase) {
  const [starredIds, setStarredIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`${apiBase}/hierarchy/stars`);
        if (cancelled) return;
        setStarredIds(new Set((data.nodeIds || []).map((id) => String(id))));
      } catch {
        if (!cancelled) setStarredIds(new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBase]);

  const isStarred = useCallback(
    (node) => starredIds.has(String(node?.dbId || node?.id)),
    [starredIds],
  );

  const toggleStar = useCallback(async (node) => {
    const id = Number(node?.dbId || node?.id);
    if (!id) return;
    const key = String(id);
    const wasStarred = starredIds.has(key);
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (wasStarred) next.delete(key);
      else next.add(key);
      return next;
    });
    try {
      if (wasStarred) {
        await api.delete(`${apiBase}/hierarchy/stars/${id}`);
      } else {
        await api.post(`${apiBase}/hierarchy/stars`, { nodeId: id });
      }
    } catch {
      setStarredIds((prev) => {
        const next = new Set(prev);
        if (wasStarred) next.add(key);
        else next.delete(key);
        return next;
      });
      toast.error('Could not update star.');
    }
  }, [apiBase, starredIds]);

  return { starredIds, isStarred, toggleStar, loading };
}
