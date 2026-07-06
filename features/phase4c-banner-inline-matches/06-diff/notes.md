# Before / after — Phase 4c

## Backend
- **Before (Phase 2):** gateway probe at limit 1 under `key:exists`; kept
  banners emitted `items: []`.
- **After:** probe at limit 3 under `key:preview`; kept banners carry the
  matches as `items` (≤3, mapListedProductItem shape incl. brand.name).
  Drop semantics (dry / unresolved / static-frame immunity) unchanged —
  re-proven by the updated suite.

## Mobile (SectionRenderer.BannerGateway)
- **Before:** shell only (eyebrow / headline / sub / CTA); `section.items`
  never read.
- **After:** when items exist — a preview row (≤3 thumbnails 34px, rounded)
  + "At {brand} · {brand}" line (≤2 distinct brands) between sub and CTA.
  Guarded: absent/empty items → identical classic shell (old-backend safe).

## Contract evolution (explicit, not fake-green)
- Phase 2's `expect(kept.items).toEqual([])` asserted the gateway never
  pre-fills; 4c changes that business rule intentionally. Assertion updated
  to 1–3 items with name/brand checks in the same change, referenced here.

## Verification
- banner-gateway + world-rules + allocation-live: 16/16.
- esbuild JSX parse (SectionRenderer), node --check (sectionEngine).
- pnpm qa: see lock. qa:maestro:doctor RED = no device connected
  (environment); on-device Maestro + OTA are the deferred release step —
  released=false until then.
