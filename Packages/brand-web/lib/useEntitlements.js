'use client';

/**
 * useEntitlements — post-A14 client-side hook for proactive feature
 * gating in brand-web pages.
 *
 * Consumes the existing GET /v1/brands/me/subscription endpoint
 * (subscription.controller.js:144), which already returns the brand's
 * effective entitlements map (including A14 per-brand overrides) via
 * entitlementsService.getEntitlementsPlain.
 *
 * Usage:
 *
 *   import useEntitlements from '../../lib/useEntitlements';
 *
 *   function MyCard() {
 *     const ent = useEntitlements();
 *     if (ent.has('multi_branch_support')) {
 *       return <AddBranchButton />;
 *     }
 *     return <UpgradeHint />;
 *   }
 *
 * Returns:
 *   { entitlements, tierKey, loading, error,
 *     has(featureKey), quotaFor(featureKey), configFor(featureKey) }
 *
 * Module-level 5-minute cache dedupes the network call across
 * components on the same page. Pass refresh=true to bypass the cache
 * (e.g., after an admin override change).
 */

import { useEffect, useState } from 'react';
import { brandApi } from './api';

const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache = null;
let _cacheT = 0;
let _inflight = null;

async function _fetchEntitlements({ refresh = false } = {}) {
  const now = Date.now();
  if (!refresh && _cache && (now - _cacheT) < CACHE_TTL_MS) return _cache;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const res = await brandApi.getMySubscription();
      if (!res || res.success === false) {
        throw new Error(res?.error?.message || 'Failed to load entitlements');
      }
      _cache  = {
        entitlements: res.data?.entitlements || {},
        tierKey:      res.data?.tier_key || null,
      };
      _cacheT = Date.now();
      return _cache;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

export function bustEntitlementsCache() {
  _cache  = null;
  _cacheT = 0;
}

export default function useEntitlements() {
  const [state, setState] = useState({
    entitlements: _cache?.entitlements || {},
    tierKey:      _cache?.tierKey || null,
    loading:      !_cache,
    error:        null,
  });

  useEffect(() => {
    let alive = true;
    _fetchEntitlements()
      .then((c) => { if (alive) setState({ entitlements: c.entitlements, tierKey: c.tierKey, loading: false, error: null }); })
      .catch((e) => { if (alive) setState((s) => ({ ...s, loading: false, error: e?.message || 'Failed to load entitlements' })); });
    return () => { alive = false; };
  }, []);

  function has(featureKey) {
    const f = state.entitlements?.[featureKey];
    return !!(f && f.included);
  }
  function quotaFor(featureKey) {
    const f = state.entitlements?.[featureKey];
    return f && f.quota_value != null ? f.quota_value : null;
  }
  function configFor(featureKey) {
    const f = state.entitlements?.[featureKey];
    return f && f.config ? f.config : {};
  }

  return {
    entitlements: state.entitlements,
    tierKey:      state.tierKey,
    loading:      state.loading,
    error:        state.error,
    has,
    quotaFor,
    configFor,
  };
}
