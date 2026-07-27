# Workflow — A3 unify contract signing
## Actor
Brand with influencer-signed contracts pending counter-signature.
## Steps
1. Campaigns list shows the cross-campaign signature strip (N pending, total lock) — the
   lock total + per-row locks now come from the shared formula. Sign all (bulk) or tap a
   row → the campaign hub Contracts tab.
2. Hub Contracts tab shows each creator's pending contract + wallet-lock (shared formula)
   + counter-sign.
3. The influencers ContractModal's lock figures use the same shared formula.
## Success
- Wallet-lock shown identically everywhere (one formula); signing works from the strip
  (bulk) and the hub tab (per-campaign); no value drift.
## Failure/edge
- Bulk sign failure → error surfaced (unchanged).
