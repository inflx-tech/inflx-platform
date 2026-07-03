# Feature Spec — Hero slider design (Cleanup P3a)

> Program: Section System Cleanup (Docs/SECTION_SYSTEM_SPEC.md §3 V8, LOCKED).
> Predecessors: P1 section-scheduling (live), P2 app-builder-wizard (live —
> hero_slider card exists greyed "P3").

## Problem / goal
The follower home has no full-width auto-advancing hero — the anchor visual of
every commerce home (the "PAYDAY SALE" slot). Admin has images and tap actions
(P2) but no design that presents them as a hero.

Goal: ship the `hero_slider` design end-to-end: mobile renderer (auto-advance,
dots, per-slide action), wizard card un-greyed, real-image live preview in the
App Builder for it. Establishes the "new design = renderer + catalog card, no
engine change" pattern for P3b.

## Scope
- In scope:
  1. **Mobile renderer** (`Packages/Mobile/src/components/sections/TileSection.js`):
     new style `hero_slider` — full-width paged slides (~2:1, 16px radius,
     toing palette), auto-advance every `config.autoplay_ms` (default 4000,
     0 = manual), pause while touched, page dots, per-slide tap → existing
     `onTile` wiring (grid / category / page). Composes with the countdown
     bar + P1 scheduling like any tiles section.
  2. **Backend enum** (`backend/src/controllers/adminSections.controller.js`):
     `TILE_STYLES` += `'hero_slider'` (P1 validation currently rejects it).
     One line; no engine/payload change.
  3. **Admin wizard** (`Packages/brand-web/app/admin/sections/page.js`):
     un-grey the catalog card → base `{shelf_type:'tiles', rule:'static',
     config:{style:'hero_slider', design:'hero_slider', autoplay_ms:4000,
     tiles:[]}}`, fills `['images']`; slide size hint **1080×560**; autoplay
     seconds field in the images editor.
  4. **Real-image live preview**: `PreviewSection` renders hero_slider as a
     full-width image + dots in the phone pane (uploaded image, not wireframe).
- Explicitly out of scope: other P3b designs (strip/split/collage slots),
  video, any section-engine change, per-slide schedule.

## Data / contracts
- `config_json` (validated by P1 rules; `autoplay_ms` passes as tolerated key):
  `{ design:'hero_slider', style:'hero_slider', autoplay_ms:number,
     tiles:[{ image_url, label?, library_section_id?, tap_destination? }] }`
- No new endpoints, tables, or payload fields. Old app versions render an
  unknown style via TileSection's default carousel branch (graceful).

## Non-functional
- Auto-advance must not leak timers (clear interval on unmount / on touch).
- Release class: **production-impacting** — backend one-liner (Render), admin
  wizard (Vercel), mobile renderer (**OTA ×3**). Gates: mockup-lock +
  before/after diff [UI-governed] + **Maestro mobile-verify [Mobile-governed]**
  — needs a connected Android device/emulator (`pnpm qa:maestro`) before
  `released=true`, else GOVERNANCE_OVERRIDE with founder's explicit say-so.
