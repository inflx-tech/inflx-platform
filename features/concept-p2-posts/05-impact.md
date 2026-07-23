# Impact — concept-p2-posts

**Verdict: production-impacting (backend + brand-web + mobile OTA + DB
migration), additive — one deliberate behaviour extension, zero regressions
to existing paths.**

- DB: 3 new empty tables; no ALTERs. Idempotent migration.
- Backend: new service/controllers/routes; mounts additive. The ONE existing-
  code change: `creatorAllocatedProductIds` gains an optional `brandIds`
  param (default null = exact old behaviour) threaded through
  `libraryProducts` as ctx.allocBrandIds — every existing caller passes
  nothing, so all existing shelves/pickers resolve identically.
- Public surface: GET /v1/media/post/:id (no auth, 302 redirect) — mirrors
  the existing /v1/media/assets/:id pattern; unguessable uuids, presigns
  expire in 1h.
- Notifications: 2 new types (post.approved/post.rejected) via the existing
  send() — no schema change (type is free varchar).
- brand-web: new /admin/posts page + 3 wrappers + 1 nav row (approvals cap).
- Mobile: 2 new screens + 2 navigator entries + 2 Home tiles + 5 api
  wrappers. No native deps added (image picker already present) → OTA only,
  no APK. My Posts "Live" pill means approved; dark-state arrives P4.
- Storage: post images land under posts/<influencer_id>/ in the existing R2
  bucket. Known platform gap (pre-existing, unchanged): no R2 delete anywhere.
- Load: picker/create run the same evaluator as admin previews, per-creator
  scoped; moderation hydration presigns thumbnails per request (1h cache
  headers on the redirect target).
