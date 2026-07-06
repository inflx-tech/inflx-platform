# Impact — Phase 4c

**Verdict: backend half deploys on push and is inert for current apps (old
bundles ignore banner items); the visible change ships only with the OTA.**

- Probe cost unchanged in shape (limit 1 → 3 on an already-indexed query),
  same cache TTL, new `:preview` key supersedes `:exists` (no stale-shape
  reads).
- Mobile change is additive rendering inside BannerGateway; no navigation,
  no data, no native code — OTA-only, no APK.
- Rollback: OTA republish of the previous bundle; backend items payload is
  harmless either way.
