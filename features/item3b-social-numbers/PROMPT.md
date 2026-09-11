# INFLX — Item 3b: Social Numbers (Instagram and YouTube through Apify)

You are working in the INFLX codebase, which contains:

- the backend (Node, `backend/src/**`, with SQL migrations in `backend/migrations/**` and scheduled jobs in `backend/src/jobs/**`);
- the Brand and Creator phone apps (`Packages/Mobile`);
- the brand website and admin website, which share the same backend.

Three files come with this prompt:

1. **`INFLX_Master_Business_Rules_Phase_1_v1.12.docx`**: the business rules.
   - **Main section for this item:** **2A (Creator Social Numbers, new)**.
   - **Related sections:** 8A (pitch settings use followers and engagement) and 5A (groups show creator numbers).
2. **`INFLX_Item3b_Social_Numbers_Mockups.html`**: the **locked** mockups. Open it in a browser.
   - **S1–S5:** Brand app.
   - **R1, R3–R6:** Creator app.
   - The rules table at the bottom of the file.
3. **This prompt.**

**Order of authority:** rules doc → mockups → this prompt. If two of them disagree, stop and ask. Never guess.

> **Work in four phases. Stop after Phase 1** and wait for approval before changing code, running migrations or writing data.
>
> Phase 1 may start a **small number of real Apify test runs** against public accounts, to confirm what the actors actually return (§7.2). Do not write their results to production tables.

---

## 0. How to work

- **Read the real repo.** Item 3 was built just before this item. Its gap report (`Docs/ITEM3_DISCOVERY_GAP_REPORT.md`) is a guide, but the code is the truth. Cite **`file:line`** for every claim.
- **Migrations:** additive only. Check the next free migration number yourself.
- **Server enforcement:** every rule here is enforced on the server. The apps also check, but the server is required.
- **Don't break existing readers.**
  - Item 3's Discover and creator profile, item 2's eligibility checks (minimum followers, minimum engagement), and the brand website's creator search all read `influencers.followers_count`, `youtube_subscribers`, `engagement_rate`, `scrape_last_run` and `youtube_scrape_last_run`.
  - List every reader, and keep them working (§3.7).
- **Phone apps:** they ship over the air. Flag any new native module; none should be needed.
- **Apify spend:**
  - Phase 1 probe runs: at most **12 runs** and **US$3 in total**. Report the actual cost.
  - Later phases: every run logs its cost (§3.3).
- **Tests:** record the backend test baseline (pass and fail counts) before any change. Item 3 must end with **no new failures**.

### Words: rules doc vs code

| Rules doc / mockups say | Code says (verify) |
|---|---|
| Creator | `influencer` |
| Approved creator | `users.status = 'approved'` |
| Instagram followers / YouTube subscribers / Instagram engagement | `influencers.followers_count` / `youtube_subscribers` / `engagement_rate` |
| Last measured | `influencers.scrape_last_run`, `youtube_scrape_last_run` (item 3 exposes `measured_at` as the greater of the two) |
| Handles | `influencers.instagram_handle`, `youtube_handle` |
| Admin approves a creator | `POST /admin/creator-verifications/:id/verify` (`creatorVerification.controller.js`) |

---

## 1. Aim of this item

### 1.1 In one sentence

INFLX automatically measures every approved creator's **public Instagram and YouTube numbers** through **Apify**, keeps them fresh on a schedule, calculates simple honest averages and engagement, and shows them to brands and creators **exactly as in the locked mockups**.

### 1.2 What this item delivers

1. **A measurement pipeline.**
   - **Triggers:** admin approval, the schedules (profile numbers every 7 days, posts every 15 days), an admin-confirmed handle change, and a creator's "Check again".
   - **Mechanics:** Apify runs, storage of every post, per-run snapshots, cost logging, retries and an admin flag.
2. **Calculations.**
   - **Instagram:** averages and engagement based on followers.
   - **YouTube:** long videos and shorts **separately**, with engagement based on **views**.
   - **Streams and edge cases:** live streams are left out, and hidden likes and empty windows are handled.
3. **An ownership check on handle changes.** A changed or newly added handle after approval waits for admin, and is measured only after admin confirms it.
4. **Display.**
   - **Brand app:** platform cards on the creator profile (S1), Instagram details (S2), YouTube details (S3) and every card state (S4). Discover cards (S5) show the refreshed numbers.
   - **Creator app:** registration accounts step (R1), the "Your numbers" row (R3), the Your numbers screen (R4), every state (R5), and handle change (R6).
5. **A minimal admin tool** so admin can confirm or reject changed handles, see flagged measurement problems, and trigger "Measure now".

