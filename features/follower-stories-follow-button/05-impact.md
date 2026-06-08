# Impact — follower-stories-follow-button

**Verdict: additive Follow affordance on the Home Stories carousel for logged-in
followers. Uses the existing follow API + existing is_followed. No backend/data
change. 4-ID unaffected.**

## Mechanics
- `StoryCircle`/`StoryRail`/`SectionRenderer` gain additive props (`showFollow`,
  `onFollow`, `canFollow`); off by default. `HomeScreenV2` passes `canFollow` from
  login state. Follow uses `followerApi.follow` (existing, authed).

## Risk
- **Low.** Additive, Home-only (canFollow not passed elsewhere). Optimistic UI with
  silent catch — a failed follow just doesn't persist (no fake server state). Web QA
  unaffected (mobile-only).
- Reversible: revert the three files + re-publish OTA.

## Deploy
- **production-impacting** (follower OTA). Surfaced for go; never silent.
