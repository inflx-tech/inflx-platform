# Reviewing a creator in the admin — the facts they gave us

Founder, 2026-08-26, looking at `/admin/influencers/<id>` for a real pending creator
(@anusha9somepalli, registered the same day):

> right after influencer got registered into our app, we need to approve, that one in admin
> at both tabs at approval and influencers tab the info we are getting is not as
> comprehensive as it is showing. it showing scrape info of instagram..make it for youtube
> also and at approvals clear info we should see like what data they provide....phno,name,
> place,and social media handles...these things not clearly showing pls verify and fix these

## What a creator actually hands us at signup

`Packages/mobile/src/screens/auth/InfluencerRegisterScreen.js` asks for exactly four things,
on top of the phone number the OTP already proved:

| Field | Required | Goes to |
|---|---|---|
| Full name | yes | `users.name` |
| City | no | `users.city` |
| Instagram handle | yes | `influencers.instagram_handle` |
| YouTube channel | no | `influencers.youtube_handle` |
| Phone | (from OTP) | `users.phone` |

Five facts. The admin review screen shows **one and a half** of them: the Instagram handle,
and a phone number. Name, city and YouTube channel are collected, stored, and never shown.

## The five verified faults

### 1. "Where" is always blank for anyone who registered in the app
`influencer.controller.js` `register()` writes the typed city to **`users.city`**
(`UPDATE users SET name = $1, city = COALESCE(...)`) and the `INSERT INTO influencers`
that follows does **not** include `city`. So `influencers.city` is NULL for every
self-registered creator.

Every admin read path then selects `i.city`:
- `influencer.controller.js` `getPublicById` — the creator detail page
- `admin.controller.js` `getInfluencers` — the Influencers list "City" column
- `admin.controller.js` `getInfluencerQueue` — selects no city at all

Result: **"Where: Not stated"** on the detail page and **"--"** in the list, for a creator
who typed her city.

This is the same defect already carved in
`features/backend-defect-onboarded-creator-city-search`. The **search view** was fixed in
migration 146 (`COALESCE(u.city, i.city)`). The **admin read paths were never updated** —
so the defect is only half closed.

### 2. The creator's name is never shown on the review page
`getPublicById` returns both `u.name` and `i.full_name`. The page renders neither — the
header is `@instagram_handle` and nothing else. `register()` also never writes
`influencers.full_name`, so only the `users.name` copy exists.

An admin approving an account cannot see whose account it is.

### 3. The YouTube channel is collected and then invisible
`youtube_handle` is asked for at signup, stored on `influencers`, and returned by
`getPublicById` **and** by the admin list query. No admin screen renders it. There is no
"Open on YouTube" link. The queue query does not even select it.

### 4. The approvals row shows almost nothing
`approvals/page.js` renders: handle, follower count, submitted date. The queue endpoint
already returns `u.phone` and `u.name` — both discarded by the page. City and YouTube are
not in the query at all.

The approvals queue is where the decision is made, and it is the thinnest screen of the three.

### 5. There is no YouTube scraping anywhere
`apify.service.js` exports `scrapeProfile` (Instagram) and `scrapePostEngagement`
(Instagram). The Rescrape button is Instagram-only. `influencers` has no column to hold a
subscriber count. A creator whose real audience is on YouTube reads as **0 followers,
0.00% engagement** — which is what the founder is looking at in the screenshot.

## Fix

**Source** — `register()` writes `full_name` and `city` onto `influencers` as well, so new
rows are correct at the point of creation.

**Reads** — every admin path resolves `COALESCE(i.city, u.city)` / `COALESCE(i.state, u.state)`
/ `COALESCE(i.full_name, u.name)`, so the ~existing rows that predate the source fix read
correctly too. Fixing only the source would leave every creator registered before today blank.

**Screens** — all three admin surfaces show the five facts the creator gave us: name, phone,
place, Instagram, YouTube.

**YouTube reach** — a real subscriber/view/video count, scraped through **Apify**, the same
way Instagram already is (founder, 2026-08-26: "what we are doing for youtube and instagram
data is using apify scraper for now so we dont want any youtube api for now"). Same
`APIFY_TOKEN`, same `APIFY_MOCK` switch, same run-sync call; only the actor differs. Stored
in new columns, refreshed by the same Rescrape button, shown next to the Instagram numbers.
When the scrape has not run, or ran and returned nothing readable, the screen says so
plainly rather than showing a confident zero — the same rule `admin-account-review` item 4
set for never-scraped Instagram figures.

## Out of scope
- The brand approval row (brands were fixed in `admin-account-review`; only the shared
  approvals row markup changes, and it changes for both).
- YouTube *post* engagement (the per-post equivalent of `scrapePostEngagement`).
- Backfilling `influencers.city` / `full_name` for existing rows — the COALESCE reads make
  that unnecessary, and a data migration is a bigger, riskier gate.