### 1.3 Why it matters

- **Discover:** filters, sorting and cards (item 3) depend on these numbers.
- **Pitch settings:** item 2's minimum followers and minimum engagement depend on them too.
- **Later picker:** item 5's creator picker will reuse them.

Today the numbers are captured once at sign-up, never refreshed, and YouTube has never been measured.

### 1.4 Out of scope

- Top posts or top uploads (later version).
- Growth charts (the snapshots are stored now, but not shown).
- Code-in-bio ownership check.
- Platforms other than Instagram and YouTube.
- Creator notifications.
- Brand website screen changes.

---

## 2. Current state to verify (from the item 3 gap report)

Confirm each point and give `file:line`:

1. **Instagram followers and engagement** are written only at registration (`influencer.controller.js` ~275–303) and by an admin rescrape (~1179–1225).
2. **YouTube subscribers** come from `refreshYouTubeStats` (~99–121), which returns early when not configured. YouTube was measured for 0 of 25 creators.
3. **No scheduled refresh exists** (`jobs/index.js` ~44–98). An existing Apify job writes `deliverable_stats` for campaign deliverables. Find the Apify client, token env var, actor ids, run mode (sync, async, webhook or polling) and error handling it uses.
4. **Measurement timestamps** exist on 3 of 25 creators.
5. **Registration:** how registration collects handles today, and exactly where it triggers measurement.
6. **Admin approval:** how admin approves a creator today, and whether there is any hook after approval.
7. **Handles:** how handles are normalised today, at registration and on edit.

---

## 3. Pipeline requirements

### 3.1 Accounts and states

**One account per creator per platform** (`instagram`, `youtube`), with the current state below. A creator can have one or both.

| State | Meaning | Numbers shown? |
|---|---|---|
| `not_added` | No handle for this platform | — |
| `waiting_approval` | Creator not approved yet. **Nothing is measured.** | No |
| `waiting_check` | Handle changed or added after approval; waiting for admin to confirm ownership | No (old numbers already removed) |
| `rejected` | Admin rejected the changed or added handle | No |
| `measuring` | First measurement for this handle is queued or running, **or** earlier attempts failed and there are no good numbers yet | No |
| `ok` | Has good numbers. **Includes 0 posts in 90 days.** A background refresh does not change the state. | Yes |
| `not_found` | Last run: the account doesn't exist | No |
| `private` | Last run: the account isn't public | No |
| `failing` | Good numbers exist, but the most recent refresh failed for a technical reason | Yes (last good numbers, with their date) |

**Transitions:**

- **Creator approved** → every added handle becomes `measuring` and a **full run** (profile + posts) is queued.
- **Handle changed or added** by an approved creator:
  - Clear that platform's current numbers straight away (§3.7).
  - The account becomes `waiting_check` and appears in the admin queue.
  - **Admin confirms** → `measuring` + full run.
  - **Admin rejects** → `rejected`.
- **Handle removed:** allowed only if the other platform still has a handle. The account becomes `not_added` and its numbers are cleared. No admin check.
- **Run results:**

  | Result | State |
  |---|---|
  | Success | `ok` |
  | Account missing | `not_found` |
  | Account not public | `private` |
  | Technical failure, good numbers exist | `failing` |
  | Technical failure, no good numbers yet | stays `measuring` |

- **Failures:** a technical failure retries the **next day**. After **3 failures in a row**, admin is flagged. Any success resets the counter.
- **Suspended creator:** scheduled runs pause and nothing changes on screen. **Re-approved:** the schedule resumes. **Rejected creator:** no runs.

### 3.2 When runs happen

| Trigger | Run type | Rule |
|---|---|---|
| Admin approves the creator | Full | Once per added handle |
| Admin confirms a changed or added handle | Full | — |
| Profile schedule | Profile only | `last_profile_at + 7 days` |
| Posts schedule | Posts only (the whole 90-day window) | `last_posts_at + 15 days` |
| Creator taps "Check again" | Full | Only in `private` or `failing`. At most **once per 24 h per platform** (server-enforced, `429` "You can check again once a day."). |
| Admin "Measure now" | Full | No limit |
| Retry after a technical failure | Same type as the failed run | Next day |

**Rules for every run:**

- A full run counts as both a profile run and a posts run. It resets both due dates.
- **Scheduler:** a job (existing jobs pattern, e.g. hourly) picks due accounts with row locking so no account runs twice at once.
- **Limits:** per-tick batch size and concurrent Apify runs (e.g. 3) are configurable.
- **Staggering:** due dates follow each creator's own approval date, so runs spread out naturally.
- **Budget guard:** configurable monthly Apify budget (e.g. `APIFY_MONTHLY_BUDGET_USD`).
  - When reached, **scheduled** runs stop and admin is flagged.
  - Approval, handle-confirm and admin "Measure now" runs still go.

