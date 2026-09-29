# follower-app-v2 — expected outputs: the checks

Backend: `backend/tests/shopper-app-v2.test.js` (real API, real database; posts made through the Level 3 flow,
approved by INFLX, taken live by moving the posting date). Phone: `Packages/Mobile/src/screens/shop/__tests__/shop15.test.js`
(every board screen rendered with the board's data), `utils/__tests__/deepLink.test.js`,
`navigation/__tests__/duplicateScreens.test.js`. Website admin: walked (06-diff).

| # | Check | Proved by | Status |
|---|---|---|---|
| 1 | Only live posts: none before the posting date, taken down, after the offer ends, or with every product sold out; one product in stock keeps it | backend "only live posts…" | pass |
| 2 | Women/Men/Kids filters by category segment, Unisex passes; Play = videos only | backend "her Women / Men / Kids…" | pass |
| 3 | The old shopper routes, stores and admin section/concept/Discover/library routes are gone (404) | backend "the old follower feed…" | pass |
| 4 | Stage A: newest first; the answer says stage A | backend "everything else: newest first…" | pass |
| 5 | Followed creators first (a guest's follows come from the phone) | backend "creators she follows…" | pass |
| 6 | Near her next: the phone's location used, never stored; her city when location is off | backend "then near her…" | pass |
| 7 | Styles she picked lift a post by one day | backend "the styles she picked…" | pass |
| 8 | What the phone has shown this session is not shown again; a tapped post can go first | backend "what the phone has already shown…" | pass |
| 9 | Never the same creator twice in a row, when another can go between | backend unit "never the same creator…"; also seen in check 6 | pass |
| 10 | 15% of places for brand-new posts from creators she doesn't follow | backend unit "15% of places…" | pass |
| 11 | Never repeat for 30 days; all seen → "You're all caught up", longest-ago first; per shopper; the window ends | backend "never repeat…"; phone F2 caught-up | pass |
| 12 | A post: badge, applied line, price after the offer (struck old price), creator, brand, code, link, counts; never who bought | backend "the offer badge…"; phone F2, F3 | pass |
| 13 | A photo opened: that creator, then similar, then the rest | backend "a photo opened…"; phone F4 | pass |
| 14 | A code: that post, any case, a "Post code" visit; unknown / upcoming say so; a link opened in the app counts its channel | backend "a code…"; phone F4 gone | pass |
| 15 | Search: code match; creators, brands, posts that are live | backend "search…"; phone F12 | pass |
| 16 | Liking needs sign-in; counts; "liked" shows as hers | backend "liking needs sign-in…"; phone F2 guest | pass |
| 17 | Comments: anyone reads, newest first; guest asked to sign in; 1–300 characters; report → admin removes or keeps | backend two tests; phone F6 ×2 | pass |
| 18 | A saved product remembers its post and offer; must come from a post or collection (P1) | backend "a saved product remembers…"; phone F3 heart | pass |
| 19 | Its post gone: "No longer available with this offer…", other live posts | backend "when the post leaves…"; phone F11 | pass |
| 20 | A guest's saves stay on the phone and read back the same | backend "a guest keeps saves…"; phone F11 | pass |
| 21 | Sign-in moves follows, saves and guest events to her account; safe twice | backend "at sign-in…" | pass |
| 22 | Follow / unfollow; INFLX followers; a guest follows on the phone | backend "follow and unfollow…"; phone F7 | pass |
| 23 | Creator store: details, brands, categories, Posts / Videos / Collections | backend "creator store…"; phone F7 | pass |
| 24 | A collection: items, each product with its own offer (M6); hidden not listed | backend "a collection opens…"; phone F8 | pass |
| 25 | Brand store: its posts, categories, creators; Offers: types, filters, post counts; no live post → not listed | backend "brand store…"; phone F9, F10 | pass |
| 26 | Circles: followed first; ring for new since last visit | backend "Home circles…"; phone F2 | pass |
| 27 | Welcome: Women/Men/Kids, eight styles, offered cities, location line; kept on the phone, no coordinates | backend "Welcome…"; phone F1 | pass |
| 28 | Profile: choices saved and checked; orders, following, city, what she shops for; guest sees sign-in; no wallet | backend "Profile…"; phone F13 ×2 | pass |
| 29 | The app's new events are accepted; an unknown one refuses the batch | backend "the new events…" | pass |
| 30 | Learning feed off by default; when on, what she does lifts that creator | backend "the learning feed…" | pass |
| 31 | Hourly performance numbers, readiness panel, preview by phone | backend "the hourly performance…" | pass |
| 32 | Nine feed settings on Platform settings with ranges; app config still saves | backend "the feed settings…" | pass |
| 33 | Play: full-screen videos, creator · brand, offer, Shop this video, the update note | phone F5 | pass |
| 34 | Links: /p/<code>/<ch>, /s/<handle>/<ch>, /c/<code>; retired links open nothing | phone deepLink | pass |
| 35 | Every shopper screen registered once and imported | phone duplicateScreens | pass |
| 36 | Migration 197 applies twice cleanly; no money moves; learning off; no stored location left | `scripts/run-197.js` on a copy built to 196 (twice), and a production dry run (0 stored locations, 0 old saved products) | pass |
| 37 | Nothing else regresses | full backend serially vs the Level 4 record: 0 newly failing, 34 new passing, 68 retired with the old app (27 of them already failing), 194 still failing = all pre-existing; phone 767/767; app bundle builds; website builds | pass |
