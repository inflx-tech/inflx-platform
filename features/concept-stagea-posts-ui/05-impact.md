# Impact — concept-stagea-posts-ui

**Verdict: production-impacting (mobile OTA + one backend payload
extension). The old follower app keeps working unchanged except one tab.**

- Mobile: 4 new files (PostCard, ShopThisPostSheet, PostsFeedScreen,
  PostViewerScreen) + navigator: the center tab swaps the dead Reels
  placeholder (38-line static screen, deleted) for the PostsStack; label/
  icon change (Reels→Posts). Every other tab/screen/flow untouched. New
  screens ride SHARED_SCREENS for ProductDetail/Cart/InfluencerStore/
  FollowerLogin — purchases + attribution via existing rails.
- Backend: feed items gain feed_pins (additive; one batched query over the
  page's cover slides). No endpoint reshaped.
- Empty-state reality: prod has zero posts — the tab ships showing the
  empty state until the pilot creates the first approved post. Deliberate.
- Risk: low — additive tab; worst case the new tab misbehaves while the
  rest of the app is unaffected; OTA rollback = republish previous bundle.
