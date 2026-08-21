import { useEffect, useState } from 'react';
import api from '../api/axios';

const CACHE_KEY = 'app_constants_cache';
const DEFAULTS = {
  theoreticalYield: 64.4,
  powerTariffRate: 4.85,
};

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}

/**
 * Returns configurable business constants from portal_settings.
 * Falls back to hardcoded defaults if the API call fails or returns invalid values.
 * Result is session-cached so it is only fetched once per browser session.
 */
export default function useAppConstants() {
  const cached = readCache();
  const [constants, setConstants] = useState(cached ?? DEFAULTS);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cached) return; // already have fresh session data
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/bi/settings');
        if (cancelled) return;
        const resolved = {
          theoreticalYield:
            typeof data?.theoreticalYield === 'number' && data.theoreticalYield > 0
              ? data.theoreticalYield
              : DEFAULTS.theoreticalYield,
          powerTariffRate:
            typeof data?.powerTariffRate === 'number' && data.powerTariffRate > 0
              ? data.powerTariffRate
              : DEFAULTS.powerTariffRate,
        };
        writeCache(resolved);
        setConstants(resolved);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load app constants.');
        // keep DEFAULTS already set in useState initialiser
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...constants, loading, error };
}
