# Before/after — concept-p3-post-globals

## Admin (brand-web)
- **Before:** no follower-app behaviour knobs anywhere — any global change
  (autoplay, sound default) would have meant an OTA.
- **After:** SETTINGS → "Follower App 📱" page with two toggles (autoplay
  ON / sound-by-default OFF as seeded); saves shallow-merge into one config
  object the app fetches at launch.

## Follower backend surface
- **Before:** feed/detail payloads carried no engagement; no config endpoint;
  likes/saves did not exist anywhere for posts.
- **After:** GET /v1/follower/app-config public; POST|DELETE
  /posts/:id/like|save idempotent under follower auth; feed + detail carry
  like_count/save_count/liked/saved.

## Design decision artifact
mockups/post-frame-ratios.html — the ratio-clamp decision board (1:1 / 3:4 /
4:5 + full-screen viewer) rendered in the locked canvas: pure white,
full-bleed, yellow-only accents, price tags visible in-feed (founder
override), compact Shop-this-post bar, engagement row, concept chip.

Capture note: real screenshots deferred to the release step per program
precedent; the admin page follows the established settings-page grammar.
