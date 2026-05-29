# Flow 50 — Follower BEAUTY / SCHEMA-ENGINE → light brandPalette (F5)

## Goal
Convert `SchemaDetailScreen` — the schema-driven detail engine for salon/beauty AND
the 26 deferred businesses — from Wave-3 **dark** (hardcoded hexes + template
`cfg.accent`) to the F0-locked light `brandPalette`. `SalonDetailScreen` is a 10-line
re-export of it (inherits the restyle, no change). **Visual + UX only. Zero
functional change.**

## Screens in scope (1 engine + 1 shim)
1. **SchemaDetailScreen.js** (379) — renders `template.card_config.detail_sections`
   in order: description · spec_grid (emphasized_field) · feature_chips · gallery ·
   variant_selector · return_policy_notice (+ pricing_tabs/pickup_options/
   repeatable_list no-ops). Hero · title · Path-B "View {brand}" link · influencer
   attribution strip · sticky CTA via `__action_dispatch`.
2. **SalonDetailScreen.js** (10) — `export { default } from './SchemaDetailScreen'`.
   Untouched.

## Design decision (founder-approved)
The engine drops the dark template `cfg.accent`/`accent_dim` for rendering and adopts
the **brand ink/yellow spine** (per F0: deferred businesses fall back to the yellow
family; accent = wayfinding only):
- creator-deal strip → yellowPale + yellow avatar (ink initial) + ink/yellow badge.
- CTA → ink bg + yellow text; disabled → muted4.
- spec emphasis + return notice → yellowPale tint; brand link / emphasis text → yellowText.
Salon's purple lives in its booking screen (SlotPicker, shipped Flow 43).

## Non-negotiable (preserve verbatim — see 05-impact.md)
`__action_dispatch` route (handlePrimary) — half-wired foundation (§9), untouched ·
Path-B `handleViewBrand` → BrandStore with tracking · attribution strip · every
SectionRenderer branch + readPath/formatValue/renderSubtitle helpers · `cta_primary`
action/label data-driven · `orderable` gate + unavailable reason · schema-driven
`detail_sections` ordering.

## Mockup
`design/wave3/flow-50-follower-beauty/web.html` (mirrored to
`04-preview/mockups/web.html`). 2 frames (salon service + deferred business). Founder
green-signaled via AskUserQuestion 2026-05-28 ("Green — implement") BEFORE code.
