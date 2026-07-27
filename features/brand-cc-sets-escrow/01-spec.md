# Feature Spec — Brand CC: fold Sets + Escrow into the hub (A4)

> Step 2. Fourth brand-web CC contract. Brings the money/payout view and the sets
> rollup into the campaign hub; retires the two standalone routes.

## Problem / goal
Two campaign concerns live on separate pages you must click away to: `/escrow` (the
money — tranches locked/released/queued, on a scoped-CSS styling outlier) and `/sets`
(a read-only set rollup). Fold the money into a hub **Payout** tab (one honest money
view) and retire both routes to redirects, so everything about a campaign lives on the
campaign screen.

## Scope
**In scope**
- New `PayoutSection.js` — the escrow/tranche ledger as an IG-clean hub section
  (summary: total/locked/released/queued + per-influencer tranche breakdown; commission-
  only + empty states). Self-fetches the rich shape via `brandApi.getCampaignEscrow`.
- Hub: add a **Payout** tab rendering `<PayoutSection>`; generalize the `?tab=` deep-link
  to accept `payout`; the header-strip escrow "detail ↗" → opens the Payout tab (was a
  Link to /escrow); PrimeBar's completed-stage CTA → Payout tab (was href /escrow).
- Retire **/escrow** → redirect to `…/[id]?tab=payout`. Retire **/sets** → redirect to the
  hub (the Hierarchy already groups by set; set *creation* stays in campaigns/new). The
  hub's "create the first set" link → `campaigns/new?id=…` (was /sets).

**Out of scope**
- A5 (influencers page split + Production stage + ContractModal fold), B1 (listing). Backend.

## Surfaces touched
- App: brand-web only. Roles: brand.

## Data / contracts
- Endpoints: reuses `brandApi.getCampaignEscrow` (same call /escrow used). No new endpoint.

## Non-functional
- Money view unchanged numerically — just relocated into the hub; redirects keep old links alive.

## Design reference
`04-preview/mockups/command-center.html` — money/payout lives in the hub.
