# Before / after — Web Campaigns tab as a monitor

Built 27 Oct 2026 against board v1 (locked the same day). Brand-web only.

## Before (what the live site showed on 24 Oct 2026, founder's screenshot)
- `/dashboard/campaigns`: "12 total · 0 live · 9 drafts"; KPI tiles Total / Draft / Active /
  Completed / Total budget ₹0; seven status chips; sort by budget; **+ New campaign** (an alert);
  every phone-built campaign shown as DRAFT with "Continue draft"; bulk Cancel / Delete / Export
  CSV; "N contracts need your signature — Sign all".
- Hub: "Fund wallet & publish" rail, End campaign, Contracts tab with Counter-sign, Production
  section always "Not started", escrow tile never rendered (phantom route), posting window shown.
- `/dashboard/campaigns/:id/influencers`: 1,416-line page with Approve / Reject, negotiation
  modal, contract editors, production panel, Invite more.
- Home: "Active campaigns 0 · 12 total", yellow **Create campaign** quick action.
- Listings publish step: "Create your first campaign →". Creator profile: an invite modal wired to
  the old `/invite` route (already switched off behind `false &&`).

## After (this build)
- **W1/W2 list**: `GET /campaigns/summary?state=` → Live / Drafts / Past with the server's
  counts, the phone's card line, a name filter. No buttons, no chips, no budget, no export, no
  signature strip. Empty state = the phone sentence.
- **W3 hub**: `GET /campaigns/:id/summary` → header chip + counts strip; current and past sets with
  Aim, mode, branch, posting date, cutoff; Engagement (with "Update now", the one write);
  Sales and clicks; Payout (read-only). Right rail "Needs you — on the phone" derived from the
  loaded creator rows; "About this campaign".
- **W4/W5 drawer**: `GET .../sets/:sid/summary` → the nine groups in server order with the server's
  sentences; Posts tab (`GET .../sets/:sid/posts`) hidden for Pay for Content sets.
- `/influencers`, `/escrow`, `/sets`, `/reviews` under a campaign all redirect to the hub.
- **W6 home**: "Live campaigns" tile = `tabs.live`; recent rows carry the card line and the derived
  chip; quick action reads **Campaigns**.
- **W7 creator profile**: invite modal and its code removed; the sticky line names the phone path.
- **W8 listings publish step**: "Run a campaign on the phone", no link.
- `lib/api.js`: `campaignApi` = summary · campaignSummary · setSummary · setPosts · engagement
  (+refresh) · conversions · clicks. Removed: create/update/delete/publish/cancel/end/sets/
  offers/invite/search/date-change, and the whole `contractApi`, `negotiationApi`,
  `productionApi` (no callers). `lib/contracts.js` deleted (no importer). `CommandRail.js`,
  `ProductionSection.js` deleted.

## Deviations from the board (honest)
- **W2 past cards**: the board shows "posted 14 Oct 2026". The list door returns
  `nextPostingDate` only for live sets, so a past card says "N sets · completed" or
  "N sets · invitations closed" without a date. The date is shown on the hub's set rows, where
  the per-set `postingDate` exists. (Computed is not delivered: no field, no number.)
- **W3 Payout tiles**: the board drew Locked / Released / Owed / Creators. The escrow door returns
  `total_locked / total_released / total_queued / total`; the existing PayoutSection renders
  those four words (Total escrowed / Locked / Released / Queued) and the per-creator tranches.
  Kept as the door speaks.
- **Needs you rail**: built from the current sets' creator rows (loaded with the hub). Past sets'
  rows load only when their drawer opens, so a "your move" on a past set is not counted. By the
  server's own state a past set has no open move, so nothing is lost.

## Proof captured
- `next build` — see "Build" below.
- Grep over `Packages/brand-web/app`, `components`, `lib`: zero callers of the removed
  `campaignApi` methods; zero references to `contractApi`, `negotiationApi`, `productionApi`,
  `deliverableApi`, `lib/contracts` (E19).
- The locked mockup is the "before" image for the diff machinery; the "after" against the live
  URL needs the founder's logged-in session (live OTP; no test login on the web), so it is the
  founder's walk after deploy, not a Playwright capture here.

## Build
`next build` on 27 Oct 2026: exit 0, no errors, no warnings. Routes: /dashboard/campaigns 3.13 kB (was the 709-line page), /dashboard/campaigns/[id] 8.67 kB, the four sub-routes 504–512 B redirects.
