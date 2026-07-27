# Expected Outputs — Brand CC shell (A1)

## UI
- `[id]/page.js` renders `StageRail` + `PrimeBar` after the header, IG-clean; matches
  `04-preview/mockups/command-center.html`.

## Behaviour / logic
- `deriveCampaignStage(status, counts)` → { stageKey, prime:{label, action} } (pure,
  co-located; testable by reasoning — no web test harness). Fund&Publish for
  draft/pending_wallet; Contracts when pendingContracts>0; Review when queue>0; etc.
- Fund & Publish wired to `campaignApi.publish` with WALLET_INSUFFICIENT → wallet route.

## Tests / validation
- `next lint` clean (brand-web has no jest UI harness; compile + lint is the automated gate).
- **Founder verify on Vercel** (brand-web deploys on push) — the web equivalent of the
  mobile device-check.

## Non-regression
- Existing hierarchy/tabs/sub-routes still render and navigate (additive change).
