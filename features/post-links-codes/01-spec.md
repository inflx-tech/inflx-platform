# post-links-codes — spec (Level 4: post links, post codes, store and collection links)

Rules of record: `Docs/OFFER_TERMS_POSTS_RULES.md` **v1.5, §4.14** (with §2.10: the old offer code is retired).
Locked screens: `04-preview/mockups/post-links-codes-mockups-v1.html` — creator app **L1–L6**, brand app
**L7–L8** (locked 29 Sep 2026). Founder source: `ref/` ("Post Code and Links", 5 screens) and the 11
points agreed on 28 Sep. Depends on `features/shoppable-posts-v2` (Level 3, live).

## What Level 4 delivers

- Every post INFLX approves gets a **post code** (6 characters, e.g. `K7M2F9`) and **five post links**
  `inflx.in/p/<code>/<channel>` — `/ig` Instagram · `/yt` YouTube · `/wa` WhatsApp · `/fb` Facebook · `/o` Other.
- Every creator has a **store link** `inflx.in/s/<handle>` with the same five endings; a handle she used
  before keeps working forever.
- Every collection has **one link** `inflx.in/c/<code>`.
- Each tap is a **visit** for that link's channel; a typed code is a "Post code" visit.
- The creator: **Share** (L2/L3), **Where to share what** (L4), **Store and collection links** with visits
  (L5), a post's **Stats** (L6). The Create tab gains the links card and each post's code (L1).
- The brand: the **posts made for a set** with codes and numbers, and **Copy all codes** (L7/L8).

## What exists today (survey 29 Sep) and what Level 4 does with it

| Exists | Level 4 |
|---|---|
| API-host redirects `/s/:handle`, `/b/:id`, `/p/:id` (product), `/o/:id` logging to `link_clicks` | Left for old links. The new links live on **inflx.in** (the website), where nothing answered `/s`, `/p`, `/c` before. |
| `link_clicks` (handle, 4 ids, IP, user agent) | Not reused: the new `link_visits` records the kind, channel and target, **no IP** (privacy). |
| Handle changes rename `influencers.instagram_handle`; old handles are not kept | Every handle she has had is kept (`store_handles`, filled by a database trigger). |
| Posts (Level 3) with no code; collections with no link | Codes at approval; collection codes at creation; backfilled for any already there. |
| `platform_settings` + the admin Platform settings page | New setting **link_channel_window_days** (30, 1–90) on the same page. |

## Decisions taken in building (founder delegated; recorded here, surfaced in the build summary)

| # | Decision | Why |
|---|---|---|
| D1 | **Post code alphabet:** B C D F G H J K M N P Q R S T V W X Y Z and 2–9 (28 characters). No vowels (a code never spells a word); no 0/O, 1/I or L. Stored in capitals, typed in any case. Unique in the database; assigned at approval, never changes, even after the post leaves the shop. | 4.14 code rules. 28⁶ ≈ 480 million codes. |
| D2 | **Collection link code:** the same alphabet, assigned when the collection is made. | 4.14. |
| D3 | A link with **no ending** counts as Other. An unknown ending also counts as Other. | Every ending opens the same thing. |
| D4 | **Visits:** one row per tap. Link previews and crawlers (WhatsApp, Facebook, X, Telegram, Slack, bots) are not counted. Web visits keep no IP and no identity. The admin-only "real source" is the Referer's host when it differs from the ending. | 4.14 tracking; privacy. |
| D5 | **Which channel an order counts under** (latest tap on that creator's links within the window, else "In INFLX") is stored with each order through a post (`follower_transactions.link_channel`). Orders through posts arrive with the shopper app, so today every order line reads "In INFLX" or there are none. Each tap stores its own window end, so changing the setting applies to new taps only. | 4.14; backend-first. |
| D6 | **Handle history:** a trigger records every handle an influencer has had; `/s/<old>` opens her store under her current handle. | 4.14 point 3. |
| D7 | **What a link opens until the shopper app** (O4/O8): a plain INFLX web page. A live post shows what it is (title, creator, brand, offer, products, cover) and "Shop it in the INFLX app"; before the posting date "This post goes live on 20 Oct" with her store; a removed or unknown post "This post is no longer available" with her store; the store shows her live posts and collections; a collection shows its items; a hidden or deleted collection says so, with her store. No shopping on the web. Opening the app from a link needs the next Play Store build (4.14) — not in Level 4. | No old link is a dead end. |
| D8 | **Share** appears from approval (L1, L3), **Stats** once live (L1). Each item has Copy (the clipboard already in the app); each link also opens the phone's Share sheet. "Follower view" opens the link itself. | L2–L3. |
| D9 | **Brand (L7):** the set's approved and live posts, each with its code, visits, orders, sales, commission; the set's totals (orders, commission, the INFLX fee, what the brand receives) from sales through posts. **Copy all codes** lists live posts only (L8). Entry: the set screen → Posts. Tapping a post opens its channel breakdown (the L6 screen, brand side). | L7–L8. |
| D10 | **Admin:** the channel window is an ordinary platform setting. Visit reports for admin are not drawn and not built; the rows keep what they need. | 4.14. |
| D11 | **Not in Level 4:** the shopper app's code search and "Have a post code?" box (the lookup endpoint is built for it), opening the app from a link, checkout labelling orders by channel (needs the shopper app), admin visit reports. | Later. |
