# Item 19 — Home and Needs You · code survey (9 Oct 2026)

Read-only, four passes over `backend/src`, `Packages/Mobile/src`, `Packages/brand-web`. Nothing was run;
production data was not read. This is the record the v1 board (`04-preview/mockups/item19-home-v1.html`)
was drawn from. Paths: `B/` = backend/src, `M/` = Packages/Mobile/src, `W/` = Packages/brand-web.

## Home today
- Both apps: `HomeTab` = `M/components/shell/PendingHomeScreen.js`. Approved (or /me failed) → `ComingSoonScreen`
  ("Home is coming soon", `M/components/discovery/copy3.js:30,32`). Pending → "Under review" + two cards + the
  FinishProfileSheet (once per app session). **Keep the pending branch and the sheet as they are.**
- Approved accounts open on Creators (brand) / Collabs (creator): `initialTabFor` in `M/navigation/lockedTab.js:43-45`.
- No tab has a badge. HomeTab is a plain screen with no stack (`*_TAB_ROOTS.HomeTab` is null).

## The rule for "your move" that already works
- **Brand, per set:** `invitationRows.creatorsForSet` (`B/services/invitationRows.service.js:351-363`) →
  row `actions{sendAgreement,signAgreement,…}`, `negotiation{whoseMove}`, `moveRequest`, `shoot{stage,line,yourMove}`,
  `remote{stage,line}`, `content{move,yourMove,line}`, `goingLive{move,yourMove,line}`. The phone turns a row into one
  button or tag in `setRowStep` (`M/components/invitations/steps5.js:121-184`): Sign, Send agreement, Reply,
  Plan the visit, Confirm shoot, Review it, Confirm live, Open.
- **Creator, all rows:** `invitationsForCreator` (`invitationRows.service.js:700-718`) → `creatorCard`; phone decides
  with `cardStep` / `herMoveOnActive` / `hersToAnswer` (`steps5.js:204-275`): Review & sign, Open.
- Destination routes all exist: brand `BrandAgreement`, `BrandThread`, `BrandShoot`, `BrandRemote`, `BrandContent`,
  `BrandSaleLive`, `BrandPitch`, `BrandPool`, `BrandSetDetail` ({campaignId,setId,ciId}); creator `Invitation`,
  `Thread`, `Agreement`, `Shoot`, `MyRemote`, `Content`, `SaleLive`, `PitchThread`, `PostStatus`, `PostType` ({ciId}).
  Cross-tab jump: `navigate('<Tab>', { screen, params, initial:false })` (`M/navigation/BrandNavigator.js:252-258`).

## Do NOT build Home on these (existing but wrong)
- `GET /brands/me/inbox-summary` → `needs_you` (`B/services/collabCounts.service.js:46-217`): drops `state`, five
  moves are one integer, misses Pay for Sale / Hybrid review + confirm live, move requests, visit-time-passed, all
  Remote brand moves; reads legacy `campaigns.status` (phone-built campaigns stay `draft` → false NEVER_PUBLISHED);
  Remote rows read "brand's turn" throughout.
- `GET /influencers/me/needs-you` (`collabCounts.service.js:223-405`): counts only; `invites_to_answer` ignores the
  cutoff; reads the dead `brand_collab_requests`; no sale moves; `posts_to_fix` counts old-style posts.
- Both have no phone caller (`M/utils/brandNeedsYou.js`, `M/utils/creatorSteps.js`, `M/components/brand/NeedsYou.js`
  are orphaned).

## Moves the row rule misses today (state is stored; the new read must add them)
- Brand: book again after the parcel came back (`remoteShoot.service.js:327-328`), look at a parcel difference
  (`:333-334`), confirm the return (`:331-332`, auto-confirms after 7 days), agreed visit time passed
  (`shootPlan.service.js:103-105`, derived on read).
- Creator: mark the visit done (`shootPlan.service.js:198`), send the products back (`remoteShoot.service.js:317-320`
  — **no door from Collabs once the shoot is marked**), correct the address, share posts not yet shared.
- Delayed: `ci.delayed_at` is stored but `ROW_SELECT` / `CREATOR_SELECT` never select it, so every list says
  `delayed:false` (`invitationRows.service.js:200-227, 376-449` vs reads at `:572, 611, 637, 649`).
