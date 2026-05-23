# Impact — Flow 6

## Verdict

**Zero functional / backend / logic / DB impact — visual + UX restructure only.**

Same data, same APIs, same handlers. New page surfaces. All values trace to backend fields verified-twice via campaign.controller.js:228-347 + 4 sibling endpoints.

## Files touched (4 web)

- `Packages/brand-web/app/dashboard/campaigns/[id]/page.js` — restructure 2435 → ~800 LOC hub
- `Packages/brand-web/app/dashboard/campaigns/[id]/influencers/page.js` — NEW
- `Packages/brand-web/app/dashboard/campaigns/[id]/sets/page.js` — NEW
- `Packages/brand-web/app/dashboard/campaigns/[id]/reviews/page.js` — NEW

## Files NOT touched

- `backend/**`
- `Packages/brand-web/lib/api.js` (all calls reused)
- `Packages/brand-web/app/dashboard/campaigns/[id]/escrow/page.js` (kept as-is for now — separate restyle pass if needed)
- Mobile (Flow 5 already shipped)
- All other web pages

## NO-TOUCH (preserved exactly)

- `campaignApi.get(id)` deep-join + getLive + getEngagement + getConversions + products endpoint
- `deliverableApi.{get, getMediaUrl, review, confirmLive, refreshStats}`
- `negotiationApi.{get, getByCampaignInfluencer, respond}`
- `contractApi.{get, brandSign, approve, regeneratePdf, getPdfUrl, retryCreate}`
- `productionApi.*` (all 10 methods used by ProductionPanel)
- `applicationApi.{approve, reject}`
- All hrefs / navigation
- Auth/role gating from `layout.js`
- Toast pattern

## Window A coordination

NONE. Window A doesn't touch this surface.

## Regression risk

LOW. `pnpm qa` 67/67 must hold. No Playwright spec asserts on campaign detail layout/copy. Mobile already shipped; not affected.

## Deploy classification — PRODUCTION-IMPACTING (web only)

- `git push origin main` → Vercel auto-deploys brand-web
- NO mobile, NO OTA
- Rule 5 does not fire

## Time estimate

~8-10h focused work. Largest single-flow effort so far due to:
- ContractModal extraction + relocation
- NegotiationModal extraction + relocation
- ProductionPanel extraction + relocation (nested inside ContractModal)
- MediaPreview + DeliverableStatsCard extraction
- 3 new sub-route files + hub restructure
