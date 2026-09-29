# post-links-codes — expected outputs: the checks

Backend: `backend/tests/post-links-codes.test.js` (real API, real database, posts made through the Level 3
flow). Phone: `Packages/Mobile/src/screens/create/__tests__/links14.test.js` and the L1 check in
`create13.test.js`. Website: walked (06-diff).

| # | Check | Proved by | Status |
|---|---|---|---|
| 1 | No code while in review; a code at approval: 6 characters, no vowels, no look-alikes; it never changes (even after take-down) | backend "none while in review…" | pass |
| 2 | Codes are unique; a bad shape is refused by the database | backend "every code is unique…" | pass |
| 3 | Share: code, caption line, five links with where each goes, "goes live on" before the date, Where to share what | backend "share (approved…)"; phone L2, L3, L4 | pass |
| 4 | Another creator can't read a post's share or stats | backend "another creator can't…" | pass |
| 5 | A post link before its date: "goes live on", her store; the ending is the channel; any case works | backend "before the posting date…"; website walk | pass |
| 6 | A live post link: what the post is; never who bought | backend "live: what the post is…"; website walk | pass |
| 7 | Link previews and crawlers are not visits; an unknown ending is Other | backend "a link preview or crawler…" | pass |
| 8 | Admin-only real source when a link is opened from elsewhere | backend "admin-only real source…" | pass |
| 9 | A removed post: "no longer available" + her store; an unknown code says so | backend "a removed post…"; website walk | pass |
| 10 | A typed code is that post, counted as "Post code" | backend "a code typed in search…" | pass |
| 11 | Her store link opens her live posts; store visits by channel this month | backend "her store link…"; phone L5; website walk | pass |
| 12 | An old handle still opens her store under the new one | backend "she changes her handle…" | pass |
| 13 | A collection has one link from creation; opens its items; hidden says so + her store; visits | backend "a collection has one link…"; phone L5; website walk | pass |
| 14 | Stats: visits and orders by channel, sales, commission; "In INFLX" for orders with no tap | backend "visits and orders by channel…"; phone L6 | pass |
| 15 | The order channel: that creator's latest tap by this device within the window, else none | backend "the order channel…" | pass |
| 16 | The window is an INFLX setting (30, 1–90) stamped on each tap | backend "the window is an INFLX setting…" | pass |
| 17 | Brand: approved and live posts with code and numbers; Copy all codes = live only; set totals from stored figures | backend "the set lists…"; phone L7, L8 | pass |
| 18 | Brand: a post's breakdown; another brand or another set's post answers 404 | backend "a post's channel breakdown…"; phone L6 brand | pass |
| 19 | Create tab (L1): three cards, her store link, each post's code, Share and Stats | phone P1/L1 | pass |
| 20 | Migration 196 applies twice cleanly; codes and handles filled; no money moves | `scripts/run-196.js` on a copy built to 195 | pass |
| 21 | Nothing else regresses | full backend serially vs the Level 3 record (1 assertion drift updated in place, 0 other); phone 753/753; app bundle builds; website build | pass |
