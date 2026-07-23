# Before/after — concept-p2-posts

## Creator app (mobile, OTA)
- **Before:** no way to create any content. Home had campaign tiles only
  (P0 removed the dead Create Experience tile).
- **After:** Home gains "Create Post 📸" (dark tile, mirrors the old
  Create-Experience slot) + "My Posts 🖼️" row. PostComposerScreen = the
  founder's 4 steps exactly (mockup post-composer.html); MyPostsScreen lists
  posts with In review / Live / Rejected pills + the admin's reject reason.

## Admin (brand-web)
- **Before:** no content moderation surface of any kind.
- **After:** Post Queue 📮 (approvals capability) between Approvals and
  Concepts in nav. Tabs with live counts; each card = creator handle,
  concept name + family, slides with tag-pins overlaid at their stored x/y%,
  tagged-product list with prices and ⚠ delisted flags, caption; ✓ Approve /
  ✕ Reject-with-reason modal.

## Backend/public surface
- New /v1/influencers/me/post-* endpoints (influencer role), /v1/admin/posts*
  (approvals cap), and public /v1/media/post/:id media redirects.
- No existing endpoint changed shape. The allocation helper gained an
  optional brand filter that defaults to prior behaviour.

Capture note: real screenshots deferred to the release step (device verify +
deploy gate) per the P0/P1 precedent.
