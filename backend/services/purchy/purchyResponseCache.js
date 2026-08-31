/** In-memory cache for identical Purchy BI query responses. */
const CACHE_TTL_MS = 120_000;
const cache = new Map();
const inflight = new Map();

function normalizeQuery(query = {}) {
  const out = {};
  Object.keys(query)
    .sort()
    .forEach((k) => {
      const v = query[k];
      if (v === undefined || v === null || v === '') return;
      out[k] = v;
    });
  return out;
}

function makeKey(name, query) {
  return JSON.stringify({ name, q: normalizeQuery(query) });
}

function prune() {
  if (cache.size <= 80) return;
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.at > CACHE_TTL_MS) cache.delete(k);
  }
}

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.data;
}

async function withPurchyCache(name, query, fn) {
  const key = makeKey(name, query);
  const hit = getCached(key);
  if (hit !== undefined) return hit;
  if (inflight.has(key)) return inflight.get(key);

  const pending = Promise.resolve()
    .then(fn)
    .then((data) => {
      cache.set(key, { at: Date.now(), data });
      prune();
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, pending);
  return pending;
}

function clearPurchyCache() {
  cache.clear();
  inflight.clear();
}

module.exports = {
  withPurchyCache,
  clearPurchyCache,
};