### 3.3 Apify runs

**Use the Apify integration already in the backend** (client, token, run pattern). Suggested actors are below. In Phase 1, confirm what's configured and what each actor really returns (§7.2).

| Need | Suggested actor and input |
|---|---|
| Instagram profile | `apify/instagram-profile-scraper` → followers, following, total posts, verified, account type (business or creator, if available), private flag, not-found signal |
| Instagram posts, last 90 days | `apify/instagram-post-scraper` with `onlyPostsNewerThan` = 90 days before the run, and a results limit = the safety ceiling (§3.5) → id, type, `productType`, timestamp, likes (`-1` when hidden), comments, views (`videoPlayCount` / `videoViewCount`), url |
| YouTube channel totals | Cheapest way to get subscribers, total videos and total channel views for the weekly profile run (for example the channel data returned with a 1-result run). Propose it. |
| YouTube uploads, last 90 days | `streamers/youtube-scraper` on the channel URL with `oldestPostDate` = 90 days before the run and `sortVideosBy = NEWEST`. See the tab rule below. |

**Telling long videos from shorts.** Label every upload by the tab it came from. Two options:

- **Two runs:** a **Videos-tab** run (`maxResults` = ceiling, `maxResultsShorts = 0`, `maxResultStreams = 0`) and a **Shorts-tab** run (`maxResults = 0`, `maxResultsShorts` = ceiling, `maxResultStreams = 0`).
- **One run:** only if the output reliably marks each item's tab.

Record the tab on each stored upload.

- **Fallback, only when the tab is unknown:** duration ≤ 180 seconds = short, otherwise long video.
- **Live streams:** never counted. Exclude them by input, and drop any item marked live or stream in the output.

**For every run, store:**

