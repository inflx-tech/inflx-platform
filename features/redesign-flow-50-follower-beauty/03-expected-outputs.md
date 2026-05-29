# Flow 50 — Expected outputs

## Visual end state
SchemaDetailScreen renders any schema-driven business on light brandPalette:
- bg2 hero · Outfit name + mono subtitle · yellowText "View {brand}" link (Path-B) ·
  yellowPale creator-deal strip (yellow avatar + ink initial, ink/yellow badge).
- description (ink2 body) · spec_grid (white boxes, yellowPale emphasized field) ·
  feature_chips (bg2) · gallery · variant_selector (bg2 chips, muted OOS) ·
  return_policy_notice (yellowPale).
- sticky CTA → ink bg + yellow text (data-driven label); disabled → muted4 +
  dangerText unavailable banner.
- SalonDetail re-export shows the same, unchanged.

## Functional end state (UNCHANGED)
__action_dispatch route, Path-B tracking (handleViewBrand → BrandStore), attribution
strip, all SectionRenderer branches, cta_primary action/label, orderable gate +
unavailable reason, schema-driven section ordering — all identical.

## QA gate
`pnpm qa` → **76 passed, gate 0, STATE=GREEN**. JS-only; OTA (NATIVE_RUNTIME=2), no
native rebuild.

## Deploy
`pnpm publish-ota:all` → brand v100 / influencer v89 / follower v63 (shared bundle).
production-impacting (follower OTA serves the restyled schema engine).
