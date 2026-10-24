# item21-content-posts — impact

**Verdict: production-impacting, additive, with care in two places. A Pay for Content invitation sent
after the deploy must carry a posts number and what she posts about (an un-updated brand app is told
to update, as a selling send was in September); and a queued final 50% on such a collaboration no
longer releases on its date alone. Nothing changes for the 35 collaborations in production: the 12
Pay for Content ones are all on the old terms (`sell_v2 = false`) and keep item 12's single path; no
escrow row is queued today (`run-209 --dry`, 24 Oct 2026). One migration (209). The money engine for
sales is not edited: a sale through a Pay for Content post is an ordinary sale priced with commission 0
(item 20's path).** Deploy = migration → push → phone updates (creator, brand) → website.

## What is added
- **Database (migration 209, additive):** `campaign_influencers.shoppable_posts_n` (1–10, NULL on every
  row today); `sell_mode` CHECK gains `'store'`; `collab_content.brand_report_kind` gains
  `'posts_not_made'`; `escrow_entries.release_held_for_posts` (default false). Runner `scripts/run-209.js`
  counts every collaboration, content row and escrow row before and after.
- **Server:** no new file. `creatorTerms` gains the Entire store (`storeToday`, `storeOffersFor`, `isStore`,
  `storeSignedWith`); `contentGate.postsOf` and the Path 2 lock; `contentFlow.stageWithPosts`;
  `contentMoney.postsHold` / `releaseHeldFinal`; `shoppablePosts.minOf`.
- **Phone:** no new screen. Brand terms (posts number, Entire store row, what she posts about), creator
  invitation / counter / agreement / what-you-post-about words, both content screens gain Path 1 and the
  lock (drawn with item 14's `Progress14` / `PostLine14`), the brand's third report reason.
- **Website:** the End-offer dialog's second line (`OfferPage.js`). No admin change.

## What is touched, and how it stays the same
| File | Change | Why existing behaviour holds |
|---|---|---|
| `invitationTerms.service.js` | strict send on `engagement` requires `sell` + `shoppablePosts` (1–10); counters take the number as optional | selling Aims unchanged; the legacy brief door unchanged; a counter without the number keeps the current one |
| `creatorTerms.service.js` | `readSellInput` knows `store`; `resolveSell` refuses an empty store; `sellFor` / `sellableProductIds` / `creatorOffer` / `agreementSell` read the store live for `sell_mode='store'`; `unsignedWith` counts store rows | every non-store row runs the code it ran before; store rows cannot exist before migration 209 |
| `invitationSend.service.js` | `engagement` resolves its allocation and stores `shoppable_posts_n` | selling Aims identical; the INSERT gains one column |
| `invitationRows` / `agreementTerms` / `agreementDocument` / `negotiation` | the sell block and the posts number for `engagement` on the new terms; counter snapshot carries `shoppablePostsN` (null on old terms) | an old-terms content row has `sell_v2=false` → sell block null, number null, exactly as before; `canon` adds a key that is null on both sides of every existing negotiation |
| `contentGate.service.js` | `posts` on the answer; the Path 2 lock (reads pass `allowShootNotDone`; the brand's report passes `allowLocked`) | `posts` is null without `shoppable_posts_n`, so no existing collaboration can be locked |
| `contentFlow.service.js` | stage `posts`, `openMove` / `CONTENT_MOVE_SQL` `make_posts`, Delayed stage, `path1` / `path2Locked` / `finalHeldForPosts` on the read, the `posts` step, the report reason, the confirm-live notice | each is gated on `posts`; item 12's checks (46) and item 14/15's suites run unchanged |
| `contentMoney.service.js` | `releaseFinal` holds a due row short of its posts and says why; `releaseHeldFinal` pays from an approval | `postsHold` is null unless `engagement` + `sell_v2` + a number — Hybrid's H2 rule (pay on the date) is untouched |
| `contentJobs.service.js` | the Delayed query also catches "live but short"; stage with posts; `make_posts` reminder | the extra OR is false without a number |
| `saleLive.service.js` | `path1` takes a `min` override; `afterPostApproved` branches on `engagement` | sale and hybrid approvals run the old branch |
| `shoppablePosts.service.js` | `engagement` admitted (still needs `sell_v2`); `minOf`; `earningWords`; `salesWords` keyed on commission 0; store pickers | an old-terms content collaboration still answers 404 at the door (test E22) |
| `home.service.js` / `homeCopy.js` | `make_posts` rows; the post row stays past the date while the final waits, naming the amount | selling rows unchanged (item 19 suite green) |
| `offerLife.service.js` | `store_collaborations` on the offer view | additive field |
| tests/helpers `sell.js`, `item12.js` | a content fixture becomes its closest new equivalent (1 post, all products); `markShootDone` makes and approves her first post through item 13's routes | the fixtures model the rule as it now is; `openPath2: false` keeps the lock for the tests about it |

## Risks, and what answers each
- **An invitation the brand app of 23 Oct sends** (no posts, no allocation) → refused with "update the
  app" (E1); the OTA for the brand app ships the new form in the same release.
- **Money held by mistake** → `postsHold` reads the terms row and counts approved posts in the same
  transaction as the release; E17–E20 follow one collaboration from confirm to the hold to the release
  by approval, and the date-first case.
- **A lock that never opens** → the lock is only the first approval; the brand can report "she hasn't
  made her posts" past the posting date (E23) and INFLX settles it by hand (item 17's release).
- **Entire store widening a frozen list** → store reads branch on `sell_mode='store'` alone (E10 proves
  a frozen "all" collaboration sees neither the new product nor the new offer).
- **Regression** → full backend compare against `backend/baseline_item21.json` (HEAD 8ccf74fd on an
  untouched copy; bar 0 newly failing); the whole phone suite.

## Not touched
The shopper app, checkout and pricing, wallets and withdrawals, Shiprocket, pitches, the admin pages,
Pay for Sale and Hybrid going live (beyond the Entire store choice on their terms).
