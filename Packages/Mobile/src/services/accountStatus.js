/**
 * accountStatus — the one place the phone remembers whether this account is approved.
 *
 * A pending brand or creator is inside the app now (spec §6.5), but may only use Home, Profile
 * and Wallet; the other tabs lock and raise the "under review" sheet. That lock needs the status
 * synchronously, at tab press and at navigator render — so it lives in a tiny in-memory store,
 * fed from wherever the status is actually read: OTP (the /me after verify), the pending home's
 * own /me, App.js on cold start (the stored user), and api.js on every successful GET /brands/me
 * or /influencers/me, so it stays current after a submit or an approval.
 *
 * Values: 'pending' | 'approved' | 'rejected' | 'suspended' | null (unknown — never lock on it).
 * Contract: features/registration-and-profile
 */
export const ACCOUNT_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];

let _status = null;
const _listeners = new Set();

export function getAccountStatus() { return _status; }

export function setAccountStatus(status) {
  const next = ACCOUNT_STATUSES.includes(status) ? status : null;
  if (next === _status) return;
  _status = next;
  for (const fn of [..._listeners]) {
    try { fn(next); } catch (_) { /* a listener must never break the caller */ }
  }
}

export function subscribeAccountStatus(fn) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

// True when the account may use the whole app. Unknown (null) counts as approved: a missing
// value must never lock a tab — the server gates for real, and the sheet shows its 403 words.
export function isAccountApproved(status = _status) {
  return status == null || status === 'approved';
}
