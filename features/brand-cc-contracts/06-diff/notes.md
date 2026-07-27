# Before / After — A3 unify contract signing

**Before:** the wallet-lock money formula `(fee+bonus)×(1+platformFeePct/100)` was
copy-pasted in **4 places** — campaigns-list `contractLockAmount` (page.js:339), hub
`contractLockAmount` ([id]/page.js:69), and the influencers `ContractModal` inline twice
(861, 934). Drift hazard on a funds-locking calc.

**After:** one shared `lib/contracts.js` (`walletLock` + `contractLockAmount`); all 4 sites
import it. Identical numeric result, now consistently paise-rounded. The signing *surfaces*
keep their correct roles: the campaigns-list strip is the cross-campaign inbox (bulk-sign +
deep-links to the hub Contracts tab); the hub Contracts tab is the canonical per-campaign
signing surface.

## Changed
- New `lib/contracts.js`.
- `campaigns/page.js`: deleted local `contractLockAmount`; import shared.
- `[id]/page.js` (hub): deleted local `contractLockAmount`; import shared.
- `[id]/influencers/page.js` (ContractModal): both `lockNeeded` computations → `walletLock(...)`.

## Verification
- **`next build` compiled clean** (77 pages).
- **Pending (web verify):** founder on Vercel — the strip's total lock matches the hub tab's
  per-contract lock matches the modal's lock (one formula).

## Known delta
- The influencers ContractModal (contract authoring + approve + sign + production) is not
  merged into the hub here — that fold is A5 (splitting the 1468-LOC influencers page). A3
  only single-sources the money math.
