/**
 * homeCount — the number on the Home tab, and the bell's (item 19, H6).
 *
 * The count is "things that need you": the length of the Needs-you list, which only the server
 * can work out. It has to be visible from every tab, so it lives in a tiny in-memory store (the
 * same shape as accountStatus) fed by whoever reads it: Home itself on every load, and
 * `refreshHomeCount` — called when the app comes to the front and when a tab is pressed, at most
 * once every THROTTLE_MS so walking the tabs does not re-run the read each time.
 *
 * A failed read changes nothing: a stale number is better than a tab that flickers to zero.
 * Contract: features/item19-home
 */
import { brandApi, influencerApi } from './api';
import { isAccountApproved } from './accountStatus';

export const THROTTLE_MS = 30000;

let _count = { needs: 0, unread: 0 };
let _last = 0;
let _inFlight = false;
const _listeners = new Set();

export function getHomeCount() { return _count; }

export function setHomeCount(next) {
  const needs = Math.max(0, Number(next && next.needs) || 0);
  const unread = Math.max(0, Number(next && next.unread) || 0);
  _last = Date.now();
  if (needs === _count.needs && unread === _count.unread) return;
  _count = { needs, unread };
  for (const fn of [..._listeners]) {
    try { fn(_count); } catch (_) { /* a listener must never break the caller */ }
  }
}

export function subscribeHomeCount(fn) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

/** Ask the server for the count. `side` is 'brand' or 'creator'. `force` skips the throttle. */
export async function refreshHomeCount(side, { force = false } = {}) {
  // An account still under review has no Home list, and its read would raise the "not approved
  // yet" sheet nowhere near what the person tapped.
  if (!isAccountApproved()) return;
  if (_inFlight) return;
  if (!force && Date.now() - _last < THROTTLE_MS) return;
  _inFlight = true;
  try {
    const r = await (side === 'creator' ? influencerApi : brandApi).getHomeCount();
    if (r && r.success && r.data) setHomeCount(r.data);
  } catch (_) {
    // keep the last number
  } finally {
    _inFlight = false;
  }
}

/** Tests only. */
export function _resetHomeCount() { _count = { needs: 0, unread: 0 }; _last = 0; _inFlight = false; _listeners.clear(); }
