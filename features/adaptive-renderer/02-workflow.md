# Workflow — Adaptive Renderer (Phase 4)

## 4a — Render-decision logic + preview API (web/API-verifiable)

### Actors & entry
Admin (capability `sections`) — the preview endpoint backs the dev preview screen; the pure logic is engine-internal.

### Happy path (end state to prove)
1. Caller requests `GET /v1/admin/experience-preview?theme_key=street_style&layout_key=hero_banner&world_key=fashion`.
2. Backend resolves: theme (P2) → `preset_key` → preset (P1) → token values (palette/typography/background) + layout (P3) → contract, then synthesizes a **sample pack** (creator "Rahul", placeholder featured images with aspects, sample products, offer badge, theme copy).
3. `resolveRenderSpec` computes `resolved.visible_slots` (required + fitting optional − hidden) and `resolved.featured_pick` (aspect best-fit for the layout).
4. Returns the render spec.
5. **End state (4a):** the spec is correct and deterministic — proven by unit tests over `resolveRenderSpec` (contract honored; hidden never present; required always present; featured pick matches aspect) + an API spec asserting the endpoint shape.

## 4b — Mobile renderer + preview screen (mobile-governed)

### Happy path
1. Admin opens the mobile **Experience Preview** screen (dev/admin), picks a theme + cycles layouts.
2. The screen fetches the render spec and the `AdaptiveRenderer` draws it: background from tokens, title/subtitle/cta/avatar/offer placed per contract, featured image cropped to the layout aspect.
3. Switching layout re-draws the **same pack** into Hero → Story → Bento → Magazine with no new artwork.
4. **End state (4b):** on a device/emulator, one theme renders correctly across layouts — verified by a Maestro flow (screen loads, renders, layout-switch changes the composition) + an on-device screenshot.

## Failure / edge states
- Unknown theme/layout → 404 (4a) / graceful "not found" (4b).
- Missing required slot in the pack → spec `blocked:true` + reason; renderer shows a placeholder, not a crash.
- Theme with no preset → neutral tokens, still renders.

## Proof of success
- 4a: unit specs on `resolveRenderSpec` (contract + aspect logic) + API spec on `experience-preview`; `pnpm qa` green; zero regression.
- 4b: `pnpm qa:maestro` green on the preview flow; on-device screenshot in `06-diff/`.
