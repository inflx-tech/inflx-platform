# Expected Outputs — follower-stories-follow-button

## Files
- `Packages/Mobile/src/components/vibe/StoryCircle.js` — +Follow / Following button.
- `Packages/Mobile/src/components/SectionRenderer.js` — pass is_followed +
  followers_count; `canFollow` prop; `onFollow → followerApi.follow`.
- `Packages/Mobile/src/screens/follower/HomeScreenV2.js` — login detection +
  `canFollow`.

## Acceptance checks
1. Logged-in follower sees **+ Follow** under not-followed circles; tap →
   **Following** (optimistic) + `POST /followers/follows`.
2. Followed creators show **Following**; anonymous viewers see no follow buttons.
3. Carousel shows followed-first then popular, location-boosted (existing rule).
4. Additive props default off → other screens/uses unaffected.
5. Babel transform PASS; `pnpm qa` GREEN.

## Release classification
- **production-impacting** (follower OTA). Surfaced for go; Maestro founder-side
  (recorded override). OTA: `pnpm publish-ota:follower` (v71 → next).