- "Sign" / "Send agreement" can still be offered after the cutoff when another creator in the set has signed
  (`set-expiry.job.js:53-56`); the server refuses the signature (`agreement.service.js:390`). Home must test the cutoff.

## Other to-dos with a ready source
- Pitches: `GET /brands/me/pitches` → `groups.new.count`, `groups.talking.count`, `unread`, `negotiation.whoseMove`
  (`B/services/pitch.service.js:418-436`; heavy per card — add a plain count). Creator: `/influencers/me/pitches`.
- Pool: `GET /brands/me/pool` → total, `closingSoon` (`B/services/pool.service.js:95-108`).
- Draft / date-passed sets: `GET /campaigns/summary` (`B/controllers/campaignSets.controller.js:86-116`) →
  `tabs{live,draft,past}`, per campaign `state, setCount, nextPostingDate, counts{invited,signed,waiting,declined}`.
- Creator posts: `GET /influencers/me/create` → `needs[]`, `counts{live,approved,in_review,sent_back,removed,draft}`,
  `store_link` (`B/services/shoppablePosts.service.js:890-918`; hydrates every post — use a lighter count).
- Creator setup: `/influencers/me/social` → `chip`; invitation settings `summary.labelState`; wallet `details`.
- Orders (brand): **no phone screen, no counts by status.** Website only (`W/app/dashboard/fulfillment/page.js`).
  Cheap count: `GROUP BY order_status` on `follower_orders WHERE brand_id AND checkout_id IS NOT NULL`
  (predicate at `B/services/shopperOrders.service.js:538`). `M/utils/openWebDashboard.js` opens the website.

## Numbers that exist
- Brand wallet: `GET /brands/me/wallet` → `figures{available,onHold,locked,lockedCount,salesComing,salesComingCount}`.
- Brand sales: `GET /brands/me/wallet/sales` → `totals{coming,comingCount,added,addedThisMonth,sales}` + `sales[]`
  (`B/services/walletRead.service.js:184-198, 235-237`). Trust `order_lines`, not `follower_transactions` sums
  (those overstate after a partial cancel).
- Creator wallet: `GET /influencers/me/wallet` → `figures{available,onHold,stillToCome,payments,paymentsCount,
  nextPaymentAt,commission,commissionCount}`, `withdrawal_waiting`, `details{has_upi,has_bank_account}`.
- Creator links: `GET /influencers/me/links` → `store{url,display,links[]}` with this month's visits.
- Find brands: `GET /influencers/me/find-brands?countOnly=1` → `{total}`.

## Notifications
- `GET /notifications` → newest 50 + `unread_count`; `POST /notifications/read-all`.
- Creator: `M/screens/influencer/CreatorNotificationsScreen.js`, reached from a bell on Collabs (no count shown);
  routes 5 `data.screen` values; **dead taps:** `my_content`, `my_shoot`, `my_remote`, `my_pitch`,
  `invitation_thread`, `wallet`, `earnings`, `collabs`.
- Brand: no list, no bell (`brandApi.getNotifications` has no caller). Server already sends `data.screen`:
  `set_detail`, `brand_thread`, `brand_pitch`, `brand_shoot`, `brand_remote`, `brand_content`, `brand_going_live`,
  `pool`, `wallet`, `campaign_detail`. Order notices carry only `{order_id}`.
- Push taps are stored (`inflx_pending_deeplink`) but only the shopper app opens them (`Packages/Mobile/App.js:40-50`).

## Shell notes for the build
- Tab root layout: `useTopInset(TOP_GAP_TITLE)`; title sizes differ per tab (20 / 22 / 24); side padding 18;
  no pull-to-refresh anywhere on brand/creator screens (reload in `useFocusEffect`).
- Reuse: `Skeleton`, `LoadError`, `EmptyState`, `RowAction5`, `StatusTag5`, `Chip5`, `Balance17`/`Fig17`,
  `CopyButton`. Do not use `components/collabs/CollabRow.js` or `StageTabs.js` (old theme, unused).
- `CollabsScreen` reads `route.params.segment` only at first mount — a Home link to a segment needs the re-apply effect.
- Found on the way (website home, not in scope): "Active campaigns" filters legacy status (phone-built campaigns
  count 0); recent activity reads `tx.type`/`tx.amount` while the endpoint returns `transaction_type`/`net_amount`.
