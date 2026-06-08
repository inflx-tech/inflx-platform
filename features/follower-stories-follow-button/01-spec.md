# Feature Spec — follower-stories-follow-button

> Founder request (2026-06-08): the Home influencer carousel should show a
> logged-in follower's **followed** creators + **popular** creators, with a small
> **Follow** button under each not-yet-followed circle. Builds on
> `follower-home-stories-listing`.

## Problem / goal
The Stories carousel now populates (picks/activity-driven). The founder wants it to
behave like a social discovery row for a logged-in follower:
- show followed creators first, then popular creators (already true:
  `creators_listing` orders followed-first + by followers, location-boosted by the
  follower's city);
- under a creator the follower does NOT follow, show a **+ Follow** button; tapping
  follows them (optimistic), then shows "Following".

Role: **follower**.

## Scope
- **In scope**
  - `vibe/StoryCircle.js` — optional **+ Follow** button (logged-in viewer &
    `!is_followed`); optimistic → "Following"; calls `onFollow(story)`.
  - `SectionRenderer.js` — pass `is_followed` + `followers_count` through to the
    creators rail; accept a `canFollow` prop; wire `onFollow → followerApi.follow`.
  - `HomeScreenV2.js` — detect login (token present) → pass `canFollow`.
- **Explicitly out of scope**
  - Location/`is_followed` backend logic (already done: `creators_listing` returns
    `is_followed`; `city = follower.user_city` soft-boost).
  - In-app GPS (deliberately disabled; defaults to Vijayawada — separate later work).
  - The offer-source fix (Phase 3) — "popular with top offers" enrichment lands then.
  - Other screens' carousels (Home only this turn; `canFollow` not passed elsewhere).

## Surfaces touched
- Mobile (follower): `vibe/StoryCircle.js`, `SectionRenderer.js`, `HomeScreenV2.js`.
  `StoryCircle`/`SectionRenderer` changes are additive (new props default off) →
  other screens/uses unaffected.

## Data / contracts
- Uses the existing follow API: `POST /followers/follows {influencer_id}`
  (`followerApi.follow`), already built + authed. `creators_listing` already returns
  `is_followed`. No new endpoint, no migration.

## Non-functional
- Backend-first: Follow button only for a real logged-in follower; `is_followed`
  from the real follow graph; "popular" = real follower-count ranking; location =
  real profile city. No fabrication.
- Optimistic UI: button → "Following" immediately; the API call is fire-and-forget
  with a silent catch (a failed follow simply won't persist; no fake success state
  is written server-side).
- OTA-only (pure JS).
