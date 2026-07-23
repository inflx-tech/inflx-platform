# concept-stagea-posts-ui — Stage A: the posts pillar in the follower app

**Program:** POST_CONCEPT_BUILD_PLAN.md P3 UI, Stage A of the founder's
3-pillar order (posts → discoverability → commerce/profile).
**Founder go 2026-07-23:** "build stage A from locked mockups… go and build."
Scope per founder: how a post looks in feed and full screen, engagement
elements, Shop-the-post CTA.

## What ships

- **PostCard** (components/posts/) — the atom every later surface composes:
  creator row (avatar/handle/city + concept chip), media at NATURAL ratio
  clamped 1:1↔4:5 (cover; slide badge for carousels), price-tag pins on the
  cover per the creator's tag style ('hidden' → none), YELLOW Shop bar with
  white text, compact engagement row (like+save live; comments/share
  "coming soon"), 2-line caption. Pure white, full-bleed, system font.
- **PostsFeedScreen** — card feed from GET /follower/posts (paged, pull-to-
  refresh, honest empty state); like/save optimistic with login prompt for
  anonymous; creator row → existing InfluencerStore.
- **PostViewerScreen** — full screen: header context = concept name,
  TRUE-ratio carousel (contain) with pins per slide, Reels-style RIGHT RAIL
  (founder ruling: like/comment/share/save stacked with counts, white with
  shadow), dots, Shop bar, full caption; dark/unavailable post → honest
  "post unavailable" state.
- **ShopThisPostSheet** — bottom sheet: server-sorted products (concept-
  keeping first; unavailable rows dimmed+disabled), effective price + struck
  price + % off; tap → EXISTING ProductDetail with the post's tracking block
  → live commerce rails, creator attribution intact.
- **Feed pins backend**: GET /follower/posts items gain feed_pins (cover
  slide's tags live-joined to purchasable name/price) — founder override:
  tags visible in feed.
- **Mounting**: the old app is otherwise untouched — the center tab (former
  Reels placeholder, deleted) becomes the Posts pillar (PostsStack = feed →
  viewer → SHARED_SCREENS). Full new shell arrives with Stage B/C.

## Non-goals
Video cards (P6) · Discover/banners (Stage B) · new commerce screens
(Stage C — the sheet rides the existing PDP/cart) · comments/share · new
shell/navigation.