- account, run type, Apify actor and run id;
- start and finish times, result (`success`, `not_found`, `private`, `technical_failure`) and the error;
- **cost** (the run's usage in USD from Apify);
- items received.

**Mechanics:**

- Timeouts are configurable.
- Webhook or polling, following the existing pattern.
- A webhook endpoint (if used) must verify a secret.
- Runs are idempotent: re-processing the same Apify run changes nothing.

**Handle normalisation (server):**

- **Instagram:** strip "@", `instagram.com/` URLs and trailing slashes; lower-case; 1–30 characters of letters, numbers, "." and "_".
- **YouTube:** accept `@handle`, `youtube.com/@handle`, `m.youtube.com/@handle`, `youtube.com/channel/UC…`, `youtube.com/c/…`. Store the canonical channel URL plus the handle. Once a run resolves the channel id, store it.

### 3.4 Storage

Propose tables following repo conventions. They must hold:

- **Account:**
  - creator, platform, handle as entered, normalised handle, platform account id or channel id;
  - state, ownership check (pending / confirmed / rejected, who, when);
  - `last_profile_at`, `last_posts_at`, `profile_due_at`, `posts_due_at`;
  - failure count, last error, `last_check_again_at`.
- **Profile snapshot per run (history):**
  - **Instagram:** followers, following, total posts, verified, account type.
  - **YouTube:** subscribers, total videos, total channel views.
- **Post per platform post id (upserted):**
  - account, type (`reel` / `photo` / `carousel` · `long` / `short`), tab source (`tab` or `duration_fallback`);
  - published at, duration (YouTube);
  - likes (**null when hidden**), comments (null when disabled), views (null when not available);
  - url, `first_seen_run`, `last_seen_run`.
- **Calculated numbers per posts run (history) and the current set per account:** every number in §3.6, the window start and end, and the counts used (e.g. hidden-likes count).
- **Run log** (§3.3).
- **Admin flags:** 3 failures in a row, budget reached, safety ceiling hit.

When a handle changes, posts and snapshots from the old handle stay in history but are **never used** for the new handle's numbers.

### 3.5 Window and ceiling

- **Window:** posts published in the **90 days before the posts run** (`window_start = run time − 90 days`). Old pinned posts fall outside it by date.
- **Safety ceiling:** 500 items per platform (and per YouTube tab) per run. If reached, use the newest 500 and flag admin.

### 3.6 Calculations (exact)

**Instagram** (posts in the window, de-duplicated by post id):

| Number | Rule |
|---|---|
| Posts in 90 days | Count |
| Posts per week | count ÷ (90 ÷ 7), one decimal |
| Mix | Reels (`productType = clips`, or video. Confirm the mapping in Phase 1.) · Photos (image) · Carousels (sidecar) |
| Last post | Latest published date in the window. Hidden when the count is 0. |
| Avg likes | Mean over posts whose likes are visible. **Null** if none are visible. |
| Hidden-likes count | Posts whose likes are hidden |
| Avg comments | Mean over posts with comments available. Null if none. |
| Avg reel views | Mean over reels with views. Null if there are no reels. |
| Engagement | (avg likes + avg comments) ÷ **latest followers** × 100, one decimal. **Null** if the count is 0, followers is 0 or null, or avg likes is null. Recalculated after every profile run and every posts run. |

**YouTube.** Calculate separately for **long videos** and for **shorts** (uploads in the window, streams excluded):

| Number | Rule |
|---|---|
| Count in 90 days | Per type |
| Avg views | Mean over uploads with views |
| Avg likes | Mean over uploads with visible likes. Null if none. |
| Avg comments | Mean over uploads with comments enabled. Null if none. |
| Engagement | (Σ likes + Σ comments) ÷ Σ views × 100, one decimal, over uploads of that type with visible likes and views > 0 (disabled comments count as 0). **Null** if there are no such uploads. |
| Uploads in 90 days (total), uploads per week, last upload | Across both types |

**Display formatting (all screens):**

- **Numbers:** under 1,000 in full (`612`); thousands as `48.2K`; millions as `2.3M` (one decimal).
- **Percentages:** one decimal (`4.2%`).
- **Empty:** "—" whenever a number is null. **Never show 0 for an empty average.** A count of 0 shows "0".
- **Dates:** `9 Sep`. Add the year when it isn't the current year.
- **Window label:** `{window start} – {run date}`, for example "12 Jun – 9 Sep".

### 3.7 Keep existing readers working

After every successful run, write the current values through to the existing columns:

| Existing column | Value |
|---|---|
| `influencers.followers_count` | Instagram followers |
| `influencers.engagement_rate` | Instagram engagement |
| `influencers.youtube_subscribers` | YouTube subscribers |
| `influencers.scrape_last_run` | Instagram profile time |
| `influencers.youtube_scrape_last_run` | YouTube profile time |

**When a handle is changed, added, removed, or goes `not_found`, `private` or `rejected`:** set that platform's columns to null, so Discover shows "—" and follower and engagement filters exclude the creator. Check constraints and every reader first, and report any that can't take null.

**The measurement at registration and the old admin rescrape** must be removed or rerouted to the new pipeline. Nothing may write these columns except the pipeline.

### 3.8 Backfill for existing creators

On release:

- Queue a **full run** for every approved creator with at least one handle.
- Spread the runs over a configurable number of days so the budget and concurrency limits hold.
- Existing values stay until each creator's first new run replaces them.
- Pending creators get nothing until they are approved.

---

## 4. API requirements

Follow existing naming. Propose shapes and error codes in Phase 1.

| ID | Endpoint (purpose) | Screens |
|---|---|---|
| A1 | **Creator profile for a brand** (extends item 3's `GET /v1/influencers/:id`): see below this table. | S1, S4 |
| A2 | **Platform detail for a brand:** every §3.6 number for Instagram or YouTube, the window, dates, hidden-likes count and handle link. Approved creators only. Returns only the brand state label, never the internal reason. | S2, S3 |
| A3 | **Your numbers (creator):** both platforms with the **full internal state**, card numbers, `last_profile_at`, `last_posts_at` and `posts_due_at`, plus the row chip for R3. Detail endpoint with the same data as A2. | R3, R4, R5 |
| A4 | **Check again (creator):** `POST` per platform. Allowed only in `private` or `failing`, and once per 24 h. Returns the new state. | R5 |
| A5 | **Handle change (creator):** see below this table. | R5, R6 |
| A6 | **Registration:** validates handles (at least one; format) and saves them normalised. **Queues nothing.** | R1 |
| A7 | **Admin:** see below this table. | Admin |
| A8 | **Apify webhook** (if used) and internal job endpoints: secret-verified, never public. | — |

**A1 · Creator profile for a brand**

- **Adds:** `social.instagram` and `social.youtube`, each `null` when not added.
- **Each contains:** the brand-facing state (`ok` | `updating` | `unavailable` | `stale`), handle, verified, account type label, the three card numbers, and `updatedAt`.
- **Brand-facing state mapping:**

  | Internal state | Brand sees |
  |---|---|
  | `waiting_check`, `measuring` | `updating` |
  | `not_found`, `private`, `rejected` | `unavailable` |
  | `failing` | `stale` (last good numbers + date) |
  | `waiting_approval` | Never shown (creator isn't visible) |

**A5 · Handle change (creator)**

- **Via:** the existing profile update, or a dedicated endpoint.
- **Change or add:** after approval → clear numbers → `waiting_check`.
- **Remove:** → `not_added`, only if the other platform remains.
- **Before approval:** handle edits just save.

**A7 · Admin**

- **Pending handle checks:** creator, platform, old handle, new handle, with links to open both accounts. **Confirm** / **Reject**.
- **Measurement flags:** failures, budget, ceiling.
- **Measure now**, per account.
- **Costs:** this month's Apify spend, per platform.

**Privacy.** All numbers are public data. Even so:

- Brands never receive pending creators, internal states, error reasons, ownership decisions, run logs or costs.
- Creators never receive other creators' data.

---

## 5. Screens and exact copy

Match the mockups screen by screen. Copy is exact. `{…}` are values.

### 5.1 Brand app

**S1 · Creator profile (replaces item 3's handle tags on P1)**

- **Top stats:** the top three stats stay as locked: Instagram followers, YouTube subscribers, Engagement (Instagram), then "Measured by INFLX · updated {latest profile date}".
- **One card per added platform:**
  - **Header:** platform icon, `@handle` (+ blue verified tick if verified). Subtitle "Instagram · {account type}" (just "Instagram" if the type is unknown) or "YouTube". Chevron → detail.
  - **Instagram card:** `{engagement}` "Engagement" · `{avg reel views}` "Avg reel views" · `{count}` "Posts in 90 days".
  - **YouTube card:** `{avg long views}` "Avg video views" · `{avg shorts views}` "Avg shorts views" · `{count}` "Uploads in 90 days".
- **No card** for a platform that isn't added.

**S2 · Instagram details**

- **Header:**
  - Bar: "Instagram".
  - Account header: `@handle` + tick, "{Account type} account · {creator name}", and an **Open** button that opens the account in Instagram.
- **PROFILE:** Followers · Following · Total posts.
- **LAST 90 DAYS** `{window}`:
  - **Engagement** (green tile) and "{count}" "Posts · {per week} a week".
  - Mix bar with legend "{n} reels", "{n} photos", "{n} carousels", and "Last post {date}".
  - Avg likes · Avg comments · Avg reel views.
- **Formula box:** "Engagement = average likes + comments per post ÷ followers." Add "{n} posts hide likes and aren't in the likes average." only when n > 0. With 1: "1 post hides likes and isn't in the likes average."
- **Footer:** "Measured by INFLX · followers {date} · posts {date}".

**S3 · YouTube details**

- **Header:**
  - Bar: "YouTube".
  - Account header: `@handle`, "{channel name} · channel", **Open**.
- **CHANNEL:** Subscribers · Total videos · Total views.
- **LAST 90 DAYS** `{window}`: "{total} uploads · {per week} a week", "Last upload {date}".
- **LONG VIDEOS** "{n} in 90 days": Engagement (green tile) · Avg views · Avg likes · Avg comments.
- **SHORTS** "{n} in 90 days": the same four tiles.
- **A type with 0 uploads:** its tiles show "—" and the heading reads "0 in 90 days".
- **Formula box:** "Engagement = likes + comments ÷ views, worked out separately for long videos and shorts. Shorts count a view as soon as they play, so their rate is usually lower. Live streams aren't counted."
- **Footer:** "Measured by INFLX · subscribers {date} · uploads {date}".

**S4 · Card states (brand)**

| State | What the card shows |
|---|---|
| 0 posts in 90 days | Engagement "—", Avg reel views "—", Posts "0". Line: "No posts in the last 90 days. Followers: {followers}." |
| `updating` | Blue box with spinner: "Numbers are being updated" / "Check back later." No numbers, no chevron. |
| `unavailable` | Subtitle "Numbers not available". Grey box: "INFLX can't measure this account right now." No numbers, no chevron. |
| `stale` | Normal card, plus "Updated {date}". |

**S5 · Discover card:** unchanged from item 3.

- Numbers come from the refreshed columns.
- Engagement is Instagram only; a YouTube-only creator shows "—".
- A creator measured for the first time right after approval shows "—" until done.

### 5.2 Creator app

**R1 · Registration: "Your social accounts"** (fits into the existing registration steps)

- **Intro:** "INFLX measures your public numbers from these accounts. Brands see them on your profile."
- **Fields:**
  - "Instagram username" (with "@" prefix).
  - "YouTube handle or channel link".
- **Hint:** "Add at least one. Your account must be public. We measure your numbers after INFLX approves your profile."
- **Errors** (§6).
- **Button:** **Continue**, then the existing "approval pending" screen. **No measuring screen.**

**R3 · My Profile → new row "Your numbers"** (between Profile info and Niche & languages)

- **Subtitle:** "Instagram {followers} · YouTube {subscribers}". Use "—" where there's no number; omit a platform that isn't added.
- **Chip:**

  | Condition | Chip |
  |---|---|
  | Any platform `not_found`, `private` or `rejected` | Red **"Fix Instagram"** / **"Fix YouTube"** / **"Fix accounts"** (both) |
  | Otherwise, any `waiting_check` | Blue **"Waiting"** |
  | Otherwise, any `measuring` | Blue **"Measuring"** |
  | Otherwise | No chip |

**R4 · Your numbers (all good)**

- **Info box:** "Brands see these numbers on your profile. Followers update every week; posts every 15 days."
- **Instagram card:** Followers · Engagement · Posts in 90 days. Line: "Followers {date} · posts {date} · next posts update {date}".
- **YouTube card:** Subscribers · Avg video views · Avg shorts views. Line: "Subscribers {date} · uploads {date} · next uploads update {date}".
- **Hint:** "Numbers are read from your public accounts and can't be typed in. To change an account, edit Profile info."
- **Tapping a card** opens S2 or S3 with the same info box on top.

**R5 · States (creator)**

| State | Card content | Action |
|---|---|---|
| `waiting_check` | Blue, spinner: "INFLX is checking this account is yours" / "We'll measure it once it's confirmed. This usually takes up to a day." | — |
| `measuring` | Blue, spinner: "Measuring your {Instagram \| YouTube}" / "This usually takes a few minutes." | — |
| `not_found` | Red: "We couldn't find @{handle} on {Instagram \| YouTube}" / "Check the spelling in Profile info." | **Fix username** → Profile info at that field |
| `private` | Red: "Your {account \| channel} isn't public" / "Brands can't see your numbers until it is." (Instagram: "account"; YouTube: "channel") | **It's public now, check again** + "You can check again once a day." Disabled for 24 h after use. |
| `rejected` | Red: "INFLX couldn't confirm @{handle} is yours" / "Add the account that belongs to you in Profile info." | **Fix username** |
| `failing` | Normal numbers + grey line: "We couldn't refresh your numbers lately. We'll keep trying." | **Check again** (same once-a-day rule) |
| `not_added` | "{Platform}" / "Not added" | **Add {Instagram \| YouTube}** → Profile info at that field |

**R6 · Changing a handle** (Profile info, on save when a handle changed or was added after approval)

- **Sheet title:** "Change your {Instagram \| YouTube} account?"
- **Body:** "Your current {Instagram \| YouTube} numbers will be removed from your profile. INFLX will check @{new handle} belongs to you, then measure it. Brands see "Numbers are being updated" until then."
- **Buttons:** **Change account** (primary) / **Cancel**.
- **Adding a platform for the first time:**
  - Title: "Add your {Instagram \| YouTube} account?"
  - Body: "INFLX will check @{handle} belongs to you, then measure it."
  - Primary button: **Add account**.
- **Removing a handle** (the other platform stays):
  - Title: "Remove your {Instagram \| YouTube} account?"
  - Body: "Its numbers will be removed from your profile."
  - Buttons: **Remove** (danger) / **Cancel**.

### 5.3 States on every screen

- **Loading:** skeleton tiles.
- **Couldn't load:** "Couldn't load these numbers" / "Check your connection and try again." / **Try again**.

### 5.4 Admin (minimal, on the existing admin website)

Use the smallest addition that fits the existing creator verification area. Propose it in Phase 1.

- **Handle checks:** a list of pending handle checks, each with **Confirm** / **Reject**.
- **Flags:** a list of flagged problems, each with **Measure now**.
- **Creator detail:** a per-creator panel showing each platform's state, last runs and **Measure now**.
- **Cost:** a monthly cost figure.

---

## 6. Validation and messages (server and app, same text)

| Field / action | Rule | Message |
|---|---|---|
| Instagram username | 1–30 characters, letters, numbers, "." and "_" (after stripping "@" and URL) | Enter a valid Instagram username. |
| YouTube | `@handle` or a youtube.com channel link | Enter a YouTube handle or channel link. |
| Accounts at registration | At least one | Add at least one account. |
| Removing the last handle | Not allowed | Keep at least one account. |
| Check again | Only `private` / `failing`; once per 24 h per platform | You can check again once a day. |
| Same handle re-entered | No change | (no sheet, nothing happens) |

---

## 7. Phase 1: gap check and Apify probe (read only)

### 7.1 Read and report

For each item, give status **E / P / M / C**, evidence (`file:line`), proposed change and risk:

- **Every requirement in §3–§6.**
- **§2:** everything listed there.
- **Readers:** every reader and writer of the five existing columns (§3.7).
- **Admin:** the existing verification flow, and where §5.4 fits.
- **Registration:** the registration screens and step order, and where R1 fits.
- **Jobs:** the existing jobs runner, locking and config patterns.
- **Theme and components:** the item 3 components and theme that S1–S5 and R3–R6 reuse.

### 7.2 Apify probe (real runs, test data only)

**Run the suggested actors** (or the configured ones) on **public** accounts. The founder may supply test handles; otherwise use well-known public accounts. Cover at minimum:

1. One Instagram account with reels, photos and carousels.
2. One Instagram account known to hide likes, if you can find one.
3. One **private** Instagram account and one **non-existent** username.
4. One YouTube channel with **both long videos and shorts**, ideally with a stream too.
5. One **non-existent** YouTube handle.

**Answer from the real output**, with trimmed sample JSON saved as fixtures under `backend/tests/fixtures/apify/`:

- Exact field names for followers, following, total posts, verified, account type, private.
- How "not found" and "private" appear: output shape, error or empty dataset.
- Instagram post type and reel detection (`type`, `productType`).
- Which Instagram views field matches the number shown in the Instagram app.
- Hidden likes value.
- Whether `onlyPostsNewerThan` limits results correctly.
- YouTube: whether the output marks the tab. Whether two tab-restricted runs are needed.
- YouTube: how streams appear.
- YouTube: likes and comments when hidden or disabled.
- YouTube: where channel totals come from.
- Whether `oldestPostDate` works on channel URLs.
- Handle-to-channel resolution for `@handle` input.
- Run duration and **cost per run** for each actor. Then estimate monthly cost for today's approved creators, and for 1,000 creators on this schedule.

### 7.3 Output

Write **`Docs/ITEM3B_SOCIAL_NUMBERS_GAP_REPORT.md`**:

1. **Summary table:** area · status · one-line gap.
2. **Requirement table:** ID · requirement · status · evidence · proposed change · risk.
3. **Apify probe results:** answers to §7.2, fixture list, costs and monthly estimates.
4. **Proposed migrations** (additive), with dry-run checks.
5. **Proposed services and jobs:** scheduler, run processor, calculators, state machine, budget guard.
6. **Proposed endpoints:** A1–A8, with shapes, error codes and affected callers.
7. **Existing-column plan** (§3.7), and removal or rerouting of the registration measurement and the old rescrape.
8. **Frontend plan per app,** plus the minimal admin plan.
9. **Test baseline,** and the tests to add.
10. **Questions for the founder,** each with a recommendation. Include the assumptions in §7.4 and anything the probe changes.

Then **stop and wait for approval.**

### 7.4 Assumptions to confirm in your questions

1. **Instagram engagement** is "—" when every post hides likes, rather than a comments-only rate.
2. **Adding a platform after approval** needs the admin ownership check, the same as a change.
3. **Removing a handle** needs no admin check, provided the other platform stays.
4. **Existing columns** are cleared to null on change, add, remove, `not_found`, `private` and `rejected`.
5. **Backfill** is spread over N days (propose N).
6. **Budget guard** amount and behaviour.
7. **Safety ceiling:** 500 items.
8. **Copy not shown in the mockups:** the creator `rejected` and `failing` states, the add and remove handle sheets, and the "Fix accounts" chip.
9. **YouTube detection:** two tab-restricted runs versus one run.
10. **Admin tool location** on the admin website.

---

## 8. After approval (not in Phase 1)

- **Phase 2, backend and database:** migrations, account and state machine, scheduler, Apify runs and processing, calculators, write-through, budget guard, admin flags, endpoints A1–A8, backfill job, and removal of the old measurement paths.
- **Phase 3, apps and admin:** S1–S4 (S5 needs only data), R1, R3–R6, the detail screens from the creator side, and the minimal admin tool.
- **Phase 4, tests and live verification.**

### 8.1 Automated tests

- **Calculators:** from the probe fixtures, plus hand-made cases:
  - hidden likes (some and all);
  - 0 posts;
  - no reels;
  - YouTube long and shorts split, a stream excluded, and the duration fallback;
  - disabled comments;
  - views 0;
  - rounding and formatting (612, 48.2K, 2.3M, 4.2%, "—").
- **State machine:** every transition in §3.1, including suspended, re-approved and rejected creators.
- **Scheduler:**
  - due dates after a full run, a profile run and a posts run;
  - no double runs under concurrency;
  - retry next day, and the flag after 3 failures;
  - the budget guard stops scheduled runs but not approval runs.
- **Runs:** idempotent re-processing; webhook secret; cost logged.
- **API:**
  - brand responses map states and never leak internal states, reasons, costs or pending creators;
  - "Check again" is allowed only in `private` / `failing`, with `429` inside 24 h;
  - handle change, add and remove flows;
  - registration queues nothing.
- **Write-through:** the five existing columns update after success and clear on change, add, remove, `not_found`, `private` and `rejected`. Item 2 eligibility and item 3 Discover return correct results afterwards.
- **Apps:** render tests for every state in S4 and R5, and for the formatting.

### 8.2 Live verification (real accounts, staging or production with care)

Use founder-provided test creators, at least one Instagram and one YouTube account with both shorts and long videos.

1. **Approval runs:** approve a test creator. Runs start, the states go `measuring` → `ok`, and numbers appear in S1 and R4.
2. **Profile numbers:** Instagram followers and YouTube subscribers match the platform apps (within display rounding).
3. **Instagram by hand:** count one Instagram account's posts in the last 90 days, and recompute its engagement from the stored posts. Both must match S2.
4. **YouTube by hand:** check one channel's long-video and shorts counts against its Videos and Shorts tabs. Recompute both engagements by hand. They must match S3. Streams must not be counted.
5. **Schedule:** move the test account's due dates into the past and run the scheduler. A profile run, then a posts run, happen and the dates update.
6. **Handle change:**
   - Changing a handle shows R6, then `waiting_check`.
   - Brands see "Numbers are being updated" and the Discover card shows "—".
   - Admin confirms → numbers return.
   - Admin rejects → the `rejected` copy shows.
7. **Private account:** R5 private state; brand sees "Numbers not available"; "Check again" works once and then shows `429` copy.
8. **Wrong username:** `not_found` → Fix username → change → admin check.
9. **Screenshots on a real phone:** S1, S2, S3, S4 (each state), R1, R3 (each chip), R4, R5 (each state), R6.
10. **Costs:** the run log and cost total match the Apify console for the test runs.

### 8.3 Final checks: all must pass

1. **Registration** saves handles with at least one account, shows the right format errors, and queues **no** Apify run.
2. **Approval** queues a full run per added handle. Pending creators are never measured.
3. **Instagram numbers** match §3.6 on the fixtures and on a live account.
4. **YouTube split:** long videos and shorts are split by tab; streams are excluded; the duration fallback is used only when the tab is unknown.
5. **YouTube engagement** is calculated on views, per type.
6. **"—" never 0:** empty averages show "—"; 0 posts shows "0" and the S4 line.
7. **Profile schedule:** profile numbers refresh 7 days after the last profile run.
8. **Posts schedule:** posts refresh 15 days after the last posts run, over the whole 90-day window.
9. **Failures:** a technical failure keeps the last good numbers with their date (`stale`) and retries the next day. The third failure in a row flags admin.
10. **Not found / private:** brands see "Numbers not available"; the creator sees the right R5 copy and action.
11. **Check again** works only in `private` / `failing`, once per 24 h per platform.
12. **Handle change or add** after approval clears numbers, goes to admin, and is measured only after Confirm. Reject shows the `rejected` state.
13. **Remove** works only while the other platform stays.
14. **Existing columns** update after success and clear on the events in §3.7. Discover, item 2 eligibility and website search still work.
15. **S1** shows cards only for added platforms, with the exact numbers and labels.
16. **S2 and S3** show every tile, window label, formula text and footer date exactly.
17. **R3 chip** priority is correct: Fix, then Waiting, then Measuring.
18. **R4** shows the measured dates and next update date.
19. **Brand privacy:** brand responses contain no internal state names, error reasons, ownership decisions, costs or pending creators.
20. **Budget guard** stops scheduled runs at the limit and flags admin. Approval and admin runs still go.
21. **Safety ceiling** (500) is honoured and flagged.
22. **Old paths gone:** the old registration measurement and admin rescrape no longer write the columns directly.
23. **Backfill** queues every approved creator with handles, spread over the approved number of days.
24. **Admin** can confirm or reject handles, see flags, run Measure now, and see the monthly cost.
25. **Tests:** backend tests show **no new failures** against the Phase 1 baseline, and the new tests pass.

### 8.4 Final deliverable

A short summary covering:

- what changed: migrations, jobs, services, endpoints, screens, admin;
- the probe findings you relied on;
- test results against the baseline;
- the live verification results with screenshots;
- the measured cost of the test runs, and the monthly estimate;
- anything left open.
