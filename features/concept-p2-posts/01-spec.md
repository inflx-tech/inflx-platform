# concept-p2-posts — Phase 2: creator posts exist

**Program:** Docs/FASHION_REBUILD/POST_CONCEPT_BUILD_PLAN.md · **Architecture:** POST_CONCEPT_MODEL.md §5-§7
**Depends on:** concept-p1-engine (templates, concepts, collections)

## Goal (functional)

A creator publishes a fully tagged IMAGE post through the founder's 4-step
flow; admin approves it; it sits live in the database with a concept attached.
Followers cannot see it yet — by design (P3 builds their app).

## Data model (mig 140 — all ship empty)

- `creator_posts` — influencer, scope (single/multi/all) + scoped_brand_ids,
  concept_id XOR collection_id (CHECK), post_type lifestyle/editorial,
  media_kind image (video reserved for P6), tag_style soft_editorial/minimal/
  hidden, caption, status draft/submitted/approved/rejected + reject_reason +
  approved_by/at. **"Dark" is never stored** — P4 computes visibility live.
- `post_media` — ordered slides, r2_key under posts/<influencer_id>/, w/h.
- `post_products` — (post, media, product, x_pct, y_pct 0-100) — coordinates
  only; nothing drawn into images; labels render at runtime (founder lock).

## Backend

- Composer API (influencer role): GET me/post-scope (collaboration brands +
  active templates + collections) · POST me/posts/picker (concept rule ∩ live
  allocation from the scoped brands ONLY — creatorAllocatedProductIds gains a
  brandIds filter, threaded as ctx.allocBrandIds; SAME library_products
  evaluator as shelves/preview) · POST me/posts/upload-url (images only
  jpeg/png/webp, key posts/<inf>/…) · POST me/posts (re-runs the picker
  server-side and rejects any product outside it — "satisfy the concept by
  construction" enforced; materializes the concepts row; transactional insert)
  · GET me/posts (hydrated: media URLs, products, concept/collection names).
- Public media serve: GET /v1/media/post/:id → 302 to a fresh presigned GET
  (the stable-URL pattern from /v1/media/assets/:id).
- Moderation (approvals capability): GET /admin/posts?status · POST
  /admin/posts/:id/approve|reject — admin ONLY (founder lock: brands are not
  in this path). Creator notified: types post.approved / post.rejected.
- concepts.service gains materializeConcept (lazy upsert) + conceptDisplay.

## Surfaces

- Mobile creator app: **PostComposerScreen** — the founder's sequence
  (corrected in-session 2026-07-23, 5 steps): ① scope ② concept/collection +
  live universe ③ POST TYPE (static/carousel; video + video-carousel visible
  but locked until P6) → upload ④ **SELECT PRODUCTS from the filtered list —
  this alone completes the post; "Shop the post" always renders from it**
  ⑤ OPTIONAL price tags: tap the photo → sheet of the ALREADY-SELECTED
  products → name+price pin at the tap point; tag style; caption; submit
  works with zero pins ("Submit without tags"). Attachment (no coords, media
  NULL) and pins (coords + slide) both live in post_products; a pin without
  both coords or with a bad slide → 422. **MyPostsScreen** (status pills +
  reason). Home gains Create Post + My Posts tiles. OTA required.
- Admin web: **/admin/posts** Post Queue (approvals cap) — tabs with counts,
  cards showing slides with tag-pin overlays, tagged-product list (with
  ⚠ delisted flags), caption; approve / reject-with-reason.

## Decisions taken (flagged, reversible)

- **No mobile crop:** post images are free-aspect creative (LTK-style); crop
  libs are native deps → APK rebuild. The image is a visual; commerce lives
  in the tags.
- Post Queue sits under the **approvals** capability (same reviewers as
  account approvals), not sections.
- Slide cap 10, product cap 30 per post; caption ≤ 2000 chars.

## Non-goals

Video (P6) · follower visibility (P3/P4) · eligibility/dark computation (P4) ·
post editing after submit (founder lock: create a new post) · drafts UI.
