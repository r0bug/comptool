/**
 * Simple in-memory cache with TTL. No external dependencies.
 */
const store = new Map();

/**
 * Get cached value or compute it.
 * @param {string} key - Cache key
 * @param {number} ttlMs - Time-to-live in milliseconds
 * @param {Function} fetchFn - Async function to compute the value
 */
async function get(key, ttlMs, fetchFn) {
  const entry = store.get(key);
  if (entry && Date.now() - entry.time < ttlMs) {
    return entry.data;
  }

  const data = await fetchFn();
  store.set(key, { data, time: Date.now() });

  // Prune old entries every 100 sets
  if (store.size > 200) {
    const now = Date.now();
    for (const [k, v] of store) {
      if (now - v.time > 600000) store.delete(k); // 10 min max
    }
  }

  return data;
}

function invalidate(keyPrefix) {
  for (const k of store.keys()) {
    if (k.startsWith(keyPrefix)) store.delete(k);
  }
}

function clear() {
  store.clear();
}

module.exports = { get, invalidate, clear };
