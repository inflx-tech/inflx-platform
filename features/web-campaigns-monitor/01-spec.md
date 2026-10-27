# Spec — Web Campaigns tab becomes a monitor of what the phone built

**Contract:** `features/web-campaigns-monitor/`
**Written:** 2026-10-27, before any code. Survey of both ends on 24 Oct 2026 (chat).
**Rule it serves:** `Docs/THE_CUT.md` "Campaign creation — mobile only, for now. Once campaign
creation is fully developed on the phone, mirror it back into the website." This contract is the
step before the mirror: make the website READ the phone's campaign model correctly. Creating,
inviting, negotiating, signing, shooting, reviewing and paying stay on the phone.

---

## 1. Problem

The brand website's Campaigns tab still reads the campaign model that was retired when campaign
building moved to the phone (item 4, Sep 2026). Two windows onto one database disagree:

| | Brand phone | Brand web today |
|---|---|---|
| List source | `GET /campaigns/summary?state=` — state derived from invitations | `GET /campaigns` — raw `campaigns.status` column |
| States | Draft · Live · Completed · Expired (+ "Date passed") | Draft · Pending wallet · Published · Active · Live · Completed · Cancelled |
| What makes a set live | Sending its first invitation | A "Fund wallet & publish" button |
| Set fields | Aim, Store Visit / Remote, branch, posting date, cutoff | `window_start`/`window_end`, budget |

The server writes the column only on old-style publish, cancel and completion
(`campaign.controller.js:1297,1466,1572`; `contentMoney.service.js:181`). Every campaign built on
the phone therefore sits as `draft` in the column for its whole life, and the website shows it as
DRAFT with "Continue draft" and "Fund wallet & publish" (founder's screenshot 24 Oct: 9 drafts,
0 live, while several are live on the phone).

### What is wrong on the web, verified by reading the files

**Misleading or hazardous**
- `campaigns/page.js:176` labels every column-draft "Continue draft"; the card opens the hub.
- Hub `CommandRail.js:24-25,68` offers **Fund wallet & publish** for `draft`/`pending_wallet`.
  `POST /campaigns/:id/publish` demands a `total_budget` and wallet cover for content sets and
  flips the column to `active` (`campaign.controller.js:1171-1310`). The phone never calls it
  (`Packages/Mobile/src/services/api.js:549-558` define it; no screen uses it).
- List bulk **Cancel** (`page.js:528-540`) on anything the web calls draft/published. Server
  `cancel` (`:1430-1468`) refuses only when a contract is signed by both; otherwise writes
  `cancelled` to the column. `campaignSets.controller.js` and `campaignState.service.js` never
  read that column (it is passed through as `legacyStatus` only), so the phone keeps showing the
  set live and creators keep their invitations.
- `[id]/influencers/page.js:739-899` still renders clause, bonus and production-mode editors;
  "Approve & send" is a no-op toast (`:1021-1023`). "Sign contract" (`:907`) calls
  `POST /contracts/:id/brand-sign`, which the phone's typed-name agreement sign does not use
  (`item7.routes.js:30` → `agreement.service.brandSign` → same `contractSign.brandSignInTx`,
  but with `typedName` required; the web passes none).
- List **signature strip** (`page.js:346-420`) bulk-signs via `POST /contracts/bulk-sign` with a
  browser `confirm()` and no typed name.

**Dead or empty**
- Hub fetches `campaignApi.get(id + '/escrow')` (`[id]/page.js:159`) — no such route exists
  (`campaign.routes.js`; the real one is `/brands/me/campaigns/:id/escrow`, `brand.routes.js:56`).
  The ESCROW tile never renders.
- `ProductionSection.js:32` reads `ci.mode || ci.production_mode`; neither column exists on
  `campaign_influencers`. Every creator shows "Not started".
- Visit-flow buttons in `ProductionPanel` (`influencers/page.js:344-540`) are unreachable and the
  routes are retired (`production.controller.js:318,411,452-488`).
