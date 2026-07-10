# Feature Spec — Adaptive Renderer (Creator Experience Engine · Phase 4)

> Contract-driven Step 2. Agreed BEFORE code. Parent: `Docs/CREATOR_EXPERIENCE_ENGINE/02_LAYOUT_CONTRACTS.md` (renderer resolution order). The first genuinely-new *engine* code. **Mobile-governed** (Maestro gate).

## Problem / goal
The engine that finally *draws* an experience: take a Theme's tokens (Phase 1 preset → palette/typography/background) + a Layout Contract (Phase 3) + an **Asset Pack** (creator fill) and produce pixels **at any size**, obeying the contract (required always, optional if room, hidden never) and auto-picking the right featured image by aspect. One pack → any of the 10 layouts, no redraws. Real Asset Packs arrive in Phase 7; Phase 4 proves the renderer against **live themes + live layouts** filled with a **sample pack**.

## The structural choice (RECOMMENDED split — confirm at build)
The hard part (which slots render, which featured image fits, how tokens apply) is **pure logic**, portable and unit-testable without an emulator. The visual layer differs web vs React Native. So Phase 4 splits:
- **4a — Render-decision logic + preview API (web/API-verifiable NOW):** a pure `resolveRenderSpec(theme, layout, pack, size)` module (unit-tested in the qa lane) + a backend `GET /v1/admin/experience-preview` that resolves a live theme → preset tokens → layout contract → sample pack → a **render spec**. No emulator needed.
- **4b — Mobile AdaptiveRenderer + preview screen (mobile-governed, needs emulator):** a React Native component that consumes the render spec and draws it, + a dev/admin preview screen listing theme × layout. Verified via Maestro on a connected device/emulator.

Recommendation: build **4a first** (fully verifiable now), then **4b** when an Android emulator/device is available for the Maestro gate.

## Scope
- **In scope (4a):** pure render-decision module + unit tests; `experience-preview` API resolving live theme+layout into a render spec with a sample pack; API/unit QA.
- **In scope (4b):** RN `AdaptiveRenderer` component + featured-image aspect auto-pick + a preview screen; Maestro flow.
- **Out of scope:** real creator Asset Packs (Phase 7), Experience Templates + placement (Phase 5), creator Experience Studio (Phase 6), follower-home wiring. The sample pack is placeholder data.

## Surfaces touched
- 4a: backend (new read-only endpoint + shared logic), qa (unit + api specs).
- 4b: `Packages/Mobile/src` (new renderer component + preview screen), qa/maestro.
- Roles: admin only for the preview surface (`requireCapability('sections')`).

## Data / contracts
- **No new tables.** Reads `experience_themes` (P2), `design_presets`+`design_tokens` (P1), `design_layouts` (P3).
- **Render spec (the key artifact)** returned by `GET /v1/admin/experience-preview?theme_key=&layout_key=&world_key=`:
  `{ theme:{name,title,subtitle,cta}, design:{layout_key,aspect_hint,contract}, tokens:{palette,typography,background,radius,shadow}, pack:{creator_name,avatar_url,featured_images:[{url,aspect}],offer_badge,products,copy}, resolved:{visible_slots:[…],featured_pick:{url,aspect}} }`.
- `resolveRenderSpec` decides `resolved.visible_slots` (required + optional-that-fit, minus hidden) and `resolved.featured_pick` (best aspect match).
- Money/attribution/status machines affected: none.

## Non-functional
- Auth: preview endpoint `requireCapability('sections')`.
- Failure modes: unknown theme/layout → 404; theme with no preset → renders with neutral tokens (no crash); pack missing a required slot → spec flags `blocked:true` with the missing slot (this is what Phase 6 publish-validation will enforce).
- **Mobile-governed:** 4b release requires `release.maestro_green=true` (gov-check Rule 5). Needs a connected Android device/emulator.

## Functional outcome
Pick a theme (e.g. Street Style) and a layout (Hero / Story / Bento / Magazine) → the engine returns a render spec and the mobile renderer draws **"Rahul's Street Style"** correctly for that layout — same sample pack, different layout, no redraw. The "Creator Vibe" screenshot becomes live pixels.
