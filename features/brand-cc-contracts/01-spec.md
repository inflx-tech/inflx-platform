# Feature Spec — Brand CC: unify contract signing (A3)

> Step 2. Third brand-web CC contract. Removes the 4-way duplication of the
> wallet-lock money formula and clarifies the one-signing-surface model.

## Problem / goal
Contract counter-signing touches 3 surfaces — the campaigns-list **signature strip**
(cross-campaign bulk-sign + routes to the hub), the hub **Contracts tab** (per-campaign
sign), and the influencers **ContractModal** (per-creator authoring + sign). The
**wallet-lock money formula** `(fee+bonus)×(1+platformFeePct/100)` is copy-pasted in
**four** places (list, hub, modal ×2) — a drift hazard on a funds-locking calc.
Consolidate the formula to one shared source; keep the three surfaces in their correct
roles (inbox → routes into the per-campaign tab; modal is authoring, folded fully in A5).

## Scope
**In scope**
- New shared `lib/contracts.js`: `walletLock(fee,bonus,pct)` + `contractLockAmount(c)`.
- Replace the 4 duplicated formula sites with the shared helper:
  campaigns/page.js (strip), [id]/page.js (hub Contracts tab), influencers ContractModal
  (both `lockNeeded` computations).
- The list strip stays the cross-campaign inbox (bulk-sign + deep-link to hub Contracts
  tab); the hub Contracts tab stays the canonical per-campaign signing surface.

**Explicitly out of scope**
- Merging the influencers ContractModal into the hub (it is contract *authoring* +
  approve + production, not just sign) — folded when A5 splits the 1468-LOC influencers
  page.
- Backend (none).

## Surfaces touched
- App: brand-web only. Roles: brand.

## Data / contracts
- Endpoints unchanged (contractApi.brandSign / bulkSign already used). Pure money-math
  dedup — identical numeric result, now single-sourced + rounded to paise consistently.

## Non-functional
- Money-safety: one formula → no drift between list/hub/modal.

## Design reference
`04-preview/mockups/command-center.html` — signing in the hub; strip routes into it.
