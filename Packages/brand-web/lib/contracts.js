/* Shared contract money math (features/brand-cc-contracts, A3).
   Single source of the wallet-lock formula a brand must hold to counter-sign,
   previously duplicated in the campaigns list, the hub Contracts tab, and the
   influencers ContractModal (twice). Rupees in, rupees out. */

/**
 * Item 7 (approval Q9): the server is the authority on what a deal costs, and
 * these helpers now read what it says rather than recomputing it.
 *
 * The old formula was `(fee + bonus) × (1 + platform_fee_pct/100)` for every
 * Aim. Since item 7 that is wrong in two ways: Hybrid carries no campaign fee
 * at all, and Pay for Sale locks nothing. A contract row that has been through
 * item 7 carries `locked_amount` (once signed) and `campaign_fee_amount`, and
 * its snapshot carries `money.totalToLock` — that is the number to show, so
 * the website and the phone can never quote different figures for one deal.
 */

/** Legacy fallback only, for a row with no snapshot: (fee + bonus) × (1 + pct/100). */
export function walletLock(fee, bonus, platformFeePct) {
  const base = parseFloat(fee || 0);
  const bon  = parseFloat(bonus || 0);
  const pct  = parseFloat(platformFeePct == null ? 8 : platformFeePct);
  return parseFloat(((base + bon) * (1 + pct / 100)).toFixed(2));
}

/**
 * What the brand must hold to countersign, taken from the server wherever it
 * has said so. Order: the amount already locked → the agreement's own snapshot
 * → the legacy formula.
 */
export function contractLockAmount(c = {}) {
  if (c.locked_amount != null) return parseFloat(c.locked_amount);
  const snap = typeof c.terms_json === 'string'
    ? (() => { try { return JSON.parse(c.terms_json); } catch { return null; } })()
    : c.terms_json;
  if (snap && snap.money && snap.money.totalToLock != null) return parseFloat(snap.money.totalToLock);
  return walletLock(c.influencer_fee, c.bonus_amount, c.platform_fee_pct == null ? 8 : c.platform_fee_pct);
}
