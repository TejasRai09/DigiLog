import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const CACHE_KEY = 'app_constants_cache';
export const APP_CONSTANT_DEFAULTS = {
  theoreticalYield: 64.4,
  powerTariffRate: 4.85,
  brixThreshold: 18,
};

function toYmd(iso) {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parsePositive(v, fallback) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeTriple(src, fallback = APP_CONSTANT_DEFAULTS) {
  return {
    theoreticalYield: parsePositive(src?.theoreticalYield, fallback.theoreticalYield),
    powerTariffRate: parsePositive(src?.powerTariffRate, fallback.powerTariffRate),
    brixThreshold: parsePositive(src?.brixThreshold, fallback.brixThreshold),
  };
}

/** Season whose dates contain iso, or null if unmapped. */
export function seasonLabelContainingDate(iso, seasonMapping = {}) {
  const d = toYmd(iso);
  if (!d) return null;
  const entries = Object.entries(seasonMapping || {})
    .map(([label, m]) => ({
      label,
      start: m?.startDate ? String(m.startDate).slice(0, 10) : null,
      end: m?.endDate ? String(m.endDate).slice(0, 10) : null,
    }))
    .filter((e) => e.start && e.end);
  const hit = entries.find((e) => d >= e.start && d <= e.end);
  return hit ? hit.label : null;
}

/**
 * Active sugar season for a dashboard window:
 * To date, else From, else today, else null (use global defaults).
 */
export function resolveActiveSeasonLabel({ to, from, seasonMapping, todayIso } = {}) {
  const mapping = seasonMapping || {};
  return (
    seasonLabelContainingDate(to, mapping)
    || seasonLabelContainingDate(from, mapping)
    || seasonLabelContainingDate(todayIso || todayYmd(), mapping)
    || null
  );
}

export function constantsForSeason(label, constantsBySeason = {}, defaults = APP_CONSTANT_DEFAULTS) {
  if (label && constantsBySeason && constantsBySeason[label]) {
    return normalizeTriple(constantsBySeason[label], defaults);
  }
  return normalizeTriple(defaults, APP_CONSTANT_DEFAULTS);
}

export function constantsForDate(iso, { seasonMapping, constantsBySeason, defaults } = {}) {
  const label = seasonLabelContainingDate(iso, seasonMapping);
  return constantsForSeason(label, constantsBySeason, defaults || APP_CONSTANT_DEFAULTS);
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.constantsBySeason !== 'object') {
      return null;
    }
    return parsed;
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
 * Configurable business constants from /bi/settings.
 * Per-season map is session-cached; callers look up by date or season label.
 */
export default function useAppConstants() {
  const cached = readCache();
  const [payload, setPayload] = useState(() => {
    if (cached) return cached;
    return {
      ...APP_CONSTANT_DEFAULTS,
      defaults: APP_CONSTANT_DEFAULTS,
      constantsBySeason: {},
      seasonMapping: {},
    };
  });
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/bi/settings');
        if (cancelled) return;
        const defaults = normalizeTriple(data?.defaults || data, APP_CONSTANT_DEFAULTS);
        const resolved = {
          ...normalizeTriple(data, defaults),
          defaults,
          constantsBySeason:
            data?.constantsBySeason && typeof data.constantsBySeason === 'object'
              ? data.constantsBySeason
              : {},
          seasonMapping:
            data?.seasonMapping && typeof data.seasonMapping === 'object'
              ? data.seasonMapping
              : {},
        };
        writeCache(resolved);
        setPayload(resolved);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load app constants.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const helpers = useMemo(() => ({
    constantsForSeason: (label) => constantsForSeason(
      label,
      payload.constantsBySeason,
      payload.defaults || APP_CONSTANT_DEFAULTS,
    ),
    constantsForDate: (iso) => constantsForDate(iso, {
      seasonMapping: payload.seasonMapping,
      constantsBySeason: payload.constantsBySeason,
      defaults: payload.defaults || APP_CONSTANT_DEFAULTS,
    }),
  }), [payload]);

  return {
    theoreticalYield: payload.theoreticalYield,
    powerTariffRate: payload.powerTariffRate,
    brixThreshold: payload.brixThreshold,
    defaults: payload.defaults || APP_CONSTANT_DEFAULTS,
    constantsBySeason: payload.constantsBySeason || {},
    seasonMapping: payload.seasonMapping || {},
    loading,
    error,
    ...helpers,
  };
}
