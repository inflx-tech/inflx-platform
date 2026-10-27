# Impact — Web Campaigns tab as a monitor

> Written before implementation, after the survey. Verdict: **Vercel brand-web only; no server,
> no migration, no OTA; nothing on the web can write campaign state afterwards.**

## Affected files
**brand-web (change)**
- `app/dashboard/campaigns/page.js` — rewrite (709 → ~250 lines): summary-based list, three
  segments, name filter, empty state. Removes bulk bar, CSV, signature strip, status chips, KPI
  tiles, quota modal import, `brandApi`/`router`/`preflighting` leftovers.
- `app/dashboard/campaigns/[id]/page.js` — rewrite (999 → ~450): summary header + strip, sets
  block, set drawer (creators / posts), engagement + sales/clicks + payout blocks, right rail.
- `app/dashboard/campaigns/[id]/PayoutSection.js` — keep; palette only.
- `app/dashboard/campaigns/[id]/CommandRail.js`, `ProductionSection.js` — delete.
- `app/dashboard/campaigns/[id]/influencers/page.js` — 1,416 lines → a redirect to the hub.
- `app/dashboard/campaigns/[id]/{escrow,reviews,sets}/page.js` — stay as redirects (sets/
  comment corrected).
- `app/dashboard/page.js` — campaign tile, recent rows and quick action read the summary.
- `app/dashboard/products/components/builtinStepComponents.js` — one next-action card.
- `app/dashboard/influencers/[id]/page.js` — remove `InviteModal` + button; add the phone line.
- `lib/api.js` — `campaignApi`: add `summary(state)`, `campaignSummary(id)`,
  `setSummary(id,sid)`, `setPosts(id,sid)`; remove `create/update/delete/publish/cancel/end/
  cancelInfluencer/getLive/getSets/createSet/updateSet/deleteSet/duplicateSet/createOffer/
  inviteInfluencer/updateInfluencer/searchInfluencers/getOpenGroupMatches/getDateChangeRequests/
  decideDateChange`. Keep `getEngagement/refreshEngagement/getConversions/getClicks`.
  `contractApi.listPending/bulkSign/brandSign/approve/regeneratePdf` — removed only if no other
  page imports them (grep first; `inbox/page.js` and `contracts/page.js` to be checked).
- `lib/contracts.js` (`contractLockAmount`) — delete if the campaigns pages were its only importer.

**backend** — none. **mobile** — none. **shared** — none.

## Affected routes / APIs
| Method | Path | Change | Consumers after |
|---|---|---|---|
| GET | /campaigns/summary | newly called from web | phone, web |
| GET | /campaigns/:id/summary | newly called from web | phone, web |
| GET | /campaigns/:id/sets/:sid/summary | newly called from web | phone, web |
| GET | /campaigns/:id/sets/:sid/posts | newly called from web | phone, web |
| GET | /brands/me/campaigns/:id/{engagement,conversions,clicks,escrow} | unchanged | web |
| POST | /brands/me/campaigns/:id/engagement/refresh | unchanged | phone, web |
| GET | /campaigns, /campaigns/:id, /campaigns/:id/products | no longer called from web | admin? (grep: `campaignApi.list` also used by `inbox/page.js`? — check at implement) |
| POST | /campaigns/:id/{publish,cancel,end}, DELETE /campaigns/:id | no longer called from web | nobody (server keeps answering) |
| POST | /contracts/bulk-sign, /contracts/:id/{brand-sign,approve,regenerate-pdf} | no longer called from web | nobody from brand-web |
| POST | /campaigns/:id/influencers/:ciid/* , /negotiations/:id/respond, date-change decisions, /sets/:sid/invite | no longer called from web | nobody from brand-web |

## Affected workflows (regression surface)
- Brand dashboard home load — `qa/` web specs that assert the home tiles (grep `Active campaigns`
  in `qa/**`): the label changes to "Live campaigns"; update the assertion in the same commit.
- Conversions page, Wallet page — untouched, but share `lib/api.js`; `next build` proves imports.
- Inbox page links to `/dashboard/campaigns/:id` — still resolves (hub).
- Admin pages — untouched.

## Migration / deploy / OTA
- Migration: none. OTA: none. Deploy: `git push` → Vercel builds brand-web. Render rebuilds too
  (monorepo push) but with no backend diff.
- Proof: Vercel CDN Age reset on `/dashboard/campaigns`; network panel on the live site shows
  `/campaigns/summary` and none of §6.7.

## Risk notes
- **Removed capability on the web:** counter-signing (D1). A brand that only used the website
  to sign must now sign on the phone. The hub's "Needs you — on the phone" names it. No data
  path is lost: the phone's agreement screen signs the same `contracts` row via the same service.
- **Old web-built campaigns** render through the same summary doors; their sets have no
  posting date or Aim beyond what is stored. They display, they do not break.
- Nothing irreversible. Revert = redeploy previous build.
