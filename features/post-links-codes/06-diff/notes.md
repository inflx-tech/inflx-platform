# post-links-codes — before / after

**Before** = the locked board `04-preview/mockups/post-links-codes-mockups-v1.html` (L1–L8).

**After**, three ways:
- **Phone screens (L1–L8)** — rendered in the phone app's test runner with the board's data ("Festive
  Sarees", "Sri Lakshmi Silks", code K7M2F9, "Festive kurtis" P3W8HX, priya's store, "My Dasara picks"
  DSR4K2, Set A's five posts), each sentence asserted word for word (`links14.test.js` 8 checks, L1 in
  `create13.test.js`); the app bundle builds. **Not walked on a phone** — that follows the OTA, once a
  post is approved in production.
- **Server** — proved end to end (`post-links-codes.test.js`, 18 checks).
- **Website link pages (no board: the follower screens come with the shopper app; spec D7)** — walked
  on 29 Sep in the in-app browser at 375 × 812 against a local server on the test database (never
  production), with codes made by the Level 4 tests.

| Board | What the screen does now | Same as the board? |
|---|---|---|
| L1 Create tab | Three cards (Create shoppable post · Create collection · My store and collection links with "inflx.in/s/priya"); "My posts" rows: "Urban Threads · Code K7M2F9 · live since 10 Oct" with Share and Stats; approved rows "Approved · goes live 20 Oct · Code P3W8HX" with Share; in review "With INFLX · no code until approved". | Yes. The Level 3 "Needs a shoppable post" block and Collections row stay (P1). |
| L2 Share (live) | POST CODE K7M2F9 with Copy → "✓ Copied"; the code hint; caption line with Copy; five links with where each goes, each with Copy and the Share sheet; Where to share / Follower view. | Yes |
| L3 Share (approved) | "Goes live on 20 Oct" banner with the board's sentence; the code; the caption line; the links. | Yes |
| L4 Where to share what | The six places, the board's sentences, each with her own line or link (the bio shows her store link). | Yes |
| L5 Store and collection links | inflx.in/s/priya; the five store links with "412 visits this month" / "96 visits"…; "My Dasara picks · inflx.in/c/DSR4K2 · 4 products · 31 visits"; the collection-pay line; the handle line. | Yes |
| L6 Stats | "Sri Lakshmi Silks · Code K7M2F9 · live since 12 Oct"; 1,284 visits · 37 orders · ₹4,120 to you; visits by channel bars incl. "Post code"; orders by channel incl. "In INFLX"; the In INFLX line. | Yes |
| L7 Brand posts | "Posts · Set A", "Diwali Denim · Set A · 3 creators · 2 live posts", rows with code and "1284 visits · 37 orders · ₹41,200 sales · ₹4,120 commission", "Goes live 20 Oct", the set so far. | Yes. Entry: the set screen's new "Posts" button. |
| L8 Copy all codes | Copies the list; "Copied 2 post codes" with the list, the hint and Share…. | Yes |
| Website `/p/<code>/<ch>` | Live: cover, title, "Priya Rao · Brand", "Bundle · Any 2 for ₹2,999", products with prices, "Code FP38ZK", "See Priya's store →", "Shopping on INFLX happens in the app." One visit counted per tap. | Spec D7 |
| Website `/p/…` other states | "This post goes live on 11 Oct" + store · "This post is no longer available" + store · "We couldn't find this post". | Spec D7 |
| Website `/s/<handle>/<ch>` | Her name, "@handle · 1 live post", the live posts. | Spec D7 |
| Website `/c/<code>` | Items, or "This collection is empty right now" + her store. | Spec D7 |

## Found while building
- The order-channel lookup compared the app's clock (whole milliseconds) with the database's, so a tap
  made a moment before could be missed; it now uses the database's clock.
- A store looked up by handle now prefers a creator's current handle over someone's old one.
