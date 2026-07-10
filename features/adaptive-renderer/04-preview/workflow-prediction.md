# Workflow Prediction — Adaptive Renderer (Phase 4)

Predicted behaviour the mockup demonstrates (confirmed against the real screen in the 06-diff step; 4b confirmed on-device via Maestro).

## Mobile Experience Preview screen (4b)
1. Admin/dev opens **Experience Preview**.
2. Top: a theme picker (Street Style / Airport Looks / …) sourced from live `experience_themes`.
3. Below: a layout switcher (Hero / Story / Small Tile / Magazine / Bento …) sourced from live `design_layouts`.
4. Centre: the **AdaptiveRenderer** draws the selected theme × layout from one sample Asset Pack:
   - background from the theme's preset tokens,
   - featured image auto-picked for the layout's aspect (landscape→Hero, portrait→Story, square→Tile),
   - title/subtitle/cta/avatar/offer placed only where the contract allows.
5. Switching the layout re-draws the **same pack** — Hero shows everything; Story drops subtitle+CTA; Tile drops most; Magazine goes editorial. No new artwork, no resizing.
6. A small caption under each render shows the resolved slots (what the contract kept vs dropped) — the proof the renderer obeyed the contract.

## What this proves
The core payoff: one theme + one pack → any of the 10 layouts, drawn correctly, on a real screen. This is the engine the whole platform was building toward — the "Creator Vibe" reference, live.
