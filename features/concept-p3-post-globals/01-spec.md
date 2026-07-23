# concept-p3-post-globals — the post pillar's global elements

**Program:** Docs/FASHION_REBUILD/POST_CONCEPT_BUILD_PLAN.md · Stage A (posts) globals
**Founder session 2026-07-23 — decisions locked:**

- **Canvas:** pure white #FFFFFF, black text, INFLX yellow the only accent,
  full-bleed posts (no card boxes), system font, no dark mode. Look judged
  at mockup (delegated within "pure white is the main aim").
- **Ratios:** composer stays free-aspect; the FEED renders inside a clamped
  cover-fit frame (files never cropped). Clamp choice (1:1↔4:5 vs 3:4)
  decided together on mockups/post-frame-ratios.html. Carousel = first
  slide's ratio. Full-screen shows the true image.
- **Two-level model:** Posts tab = card feed (~70-80% screen/card) → tap →
  full-screen immersive viewer. **Price tags visible at BOTH levels**
  (founder override of hide-in-feed).
- **Video globals (stored now, used at video phase):** autoplay muted while
  scrolling, tap for sound, defaults admin-controlled. Sound default OFF.
- **Attribution:** NO 30-day window for post purchases — every purchase
  starts inside a post that carries its creator's tracking block; direct
  attribution via the cart claim. (The window was an old-architecture crutch.)
- **Engagement:** like + save minimal NOW; comments/share visible as coming
  soon (intelligence phase).

## Build (mig 141)

- `follower_app_config` — single-row jsonb; seeded {video_autoplay: true,
  video_sound_default: false}. GET /v1/follower/app-config (public, fetched
  at launch) · PATCH /v1/admin/app-config (settings cap, shallow merge) ·
  admin page /admin/app-settings ("Follower App", two toggles).
- `post_likes` / `post_saves` — PK (post_id, follower_id). POST|DELETE
  /v1/follower/posts/:id/like|save (follower auth, approved posts only,
  idempotent). Feed + detail payloads gain like_count/save_count/liked/saved.

## Non-goals
Comments/share (P7) · video playback (P6) · any mobile UI (arrives with the
founder's Stage-A screens, which consume these endpoints).
