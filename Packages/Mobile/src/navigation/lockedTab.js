/**
 * lockedTab — the tab lock for an account that is not approved (spec §6.5, mockups B2/B2b).
 *
 * A pending brand may only use Home, Profile and Wallet; Campaigns and Creators are locked.
 * A pending creator likewise: Collabs and Create are locked. Locking is a `tabPress` listener
 * that swallows the press and raises the same sheet the server's 403 raises — with the server's
 * own words — so the phone and the API say one thing. The status comes from the accountStatus
 * store; unknown (null) is never locked.
 *
 * Both navigators use this one factory, so there is one lock, not two copies.
 * Contract: features/registration-and-profile
 */
import { getAccountStatus, isAccountApproved } from '../services/accountStatus';
import { emitAccountGate } from '../services/api';

// The words are the server's (backend/src/middleware/auth.js requireApproved, and the brand
// controller's suspended message) — the sheet must read the same on a tab press as on a 403.
export const GATE_EVENTS = {
  pending: { code: 'ACCOUNT_PENDING', message: 'Your account is under review by admin. This feature will be available once approved (usually within 24 hours).' },
  rejected: { code: 'ACCOUNT_REJECTED', message: 'Your account was not approved. Please update your profile and resubmit.' },
  suspended: { code: 'ACCOUNT_SUSPENDED', message: 'This account is suspended. Contact support.' },
};

export function gateEventFor(status) {
  return GATE_EVENTS[status] || GATE_EVENTS.pending;
}

// The listeners object for a locked `Tab.Screen`. Read the status at press time, not at mount:
// an approval that lands while the app is open unlocks the tab on the next press.
export function lockedTabListeners() {
  return {
    tabPress: (e) => {
      const status = getAccountStatus();
      if (isAccountApproved(status)) return;
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      emitAccountGate(gateEventFor(status));
    },
  };
}

// Which tab the app opens on: the usual one when approved (or unknown), Home otherwise — a
// pending account must never land on a locked tab's content.
export function initialTabFor(status, approvedTab) {
  return isAccountApproved(status) ? approvedTab : 'HomeTab';
}
