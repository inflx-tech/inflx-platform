# item20-own-brand — what the code says today (read-only survey, 10 Oct 2026)

Three passes over the server, both phone apps and the website. Nothing was run or changed;
production data was not read. Paths: `B` = backend, `M` = Packages/Mobile/src, `W` = Packages/brand-web.

**Verdict: nothing exists for a creator owning a brand.** No table or column links an influencer to a
brand (searched all migrations, B/src, M, W). The only foundation is migration 153: one phone number
may hold a brand account and a creator account (`users_phone_role_key UNIQUE (phone, role)`).

## 1. Accounts, sign-up, and proving a second number

- Login is phone + OTP per role (`auth.controller.js` ~142). A brand `users` row can exist with no
  `brands` row (registration never finished) → "has a brand" must join `brands`.
- Creator sign-up: Phone → OTP → `InfluencerRegisterScreen` (2 steps, own yellow palette `P`) →
  `POST /influencers/register` → `setAppRole('influencer')` (line 91) → pending Home. A third step
  fits after register succeeds and before `setAppRole`; the session token already exists.
  "Two quick steps" (`copy3b.js:55`) and the two-bar stepper (line 100) become three.
- Creator Profile rows (`ProfileScreen.js:126-132`): Profile info · Your numbers · Niche & languages ·
  Invitation settings · Legal · Log out. A new row goes between Invitation settings and Legal; its
  screen registers in ProfileStack (`InfluencerNavigator.js:210-229`; route names must be unique).
  Do **not** add it to the completeness keys (`completeness.js:27-30`,
  `profileCompleteness.service.js:16-26`).
- Change number (`M/screens/shared/ChangeNumberScreen.js`, `B/controllers/changePhone.controller.js`)
  is the pattern for a code to another number from the caller's own session: `otpService.sendOtp` /
  `verifyOtp`, a 15-minute signed token carrying the number, five wrong codes end the try (in-process
  Map), format `^\+91[6-9]\d{9}$`. `OtpBoxes`, `ResendLine`, `Note`, `StepBar` are private to that file.
- Three things the build must handle:
  1. `otp_codes` has no purpose column — a code sent for linking would also sign in as that brand at
     `/auth/verify-otp`, and sending it cancels a login code the owner is waiting on. Linking needs
     its own purpose (or its own store).
  2. One SMS template, one variable: the text cannot say why the code was sent.
  3. A new endpoint outside `/v1/auth` has no rate limit; it needs its own.
- A link must store ids, not rely on the two numbers staying equal (change-number moves one role).
- Brand card data: `GET /brands/:id/public` 404s to a creator while the brand is unapproved → the
  linked-brand read needs its own query. There is no `brands.city` (main branch's city or `users.city`).
- Approval: creator and brand are approved separately. A creator under review cannot open Create
  (`lockedTab.js`, `requireApproved` → 403 ACCOUNT_PENDING); profile/settings routes are not gated,
  so linking can work while pending.

## 2. The brand's side

- Brand Profile rows (`BrandProfileScreen.js:123-130`): Business details · What you sell · Branches ·
  Pitch settings · Brand overview · Links · Legal · Log out. "Linked creators" goes after Pitch settings.
- Closest list: `BrandBlockedCreatorsScreen.js` (avatar · name · date · outline pill; endpoints in
  `collabSettings.routes.js:24-26`). Use `ConfirmSheet` with `danger` for Remove.
- Telling the brand: `notificationService.send({ userId, type, title, body, data })`; a notice is
  tappable only if its `data.screen` has a case in `M/components/home/open19.js:163-193`.
- Website: Settings › Profile is cards; precedent for "managed in the app" is the Branches card.

## 3. Where the server assumes a collaboration (the main build)

Hard blockers — a post with no collaboration breaks or disappears at each:

| # | Where | What |
|---|---|---|
| H1 | migration 195:102-104 | `creator_posts_v2_shape` requires `campaign_influencer_id` for v2 |
| H2 | migration 198:92 | `order_lines.campaign_influencer_id` NOT NULL (written `shopperCheckout.service.js:428-436`) |
| H3 | `shoppablePosts.service.js:279-291` POST_SQL | INNER JOINs ci, sets, campaigns; used by loadOwn, getMany, listMine, approveCheck, afterDecision, adminShape, removePosts, afterProductsLeft, offerPostStats. **Trap:** approveCheck returns "no problem" and afterDecision returns early when the row is missing — relaxing H1 alone would approve unchecked and never issue a code |
| H4 | `shopperPosts.service.js:119-120` livePool | INNER JOIN ci, cs → creator store, brand store, collections, search, isLive |
| H5 | `shopperPosts.service.js:379-381` byCode | INNER JOIN → a typed code reads as unknown |
| H6 | `orderPricing.service.js:423-435, 458, 484` | loadContexts INNER JOIN; commission from `ci.commission_pct`; offer price applies only through `collab_offers` |
| H7 | `shoppablePosts.service.js` 498, 512, 577, 597-601, 698-700, 817, 832-834, 855 | every builder step resolves the collaboration (ownCollab, postable, collab_offers, `sell_product_ids`) |
| H8 | 926-927 | approveCheck loads the collaboration and runs problemOf |
| H9 | `walletRead.service.js:105-106` SALE_SQL | INNER JOIN → line missing from the brand's Sales list, creator's Commission list, Admin sales; totals (184-197) have no such join, so they would count a line the list hides |
| H10 | 124, 916 | `can_post` and brands() come only from collaborations |
| H11 | migration 195:143, `creatorCollections.service.js:58-88` | product collections need a collaboration (post collections ride on H4) |
| H12 | `postLinks.service.js:299-351` | brand's posts and stats are keyed on a set |
| H13 | `home.service.js:517-524` | creator Home's sent-back / in-review rows INNER JOIN |

Already safe: commission 0/null (`orderPricing` 108-113, 381, 484; check constraint 198:124; pending
credit skipped at 0); INFLX's share is per brand (`pricing.service.js:403-414`, category `path_b_pct`);
the brand's payout is not keyed on a collaboration (`commerce-settlement.job.js`,
`settlement.service.js:63-126`); stats and visits (`postLinks.service.js:275-291`); history events on
post_id; leaving the shop (afterOfferEnded, afterProductChange, sweepEndedOffers).
Watch: `commission-confirm.job.js:17` INNER JOINs ci → an own-brand sale is skipped and
`commission_confirmed_at` stays NULL, so the creator's "coming" count must exclude these lines.

