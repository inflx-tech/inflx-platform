# Workflow — follower-stories-follow-button

## Follower flow (Home Stories)
1. Logged-in follower opens Home → Stories carousel shows followed creators first,
   then popular creators (location-boosted by their profile city).
2. Under a creator they don't follow → **+ Follow** button. Tap → button becomes
   **Following** (optimistic) and `POST /followers/follows` is sent.
3. Already-followed creators show **Following** (no action needed). Anonymous
   viewers see no follow buttons.

## Build
1. `StoryCircle`: add `showFollow` + `onFollow`; local optimistic `followed` (init
   from `is_followed`); render +Follow / Following accordingly.
2. `StoryRail`: pass `showFollow` + `onFollow` to each circle.
3. `SectionRenderer`: creators map includes `is_followed`/`followers_count`; accept
   `canFollow`; `onFollow → followerApi.follow(id)`.
4. `HomeScreenV2`: read token → `isLoggedIn`; pass `canFollow={isLoggedIn}`.
5. Babel transform; `pnpm qa` GREEN; `06-diff/notes.md`; OTA for go.

## End state
Logged-in followers can follow creators straight from the Home carousel; followed
+ popular both appear; location/follow-graph honored. No app-restart needed.
