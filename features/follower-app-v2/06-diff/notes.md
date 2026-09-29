# follower-app-v2 — before / after

**Before** = the locked board `04-preview/mockups/follower-app-v2-mockups-v1.html` (F1–F13), locked by the
founder in chat on 29 Sep 2026, with the decisions of that day (rules v1.7).

**After**, three ways:
- **Phone screens (F1–F13)** — rendered in the phone app's test runner with the board's data (Priya, Sneha,
  Sri Lakshmi Silks, Urban Threads, K7M2F9, "My Dasara picks"), each sentence asserted word for word
  (`shop15.test.js`, 20 checks); the app bundle builds. **Not walked on a phone** — that follows the OTA, and
  production has no approved new post yet, so the feed opens empty until the first one is approved.
- **Server** — proved end to end (`shopper-app-v2.test.js`, 33 checks).
- **Website admin** — Comment reports and Feed walked in the in-app browser against a local server on the test
  database (never production); the website builds.

| Board | What the screen does now | Same as the board? |
|---|---|---|
| F1 Welcome | INFLX · Skip; "Let's make your feed yours"; I shop for Women · Men · Kids; Styles I like (Festive, Casual, Korean Style, Office, Street Style, Elegant, Minimal, Boho); My city: "Use my location" / "Pick my city" (146 offered cities, searchable); the location line; "Show my feed". | Yes, with the 29 Sep change: the board's "We never ask for your exact location" is now "We use your phone's location … We never store it", and the city field is the fallback (rules 5.3). |
| F2 Home | INFLX + search; Creators and Brands circles (yellow ring = new since last visit); posts with creator, "Brand · City", offer badge, "Shop this post · 2 items ›", ♡ 418 · 💬 36 · ↗ 54 · 🔖, caption. | Yes. The bag icon and its count are not shown until checkout (decision 29 Sep). |
| F2b Video in the feed | "Shop this video · 3 items", the offer badge; tapping opens Play. | Yes, except the video shows its product photo with "Update INFLX to play videos" until the Play Store build (rules 4.7). |
| F3 Shop this post | "Shop this post" + "20% off applied"; "Priya · Sri Lakshmi Silks"; products at ₹960 with ₹1,200 struck; ♡ per product; "No code needed. Buying here pays Priya her commission. The ♡ saves the product with this post, so it keeps this offer."; the offer's how-it-works and a free gift's "Free with this: …". | Yes, except **Add** and **Go to bag** — replaced by "Adding to the bag comes with checkout. Save what you like for now." (decision 29 Sep). |
| F4 A photo opened | The post, then "More from Priya", then "Similar posts", then "More to see". | Yes |
| F5 Play | Full-screen, dark tab bar; creator · brand (tap → stores), caption, badge, ♡ 💬 ↗ 🔖 on the right, "Shop this video · 3 items ›". | Yes, with the video note above until the Play Store build. |
| F6 Comments | "Comments · 36", newest first, "Priya · creator" on her replies, Report; guest: "Sign in to like and comment" + the board's sentence + "Sign in with your number"; signed in: a box with 0/300 and Send. | Yes. Reply is Level 5 (creator side). |
| F7 Creator store | Avatar, name, bio · city, "12.4K followers on INFLX", Follow / Following; "Brands she works with"; Categories (chips); Posts · Videos · Collections; 2 × 2 tiles with badge / ▶. | Yes. Categories are chips rather than emoji circles (no category icons exist yet). |
| F8 Collections | Collection tiles "Goa trip edit · 4"; a products collection: "My Dasara picks · 2 products", rows with price after its own offer, brand, ♡; the board's collection sentence. | Yes. No Add (as F3). |
| F9 Brand store | "Vijayawada · 18 creators · 64 live posts"; Categories; Creators; tiles; floating "% Offers". | Yes |
| F10 Offers | "Offers · Sri Lakshmi Silks"; All · BOGO · Bundle · Discount · Buy more save more · Free gift; Price ▾ Category ▾ Theme ▾; offers "Till 31 Oct · in 9 posts by 6 creators"; the board's sentence; tap → the posts carrying it. | Yes |
| F11 Saved | Posts · 6 / Products · 4; products "From Priya's post · 20% off till 31 Oct" with price; gone: "No longer available with this offer. Divya's post ended on 15 Oct." + "Live in 2 other posts →"; guest line. | Yes, without Add (as F3). |
| F12 Search | "Search or enter a post code"; the hint; POST CODE MATCH card with Open post; creators, brands, posts. | Yes |
| F13 Profile | Name, masked number, Edit; Orders ("2 on the way"), Following, My city, What I shop for, video sound, Policies and help, Returns · Addresses greyed; Log out. Guest: "Browsing as guest" + sign in. | Yes. "Settings" is the video-sound switch (notifications come with order updates). |
| Discover | "Discover is coming soon". | Decision 29 Sep (not drawn on the board). |
| Admin · Comment reports | Reported comments, oldest first, with who wrote it, how often reported, the post's creator, brand and code; Remove / Keep. | New (rules 4.15) |
| Admin · Feed | Readiness panel (shoppers with 20+ actions, active shoppers, actions, days of data, the guide); preview by phone number: "Feed today (rules)" beside "Feed if learning were on". | New (rules 5.12) |

## Found while building
- The test database reset re-seeded platform settings without `link_channel_window_days` (Level 4) or the feed
  numbers, so an admin change to them updated nothing in tests. Both are in the reset list now.
- A post's "newest" moment is when it went live (the later of its posting date and its approval), not its approval alone.
