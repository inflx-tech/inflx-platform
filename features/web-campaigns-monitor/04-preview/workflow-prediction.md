# Workflow prediction — Web Campaigns tab as a monitor

Board: `mockups/web-campaigns-monitor-v1.html` (W1–W8). Lock alongside the board.

## Trigger
A brand opens `/dashboard/campaigns`, a campaign hub, or one of the three side doors
(Dashboard home, Listings publish step, a creator's profile page).

## Steps
1. List page calls `GET /v1/campaigns/summary?state=live&limit=50` → renders W1. Segment tap →
   same call with `draft` / `past` → W2.
2. Card tap → `/dashboard/campaigns/{id}` → `GET /v1/campaigns/{id}/summary` → W3 header, strip
   and sets. In parallel: engagement, clicks, conversions, payout (existing doors) → the
   Numbers blocks. Any of those failing → that block says "Not available right now".
3. Set row tap → drawer → `GET /v1/campaigns/{id}/sets/{sid}/summary` → W4. Posts tab (not for
   Pay for Content) → `GET .../sets/{sid}/posts` → W5.
4. "Update now" → `POST /v1/brands/me/campaigns/{id}/engagement/refresh` → engagement block
   re-reads. This is the only write.
5. Dashboard home calls `GET /v1/campaigns/summary` once → W6 tile and rows.
6. W7 and W8 are static copy changes; no call.

## End state
- No row in `campaigns`, `campaign_sets`, `campaign_influencers`, `contracts`, `escrow_entries`
  or `wallet_transactions` changes from anything on the web Campaigns tab.
- The web's three lists equal the phone's three lists for the same brand.

## Edge cases
- Another brand's id → 404 → "Not found" card.
- Set deleted on the phone while the drawer is open → 404 → "This set is gone", hub reloads.
- Engagement refresh refused (budget / once a day) → the server's message in the block; nothing
  else changes.
- Old web-built campaigns (pre item 4) → still listed; sets without a posting date say
  "no posting date".
- Signed-out → existing dashboard gate.

## What changes vs current behaviour
- Today: list reads the stale status column (all phone campaigns = DRAFT), offers Continue draft,
  New campaign, bulk Cancel/Delete, Export CSV, Sign all; hub offers Fund wallet & publish, End,
  counter-sign, approve/reject, counter offer, invite, production panel; escrow tile never
  renders; production rows always "Not started"; posting window shown, posting date not.
- After: list and hub read the phone's summary doors; no write except engagement refresh; every
  "do" names the phone path; side doors stop promising a web create or invite.
- Files touched (preview): `Packages/brand-web/app/dashboard/campaigns/page.js` (rewrite),
  `campaigns/[id]/page.js` (rewrite), `campaigns/[id]/CommandRail.js`, `ProductionSection.js`
  (delete), `PayoutSection.js` (keep, restyle), `campaigns/[id]/influencers/page.js` (becomes a
  redirect), `campaigns/[id]/{escrow,reviews,sets}/page.js` (redirects, unchanged or deleted),
  `app/dashboard/page.js` (tile, rows, quick action), `products/components/builtinStepComponents.js`
  (one card), `influencers/[id]/page.js` (remove invite modal, add the line), `lib/api.js`
  (campaignApi: add `summary`, `campaignSummary`, `setSummary`, `setPosts`; remove the write
  methods), `lib/contracts.js` (delete if nothing else imports it).

## Blast radius
- Production-impacting: **Vercel brand-web only.** No Render change, no migration, no OTA.
- Rollback: revert the commit; Vercel redeploys the previous build.
- Affected users: every brand on the website. Admin untouched.

## Open questions
None blocking. D1–D5 recorded in `01-spec.md §4`.
