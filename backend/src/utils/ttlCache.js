'use strict';

/**
 * ttlCache.js — a tiny in-process TTL memo cache for section-engine rule results.
 *
 * WHY NOT REDIS: the IMPLEMENTATION-PLAN assumed "Redis already in stack", but
 * verify-twice (2026-06-02) found NO redis/ioredis dependency and no client in
 * backend/src — Redis is not provisioned. Phase A (a foundation phase) must not
 * silently add unprovisioned prod infra. This in-process cache gives the same
 * short-TTL memoization behind a small interface (get/getOrSet/del/clear) so it
 * can be swapped for a Redis-backed implementation later WITHOUT touching the
 * rule library — when/if Redis is provisioned, replace this module's internals.
 *
 * Caveat (honest): per-process only — not shared across Render instances, and
 * cleared on restart. Acceptable for short-TTL discovery ranking; documented in
 * the contract impact. A hard cap + lazy expiry keep memory bounded.
 */

const DEFAULT_TTL_MS = 60 * 1000; // 60s — short, discovery data is allowed to lag slightly
const MAX_ENTRIES = 500;

const store = new Map(); // key -> { value, expires }

function _now() { return Date.now(); }

function _evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;
  // Drop the oldest-inserted entry (Map preserves insertion order).
  const oldest = store.keys().next().value;
  if (oldest !== undefined) store.delete(oldest);
}

function get(key) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expires <= _now()) { store.delete(key); return undefined; }
  return hit.value;
}

function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  store.set(key, { value, expires: _now() + ttlMs });
  _evictIfNeeded();
  return value;
}

/**
 * Return the cached value for `key`, or compute it via async `fn`, cache, return.
 * On compute error the error propagates (nothing is cached).
 */
async function getOrSet(key, fn, ttlMs = DEFAULT_TTL_MS) {
  const cached = get(key);
  if (cached !== undefined) return cached;
  const value = await fn();
  return set(key, value, ttlMs);
}

function del(key) { store.delete(key); }
function clear() { store.clear(); }

module.exports = { get, set, getOrSet, del, clear, DEFAULT_TTL_MS };
