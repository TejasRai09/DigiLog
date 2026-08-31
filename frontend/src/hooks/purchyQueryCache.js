import { useEffect, useRef, useState } from 'react';
import api from '../api/axios';

const TTL_MS = 120_000;
const store = new Map();
const inflight = new Map();

export function purchyCacheKey(params) {
  if (!params || typeof params !== 'object') return '{}';
  const out = {};
  Object.keys(params)
    .sort()
    .forEach((k) => {
      const v = params[k];
      if (v === undefined || v === null || v === '') return;
      out[k] = v;
    });
  return JSON.stringify(out);
}

export function getPurchyCached(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key);
    return undefined;
  }
  return hit.data;
}

export function setPurchyCached(key, data, aliasKeys = []) {
  const entry = { at: Date.now(), data };
  store.set(key, entry);
  aliasKeys.forEach((alias) => {
    if (alias && alias !== key) store.set(alias, entry);
  });
  if (store.size > 80) {
    const now = Date.now();
    for (const [k, v] of store) {
      if (now - v.at > TTL_MS) store.delete(k);
    }
  }
}

export function clearPurchyQueryCache() {
  store.clear();
  inflight.clear();
}

/**
 * GET with a 2-minute TTL cache. Cache hits skip the network and never flash a spinner.
 * When `enabled` is false the last data is kept (keep-alive tabs).
 */
export function usePurchyCachedGet(path, params, {
  enabled = true,
  mapResponse,
  initialData = null,
  errorMessage = 'Failed to load data.',
  aliasKeys,
} = {}) {
  const paramsKey = purchyCacheKey({ path, ...(params || {}) });
  const cachedOnInit = getPurchyCached(paramsKey);

  const [data, setData] = useState(() => (cachedOnInit !== undefined ? cachedOnInit : initialData));
  const [loading, setLoading] = useState(() => enabled && cachedOnInit === undefined);
  const [error, setError] = useState(null);

  const paramsRef = useRef(params);
  paramsRef.current = params;
  const mapRef = useRef(mapResponse);
  mapRef.current = mapResponse;
  const aliasRef = useRef(aliasKeys);
  aliasRef.current = aliasKeys;

  useEffect(() => {
    if (!enabled) return undefined;

    const cached = getPurchyCached(paramsKey);
    if (cached !== undefined) {
      setData(cached);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        let pending = inflight.get(paramsKey);
        if (!pending) {
          pending = api.get(path, { params: paramsRef.current }).then(({ data: res }) => {
            const next = mapRef.current ? mapRef.current(res) : res;
            const aliases = aliasRef.current
              ? aliasRef.current(next, paramsRef.current).map((p) => purchyCacheKey({ path, ...p }))
              : [];
            setPurchyCached(paramsKey, next, aliases);
            inflight.delete(paramsKey);
            return next;
          }).catch((err) => {
            inflight.delete(paramsKey);
            throw err;
          });
          inflight.set(paramsKey, pending);
        }
        const mapped = await pending;
        if (!cancelled) {
          setData(mapped);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || errorMessage);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [enabled, path, paramsKey, errorMessage]);

  return { data, loading, error };
}
