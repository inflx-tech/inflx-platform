# shoppable-posts-v2 — expected outputs: the checks

Each check names the test that proves it. Status comes from the test run, never by hand.
Backend: `backend/tests/shoppable-posts-v2.test.js` (real API, real database, real signed uploads through
the storage mock). Phone: `Packages/Mobile/src/screens/create/__tests__/create13.test.js`.

| # | Check | Proved by | Status |
|---|---|---|---|
| 1 | Before the shoot is done the brand shows "Opens after your shoot plan" and no draft can be made | backend "before the shoot is done…"; phone P2 | pass |
| 2 | After both signatures and the shoot, P3 says what she can sell, the posting date, posts done, earning | backend "after both signatures…"; phone P3 | pass |
| 3 | Pay for Content and other creators' collaborations are not hers to post for | backend "a Pay for Content…", "another creator's…" | pass |
| 4 | P4: offer post / price post with counts, or the reason one isn't possible | backend "post type…"; phone P4 | pass |
| 5 | P5: offer types with counts, empty types named as hidden; ends-soon warning | backend "post type…", "an offer ending within 7 days…"; phone P5 | pass |
| 6 | P6/P7: the pool with shopper prices; pick-any min; fixed bundle adds all; free gift words | backend "pick-any…", "fixed bundle…"; phone P6/P7 | pass |
| 7 | P8: only her products without offers, with category paths; band and categories filter | backend "price post…"; phone P8 | pass |
| 8 | Products must come from the offer / her products without offers | backend "products must come from…" | pass |
| 9 | An offer not in her collaboration is refused | backend "an offer not in her collaboration…" | pass |
| 10 | Theme tags: at least 1, at most 1 per group, only INFLX's | backend "theme tags…"; phone P9 | pass |
| 11 | Media: her own uploads, landed, one kind, single = one, ≤ 10, video ≤ 90 s, ≤ 200 MB, type | backend "media: …"; phone P10 | pass |
| 12 | Product tags on photos optional; a pin is a product in the post on a photo | backend "product tags on photos…" | pass |
| 13 | Facets: category leaves, the offer, band of the costliest item, theme | backend "the facets…"; phone P11 | pass |
| 14 | A discount post is banded by the discounted price; others by the normal price | backend "a discount post is banded…" | pass |
| 15 | Nothing is sent incomplete: pick count, tags, media, caption | backend "nothing is sent incomplete…"; phone P11 refusal | pass |
| 16 | Once sent nothing changes; the INFLX queue shows collaboration, offer, facets | backend "once sent…" | pass |
| 17 | Sent back: the reason reaches her; she may change media, caption, products, tags — not the offer; resend | backend "sent back…"; phone P13 | pass |
| 18 | Approved before the posting date: "approved", notice with the date, counts toward the minimum, take down | backend "approved before the posting date…"; phone approved | pass |
| 19 | After the posting date an approved post is live | backend "after the posting date…" | pass |
| 20 | Approval re-checks: an offer that ended after sending can't be approved | backend "approval re-checks…" | pass |
| 21 | Only drafts and sent-back posts can be deleted | backend "drafts and sent-back posts…" | pass |
| 22 | The brand ends the offer: post removed, she's told why, notice opens the post; offer page counted it | backend "the brand ends the offer…"; phone P15 | pass |
| 23 | Products removed from the offer leave posts; an empty post is removed; the preview counts them | backend "products removed from the offer…" | pass |
| 24 | A product off sale leaves her post; empty → removed as unavailable | backend "a product taken off sale…" | pass |
| 24b | A product the brand deletes leaves her posts the same way, and she is told | backend "a deleted product leaves her posts too…" | pass |
| 25 | Every product sold out removes the post; a new price moves its band | backend "every product sold out…" | pass |
| 26 | An offer past its end date: reads show removed at once; the daily sweep makes it final, once | backend "an offer past its end date…" | pass |
| 27 | Her posts by state with counts; a draft carries on at its step | backend "her posts by state…"; phone P14 | pass |
| 28 | The July composer answers 410 | backend "the July composer…" | pass |
| 29 | New posts are kept out of the old follower feed and post page | backend "an approved new post does not appear…" | pass |
| 30 | Collections of posts take only posts in the shop; hide when none is left; delete never touches posts | backend "a collection of posts…"; phone P17, P20 | pass |
| 31 | Collections of products: grouped by collaboration, each remembers it; rename, add, remove; kind stays; others 404 | backend "a collection of products…"; phone P19, P20 | pass |
| 32 | A product she can't sell can't go in a collection | backend "a product she cannot sell…" | pass |
| 33 | The Create tab: needs list, Start, her posts, "+" chooser, off before she can post | phone P1 | pass |
| 34 | Price bands: "under" includes the edge; above ₹2,999 is ₹3,000+ | backend "under includes the edge…" | pass |
| 35 | Migration 195 applies twice cleanly; old posts untouched; no money moves | `scripts/run-195.js` on a copy built to 194 | pass |
| 36 | Nothing else regresses: full backend serially vs the Level 2 record; full phone suite; app bundle builds | `compare-tests.js` (0 newly failing); phone `jest` 745/745; `react-native bundle` | pass |
