# Before / After — Brand CC shell (A1)

**Before:** `campaigns/[id]/page.js` opened with a breadcrumb + header, then an ad-hoc
yellow **"N things need you"** banner (a flat list of exception links), then a stat strip
and the hierarchy/tabs. A **fresh (draft/pending_wallet) campaign had no publish action** —
a dead end.

**After:** after the header, a **StageRail** (Fund & Publish → Roster → Contracts →
Production → Review → Payout, current stage lit from status + counts) and a state-driven
**PrimeBar** showing the one next step. A draft/pending_wallet campaign now shows
**"Fund wallet & publish"** → `campaignApi.publish(id)`; on `WALLET_INSUFFICIENT` it routes
to `/dashboard/wallet`. The existing hierarchy/tabs/sub-routes are unchanged below the rail
(strangler — A2–A5 fold review/contracts/sets/escrow/production into the stages).

## New / changed
- New co-located `CommandRail.js` (web IG-clean kit seed): `deriveCampaignStage` (pure) +
  `StageRail` + `PrimeBar`.
- `[id]/page.js`: import + `handlePublish` + `stageInfo` derivation; replaced the
  actionItems banner with `<StageRail>` + `<PrimeBar>`; removed the now-dead actionItems
  array (kept `appliedCount`, which feeds the stage derivation).

## Mockup → build fidelity
Mockup `04-preview/mockups/command-center.html`: stage strip + prime bar — **matches**. The
mockup's fuller hub (inline review queue, single money panel) is A2–A5; A1 is the rail +
prime bar only (additive).

## Verification status
- **`next build` — compiled successfully**, all 77 pages incl. `/dashboard/campaigns/[id]`.
  (brand-web has no jest/lint gate configured; the production build is the automated gate.)
- **Pending (web verify):** founder check on the deployed Vercel dashboard — open a fresh
  campaign (Fund & Publish appears) and an active one (rail + correct next step).
