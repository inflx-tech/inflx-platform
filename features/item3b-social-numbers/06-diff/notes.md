# item3b-social-numbers — before / after

**Before:** the founder's locked mockups (`04-preview/mockups/item3b-social-numbers-locked.html`).
**After:** the screens as built, verified by render tests and a live end-to-end run against the local
database with real Apify. No device was available in this session, so there are no phone screenshots;
the render tests pin every state's copy and the live run pins every number (below).

## Screen by screen

| Mockup | Built as | Differences from the mockup |
|---|---|---|
| S1 Creator profile with platform cards | `BrandCreatorProfileScreen` + `PlatformCard` (brand mode) | Handle tags replaced by the cards, as specified. Open Instagram / Open YouTube buttons from item 3 stay at the bottom. |
| S2 Instagram details | `SocialDetailScreen` | None. Mix bar drawn with flex widths; legend "■ 11 reels" etc. |
| S3 YouTube details | `SocialDetailScreen` | None. |
| S4 Card states | `PlatformCard` | None. "—" never 0; 0 posts shows "0" and the followers line. |
| S5 Discover card | unchanged (item 3) | Numbers come from the refreshed columns; K/M now always one decimal (mockup's "22.0K"). |
| R1 Registration | `InfluencerRegisterScreen` | Two steps with a 2-bar stepper (founder Q16); the YouTube field takes a handle or link, so it has no "@" prefix. |
| R3 Your numbers row | `ProfileScreen` + `SocialChip` | None. |
| R4 / R5 | `YourNumbersScreen` + `PlatformCard` (creator mode) | A `waiting_approval` card (creator not yet approved) reuses the R1 hint sentence; not in the mockups, which only show approved creators. |
| R6 Handle change | `ProfileInfoScreen` + item 2 `ConfirmSheet` | Instagram unlocked (founder Q17). One sheet per changed platform, in order. |
| Admin | `admin/influencers/[id]` panel + Measure now; `admin/influencers?tab=handles`; Analytics cost line | Minimal, as approved (Q15). |

## Live end-to-end run (2026-09-11, local `inflx_dev`, real Apify, test creator @_akshayareddyyy / @lakkireddyakshayareddy-30)

| Step | Result |
|---|---|
| a) Register (both accounts) | 201; five number columns NULL; two accounts `waiting_approval`; **0 runs**; `claim.scrape_fired: false`; n8n not called (call removed, `N8N_BASE_URL` unset) |
| b) Admin approve | both accounts `measuring` / ownership confirmed at once; both runs started; **settled to `ok` in 88 s** |
| c) Numbers | Instagram: 192,097 followers · 105 posts in 90 days (81 reels, 2 photos, 22 carousels) · 2 hide likes · avg likes 165,042.8 · avg comments 277.7 · avg reel views 3,382,932.9 · **engagement 86.1%**. YouTube: 52,000 subscribers · 7 uploads (3 long, 4 shorts) · long engagement **1.5%**, shorts **2.5%**. **Hand recomputation from the stored posts matched the API to the decimal on every number.** Legacy columns written (`followers_count 192097`, `engagement_rate 86.10`, `youtube_subscribers 52000`, both timestamps). |
| d) Brand views | S1 cards `ok`; S2/S3 detail payloads complete; Discover row carries 192.1K / 52.0K / 86.1% |
| e) Creator views | `/influencers/me/social` both `ok`, chip null; detail payloads complete |
| f) Handle change | YouTube → fake handle: YouTube columns NULL immediately, account `waiting_check`, brand `updating`, chip `Waiting`; admin queue lists old + new; Confirm → measured in 16 s → **`not_found`**, brand `unavailable`, creator R5 not-found state; changed back → `waiting_check` → Confirm → `ok` again in 88 s, subscribers restored |
| g) Schedule | profile due moved to the past → tick ran **2 profile runs**; posts due moved → tick ran **2 posts runs** (`instagram:posts $0.2808`, `youtube:posts $0.0053`); due dates advanced by 7 / 15 days |
| h) Legacy columns | updated after every success (followers 192,097 → 192,107 after the refresh), cleared during the handle change |

**Cost of the end-to-end run:** 8 pipeline runs, US$0.58 recorded in the run log (the two profile runs show US$0 because Apify had not yet posted their usage when the run finished — the budget guard reads the account total from Apify, not the run log). Apify account usage moved from US$0.41 (after the probe) to **US$1.14** for the month. **Total spent by me today: probe US$0.30 + e2e US$0.73 ≈ US$1.03** (cap US$3). Prior spend on the account before today: US$0.11.

## Test results
- Item 3b: backend 2 suites / 30 tests pass; mobile 2 new suites / 21 tests pass; all 74 mobile tests pass (items 2, 3, 3b).
- Backend whole suite, first run after the 3b backend changes: 233 failed / 895 passed / 1128 — 30 new tests all passing; **4 old tests newly failing, all rule drift** (registration used to measure via the mock fixture: `influencer-search` filters ×3 relied on fixture followers/niche; `admin-creator-review` asserted YouTube numbers at registration). Updated to the new rule: the search tests now write the numbers as the pipeline would after approval; the review test asserts nothing is measured before approval and the accounts wait.
- Backend whole suite, final run: **229 failed / 899 passed / 1128** — 0 new failures vs the item 3 baseline (229 / 869 / 1098), 30 new tests all passing, suites 47 failed / 110.

## Website side effects (no website screen changed)
- Registration API: at least one handle; Instagram may be null; no measurement at sign-up.
- Admin CSV import no longer writes followers / engagement.
- Creator numbers everywhere (website search included) are NULL until the pipeline measures them; after release every existing creator shows "—" until the backfill runs.
