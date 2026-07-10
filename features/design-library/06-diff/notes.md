# Before / After — Design Library (Phase 3)

**Before:** no Design Library. Mockup (`04-preview/mockups/design-library.html`)
is the authored intent — 10 layouts with contracts + the section-style reference.

**After:** real screen at `/admin/design-library` (brand-web), proven by
`qa/web/admin/design-library.spec.ts` (3/3 green) + the full suite (88/88 green).

## What matches the mockup
- Two panels: **Layouts** (10 cards) + **Section Styles** (vocabulary chips).
- Each layout card: label, aspect badge, kind, and the **Layout Contract** as
  slot chips — green = required, grey = optional, struck-through = hidden.
- Read-only "v1" chip; world switcher.

## Intentional differences from the mockup
- Live cards omit the wireframe thumbnail (deferred cosmetic; the contract is the substance).
- Section styles render from the API vocabulary rather than being hard-coded in the page.

## Verification
- Web spec: 3/3 green (layouts + contracts + section-style reference · empty-state · auth-gate).
- Full `pnpm qa`: 88/88 green, STATE=GREEN — zero regression.
- Local DB: migrations 131+132 applied clean — 10 layouts, every contract has ≥1 required slot; hero_banner required = [background, featured_image, title].
- Contracts transcribed exactly from the locked `02_LAYOUT_CONTRACTS.md`.

## Not captured here
- Live "after" against production — post-deploy (prod migration + brand-web deploy), on the founder's explicit go.
- The Adaptive Renderer that *consumes* these contracts is Phase 4.
