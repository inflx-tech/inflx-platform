# Feature Spec — Brand Dashboard Tab Merges (E-1 / E-2 / E-3)

> Consolidate the brand dashboard nav from 11 → 8 tabs by folding 3 tab-pairs.
> Structure approved in-session by founder ("Proceed as planned"). Frontend-only.

## Problem / goal
The brand dashboard had too many top-level tabs with overlapping purpose. Merge related
ones so the workspace is cleaner and things live where the brand expects them.

## Scope
- E-1: fold Contracts into Campaigns (signature strip on the campaigns list + a Contracts
  view inside each campaign with statuses).
- E-2: fold Proposals into Influencers (Discover / Proposals sub-tabs).
- E-3: fold Offers into Listings (Products / Offers sub-tabs).
- Old routes redirect to their new homes.
- Out of scope: E-4 gallery organize (separate); a per-product "offers on this product" view
  and an exact contract↔creator id link (follow-ups).

## Surfaces touched
- brand-web dashboard only (8 files). No backend, no migration, no mobile.

## Data / contracts
- No schema change, no new endpoint. Reuses existing: contractApi.listPending/bulkSign/brandSign;
  proposalApi.*; brandApi.getOffers/*; campaignApi.* .
- Contracts-in-campaign matches pending contracts to creators by Instagram handle (listPending
  lacks campaign_influencer_id) — safe (String-guarded); exact id-match is a noted follow-up.

## Non-functional
- Preserve ALL prior capability: bulk contract-sign + counter-sign, proposal accept/counter/reject
  + settings, offer library CRUD + publish-to-store, product catalogue, campaign hierarchy/analytics.
- Old bookmarks must not 404 (client redirects).