- Content approve / changes / confirm-live were removed from the web; the server answers
  `RETIRED_12_*` (`deliverable.routes.js:44-54`). The phone has them (`BrandContentScreen`).
- Hub shows `window_start`/`window_end` (`[id]/page.js:627-675`); the phone writes
  `campaign_sets.go_live_date` and `shoot_mode` (migration 165), which the web never reads.
- Total budget ₹0: `total_budget` is derived or NULL (`campaign.controller.js:385`).
- Chips Pending wallet / Published / Live / Cancelled can never fill.
- CSV export columns `spent_budget`, `influencer_count` are always 0 (`page.js:43-54`).
- `brandApi`, `router`, `preflighting`, `useQuotaWall().show` are dead in `page.js`.

**Stale "create here" doors**
- `dashboard/page.js:334-336` yellow quick action **Create campaign** → list → alert.
- `dashboard/page.js:154` "Active campaigns" counts `status in (active, live)` → always 0 for
  phone campaigns; `CampaignRow` (`:36-69`) shows the old 7 statuses, start/end dates, budget.
- `products/components/builtinStepComponents.js:239` "Create your first campaign" card.
- `influencers/[id]/page.js:252` "add one in the campaign wizard"; its invite modal posts to the
  old `POST /campaigns/:id/sets/:sid/invite` (`campaign.routes.js:57`), not the phone's
  `/invitations` door (`:64`), so it bypasses the per-creator terms the phone requires.
- `campaigns/[id]/sets/page.js:7` comment says set creation "lives in the campaign wizard
  (campaigns/new)". That route was deleted in commit 60ca1d9d.

None of this is a server defect. Every door the website needs already exists because the phone
uses it.

---

## 2. Goal

A brand opening the website sees exactly the campaigns the phone shows, in the same three lists,
with the same words, and then gets what a big screen is for: the numbers. Nothing on the website
can move a campaign; every action points to the phone.

---

## 3. Scope

### In
1. **Campaigns list** (`/dashboard/campaigns`) re-based on `GET /campaigns/summary?state=`.
2. **Campaign hub** (`/dashboard/campaigns/[id]`) re-based on `GET /campaigns/:id/summary` plus
   per-set `GET /campaigns/:id/sets/:sid/summary`, keeping analytics, store clicks, conversions,
   payout and per-set posts.
3. **Removal of every write path** from the Campaigns tab (publish, end, cancel, delete, bulk
   sign, counter-sign, approve/reject application, negotiation modal, contract editors,
   production panel, invite modal, date-change decisions). "Update now" for engagement is kept
   (D4).
4. **Side doors** on Dashboard home, Listings publish step and the creator profile page say the
   phone sentence and stop offering a web create or invite.
5. **Dead code** removed from `brand-web/lib/api.js` `campaignApi` (create/update/sets/offers/
   invite/search/open-group) and the three redirect stubs (`escrow/`, `reviews/`, `sets/`).

### Out (no-touch)
- `backend/**` — zero change. No migration.
- `Packages/Mobile/**` — zero change. No OTA. (The phone's unused `CampaignPrimeBar.js` and
  `utils/campaignPrime.js` stay; a later clean-up.)
