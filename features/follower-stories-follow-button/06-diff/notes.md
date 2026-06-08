# Before / After — follower-stories-follow-button

## What shipped (3 files)
- `vibe/StoryCircle.js` — optional **+ Follow** button under the circle (logged-in
  viewer & not-followed); optimistic → **Following**; calls `onFollow(story)`.
  `StoryRail` passes `showFollow`/`onFollow` through.
- `SectionRenderer.js` — creators rail now passes `is_followed` + `followers_count`;
  accepts `canFollow`; `onFollow → followerApi.follow(id)`.
- `HomeScreenV2.js` — reads the auth token → `isLoggedIn`; passes
  `canFollow={isLoggedIn}` to `SectionRenderer`.

## Behaviour
- Logged-in: followed creators first, then popular (location-boosted by profile
  city, via the existing `creators_listing` rule); **+ Follow** under non-followed →
  **Following** on tap (optimistic) + `POST /followers/follows`.
- Anonymous: no follow buttons.

## Honest notes
- Set/order/location are unchanged backend behaviour (`creators_listing`): real
  follow-graph, real follower counts, follower's `user_city` soft-boost. In-app GPS
  stays disabled (Vijayawada default).
- Optimistic follow; failed API call silently won't persist — no fake server state.
- "Popular with top offers" enrichment needs the Phase-3 offer-source fix (shelves
  read `brand_offers`, not the empty `campaign_offers`).
- Additive props (off by default) → other screens/uses unaffected.

## Verification
- Babel transform via `module:@react-native/babel-preset`: **3/3 PASS**.
- `pnpm qa`: **GREEN — 79 passed, C1 GREEN** (`qa/reports/2026-06-08T06-56-07-844Z/`).

## Release
**production-impacting** (follower OTA). Maestro founder-side (recorded override).
OTA: `pnpm publish-ota:follower` (v71 → next).
