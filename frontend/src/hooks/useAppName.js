import { useEffect, useState } from 'react';
import api from '../api/axios';
import { withoutGsmaLabel } from '../utils/displayLabels';

const cache = new Map();

/**
 * Resolve app display name for breadcrumbs (cached per app id).
 */
export function useAppName(appId) {
  const id = appId != null && appId !== '' ? String(appId) : null;
  const [name, setName] = useState(() => (id ? cache.get(id) : null) ?? null);

  useEffect(() => {
    if (!id) {
      setName(null);
      return undefined;
    }
    if (cache.has(id)) {
      setName(cache.get(id));
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: apps } = await api.get('/apps');
        const found = apps.find((a) => String(a._id) === id);
        if (cancelled || !found) return;
        const label = withoutGsmaLabel(found.name);
        cache.set(id, label);
        setName(label);
      } catch {
        /* breadcrumb falls back without app name */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return name;
}
