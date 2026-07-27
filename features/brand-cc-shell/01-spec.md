# Feature Spec — Brand Campaign Command Center: shell + stage rail (A1)

> Step 2. First brand-web contract. Establishes the web IG-clean kit seed and
> the staged hub; adds the missing Fund & Publish action. Frontend-only.

## Problem / goal
A created campaign's detail page (`campaigns/[id]/page.js`, 1051 LOC + 5 sub-routes)
has no linear spine and **no Fund & Publish button** — a fresh campaign is a dead end.
Add a **stage rail** (Fund & Publish → Roster → Contracts → Production → Review → Payout)
driven by campaign status + the counts the page already derives, and a **state-driven
primary action bar** that always surfaces the next step (incl. the missing Fund & Publish).

## Scope
**In scope**
- New co-located `CommandRail.js` (the web IG-clean kit seed): `StageRail` + `PrimeBar`
  components (white / black / hairline; yellow = current/attention), reused by A2–A5.
- Inject the rail + prime bar into `[id]/page.js` right after the header, replacing the
  ad-hoc "needs you" banner. Derive current stage + prime CTA from `campaign.status` +
  existing counts (appliedCount, pendingContracts, reviewQueue, liveConfirmQueue, escrow).
- **Fund & Publish**: for `draft`/`pending_wallet`, prime CTA = "Fund wallet & publish" →
  `campaignApi.publish(id)`; on `WALLET_INSUFFICIENT` → route to `/dashboard/wallet`.
- Keep the existing body (hierarchy tree, tabs, sub-route links) BELOW the rail
  (strangler); A2–A5 fold review/contracts/sets/escrow/production into the stages.

**Explicitly out of scope (A2–A5)**
- Consolidating the /reviews, /sets, /escrow routes; unifying contract signing; splitting
  the 1468-LOC influencers page. Those are later contracts.
- Any backend/DB change (publish + wallet endpoints already exist).

## Surfaces touched
- App: **brand-web only** (Next.js/Vercel). No mobile, no backend.
- Roles: brand.

## Data / contracts
- Endpoints: reuses `campaignApi.publish(id)` + `walletApi` (existing). No new endpoint.
- Status machine: draft → pending_wallet → published → active → live → completed.

## Non-functional
- Additive change — the existing page keeps working; new rail sits on top.
- Publish failure (WALLET_INSUFFICIENT / other) → clear message, route to wallet; no
  optimistic corruption.

## Design reference
`04-preview/mockups/command-center.html` — the staged rail + prime bar (web frame).