- `Packages/shared/api/campaign.api.js` — unused by both apps; left for the-cut pass 3.
- Admin pages. Wallet, Conversions, Orders, Fulfilment, Returns, Gallery, Listings pages.
- The Level 4 in-app post engagement web view (memory: "next contracts = brand-web post
  stats") — this contract shows the per-set posts list the server already returns; a richer
  stats page is that later contract.
- Bringing the campaign builder back to the web (THE_CUT "mirror it back") — a later contract,
  after this one and after the owed device walks on items 19–21.

---

## 4. Decisions

Founder, chat 27 Oct 2026: "we proceed with this web change now", "as per your recommendation".

| # | Decision | Taken as |
|---|---|---|
| D1 | Signing on the web | **Phone-only.** Web counter-sign, bulk sign and the signature strip go. One route, one rule (typed name, two ticks). The hub shows "N agreements wait for your signature — sign on the phone". |
| D2 | CSV export | **Dropped.** It exported fields that are always 0; the three lists are the record. |
| D3 | Builder back on the web | **Later**, its own contract, after the device walks owed on items 19–21. |
| D4 | "Update now" for engagement | **Kept.** `POST /brands/me/campaigns/:id/engagement/refresh` is a read-side refresh the phone also has; it moves no campaign state. |
| D5 | Payout section | **Kept, read-only**, on the working route `/brands/me/campaigns/:id/escrow`. |

---

## 5. Surfaces touched

- App: **brand-web only** (`Packages/brand-web`). Deploy = Vercel on push.
- Roles: brand (logged in, approved). Admin untouched.

## 6. Data / contracts — every visible value traces to a field that exists today

### 6.1 List page — `GET /campaigns/summary?state=live|draft|past&limit=50`
Source: `backend/src/controllers/campaignSets.controller.js:97-124` (`listSummary`).

| Visible | Field |
|---|---|
| Segment counts Live / Drafts / Past | `tabs.live`, `tabs.draft`, `tabs.past` |
| Card name | `campaigns[].name` |
| State chip | `campaigns[].state` ∈ draft · live · completed · expired |
| "N sets · next posting {date}" / "no invitations sent" | `setCount`, `nextPostingDate` (null on drafts) |
| Progress bar signed / invited | `counts.signed`, `counts.invited` |
| "X invited · Y signed · Z waiting · N declined" | `counts.*` |
| Started from group | `startedFromGroup.name` |
| Description | `brief` |

Chip words = the phone's (`Packages/Mobile/src/screens/brand/copy4.js:61`): Draft, Live,
Completed, Expired. Order = server order (`updated_at DESC`). No sort, no budget. A client-side
name filter box only.

### 6.2 Hub — `GET /campaigns/:id/summary`
Source: `campaignSets.controller.js:127-146` (`campaignSummary`).

| Visible | Field |
|---|---|
| Name, description, negotiation on/off, started-from group | `campaign.name`, `.brief`, `.allowNegotiation`, `.startedFromGroup` |
| State chip | `campaign.state` |
| Totals strip invited / signed / waiting / declined | `campaign.counts.*` |
| Current sets / Past sets | `sets.current[]`, `sets.past[]` |
| Per set: name, Aim, mode, branch, posting date, cutoff, days to cutoff, state, counts | `sets[].name`, `.goal` (conversion = Pay for Sale, engagement = Pay for Content, hybrid = Hybrid), `.shootMode` (visit = Store Visit, shipment = Remote), `.branch.name` + `.cityName`, `.postingDate`, `.cutoff`, `.daysToCutoff`, `.state`, `.counts.*` |
| "Invitations closed" / "Date passed" | `sets[].canInvite.reason`, `.datePassed` |

### 6.3 Set drawer — `GET /campaigns/:id/sets/:sid/summary`
Source: `campaignSets.controller.js:142-160` + `invitationRows.service.js:288-371`.

| Visible | Field |
|---|---|
| Creator groups in the phone's order | `creators.order[]`, `creators.groups[key].title/count/rows/more` |
| Row: avatar, name, handle, terms line, sent/answered/signed dates | `rows[].avatarUrl`, `.name`, `.instagramHandle`, `.termsLine`, `.sentAt`, `.answeredAt`, `.signedAt` |
| Agreement line | `rows[].agreement.line`, `.reference`, `.status` |
| Shoot / Remote line | `rows[].shoot.line` or `.remote.line` |
| "Your move" badge | `rows[].group === 'yourMove'` |
| Decline reason | `rows[].declineReasonLabel`, `.declineNote` |

The row's `actions.*` booleans are read only to decide whether to show the "on the phone" hint;
no action is ever invoked from the web.

### 6.4 Posts per set — `GET /campaigns/:id/sets/:sid/posts`
Source: `postLinks.service.js:325-366` (`setPosts`).

| Visible | Field |
|---|---|
| Header: creators, live posts | `creators`, `live` |
| Totals: orders, sales, commission, INFLX fee, you receive | `totals.orders/sales/commission/inflx_fee/you_receive` (rupees) |
| Social views | `social.views` |
| Row: title, code, state, creator, goes live on | `posts[].title/code/state/creator_name/goes_live_on` |
| Row: views / likes / comments (social) and in-app | `posts[].social.{views,likes,comments}` (null → "Social links not added yet"), `posts[].inflx.{views,likes,comments}` |

Hidden when the set's Aim is `engagement` (matches `BrandSetDetailScreen.js:311`).

### 6.5 Analytics kept as-is (routes unchanged, already consumed by the hub)
- Engagement `GET /brands/me/campaigns/:id/engagement` → `totals.{views,likes,comments,links,linksRead,waiting,updatedAt}`, `bySet[]`, `byCreator[]`, `canUpdate`, `lastUpdateNowAt` (`postStats.service.js:645-651`).
- Refresh `POST /brands/me/campaigns/:id/engagement/refresh` (D4).
- Conversions `GET /brands/me/campaigns/:id/conversions` → `totals.{total_sales,total_revenue,total_commission_paid,blended_roi}`, `by_channel`, `by_influencer` (`commission.service.js:168-173`).
- Store clicks `GET /brands/me/campaigns/:id/clicks` → `total_clicks`, `by_influencer[]`, `by_set[]` (`campaign.controller.js:2157-2190`).
- Payout `GET /brands/me/campaigns/:id/escrow` → `summary`, `entries`, `influencer_breakdown[].tranches`, `campaign.has_tranches` (`escrow.controller.js:178-199`).

### 6.6 Dashboard home
- "Active campaigns" tile and "Recent campaigns" rows read `GET /campaigns/summary` (no state
  filter): tile = `tabs.live`, sub = total of the three tabs; rows = first 3 of `campaigns[]`
  with the §6.1 card line.
- Quick action **Create campaign** → **Campaigns** (same href, no create promise).

### 6.7 Endpoints no longer called from brand-web after this contract
`POST /campaigns/:id/publish`, `/cancel`, `/end`, `DELETE /campaigns/:id`, `POST /contracts/bulk-sign`,
`POST /contracts/:id/brand-sign`, `/approve`, `/regenerate-pdf`, `GET /contracts/brand/pending`,
`POST /campaigns/:id/influencers/:ciid/{cancel,approve-application,reject-application}`,
`POST /negotiations/:id/respond`, `POST /campaign-influencers/:ciId/date-change/*/decision`,
`POST /campaigns/:id/sets/:sid/invite`, `GET /campaigns/:id/products`, `GET /campaigns/:id`
(replaced by `/summary`), the phantom `GET /campaigns/:id/escrow`, all `productionApi.*` and
`deliverableApi.*` calls from the Campaigns tab.
The server keeps answering all of them; nothing is disconnected (THE_CUT pass order).

### 6.8 Money / status machines
No money moves from the web Campaigns tab after this contract. No status is written.

## 7. Non-functional
- Auth: unchanged (`brandAuth` on every read). Another brand's campaign → 404 → "Not found" card.
- Failure modes: summary 404 → not-found card with a link back to the list; analytics or posts
  failing → that panel shows "Not available right now", the rest of the hub still renders;
  empty list → the phone sentence, no button.
- Mono design rule: white/black, at most one yellow main button per screen. The Campaigns tab
  has **no** yellow button after this contract (there is nothing to do here). Waiting = blue chip,
  Live = green, Completed / Expired = grey, Draft = outline.