**Approach chosen: tie the post directly to the brand (B), not a hidden collaboration (A).** A hidden
collaboration needs a fabricated campaign, set, signed contract, completed shoot, per-offer
`collab_offers` rows and a mirrored `sell_product_ids`, and leaks into about a dozen screens, jobs and
counts (Needs you rows, Collabs list, signed-with counts, locked offer pools, a "₹0.00 commission
confirmed" notice). B is one migration plus ~15 mechanical spots, and its misses are loud.

B, in outline: relax H1 to "collaboration OR own-brand" (brand_id stays required); drop NOT NULL on
`order_lines.campaign_influencer_id`; add the link table; POST_SQL / byCode / loadContexts / SALE_SQL /
Home rows to LEFT JOIN with an own-brand flag; one "who is this post for" resolver in place of
ownCollab; an own-brand branch in problemOf / checkProducts / the offer check; brands() and `can_post`
include the linked brand; livePool drops its two joins; the offer applies when the offer's brand is the
post's brand; own-brand lines excluded from the creator's commission list. Phone: the own-brand card
skips PostCollab; copy variants; hide "Creator's share".

## 4. What he may sell

- Offers: `engine = 2`, published, `ends_on >= today` (`shoppablePosts.service.js:162-169`) — includes
  a Scheduled offer; the approved post waits for its start. By brand id: `offerLife.list(brandId)`,
  `creatorTerms.offerChoices(brandId, day)`. Picking from an offer is already collaboration-free
  (offerProducts, pickRule, shopperPrice, `offerPool.frozenPool`).
- Products: listed = `is_active AND pushed_to_store`. By brand id: `offerPool.service.js`
  productsWithoutOffers (486-526), productsUnder, searchProducts, productsByIds.
- A price post always charges the normal price (`orderPricing.service.js:126`); today a price post
  carries only products not in an offer (`creatorTerms.service.js:118-120`). Board decision D1 keeps it.

## 5. The social record and the numbers

- Today's social step hangs off `collab_content` (unique per collaboration, needs a contract):
  rounds, files, captions, proofs — all there for the brand's approval. Nothing is keyed on a post
  alone → a per-post table (post, place, link, date) is new.
- Six places: Instagram reel / post / story, YouTube video / Short, Facebook post
  (`contentCopy.js:113-120`). Link check reusable: `validLink` + host lists
  (`contentFlow.service.js:818`, `contentCopy.js:169-176`).
- Closest phone pattern: the no-approval "Where did you share it?" card in `SaleLiveScreen.js:548-580`;
  `DestinationSheet14` (`components/sale/sheets14.js:33-60`), `LinkBox12`, `LinkLine12`.
- Nothing is measured from the social post itself. Numbers exist per post **per channel**
  (ig / yt / wa / fb / other + "Post code" + "In INFLX"): visits in `link_visits`, orders by the latest
  tap from the same device within 30 days (`postLinks.service.js:107-116`). Never draw a number against
  one reel. `totals.sales` is already in the stats payload; the screen shows commission ("to you").

## 6. Results and money, as shown today

- `PostStatsScreen.js`: visits · orders · ₹ commission "to you"; Visits by channel; Orders by channel.
- Brand Wallet › Sales money (`BrandWalletSalesScreen.js:56-92`, `copy17.js:91-106`): row
  "{First}'s post CODE · state"; detail Shopper paid · Creator's share · INFLX's share · Your share.
- Words that promise earnings or say "collaboration" and need an own-brand variant: `copyCreate.js`
  31, 32, 47, 50, 57, 123, 126, 131, 137, 152, 154; `copyLinks.js` 11, 41, 48, 53;
  `shoppablePosts.service.js:405`; `postsCopy.js:10-15`; admin `W/app/admin/posts/page.js:102-103`.
