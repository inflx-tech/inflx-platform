/* Shared contract money math (features/brand-cc-contracts, A3).
   Single source of the wallet-lock formula a brand must hold to counter-sign,
   previously duplicated in the campaigns list, the hub Contracts tab, and the
   influencers ContractModal (twice). Rupees in, rupees out. */

/** (fee + bonus) × (1 + platformFeePct/100), rounded to paise. */
export function walletLock(fee, bonus, platformFeePct) {
  const base = parseFloat(fee || 0);
  const bon  = parseFloat(bonus || 0);
  const pct  = parseFloat(platformFeePct == null ? 8 : platformFeePct);
  return parseFloat(((base + bon) * (1 + pct / 100)).toFixed(2));
}

/** Object form for pending-contract rows ({ influencer_fee, bonus_amount, platform_fee_pct }). */
export function contractLockAmount(c = {}) {
  return walletLock(c.influencer_fee, c.bonus_amount, c.platform_fee_pct == null ? 8 : c.platform_fee_pct);
}
