# Workflow prediction — Phase 3c (placement)

Mockup: `04-preview/mockups/section-placement.html`.

Predicted admin flow:
1. App Sections → pick a screen → **+ Add: Library Section**.
2. The new shelf row shows a **Library section** dropdown (sections authored in 3b, labelled
   by business). Pick one → title auto-fills (editable) → set items/position → **Publish**.
3. Within ~60s the follower screen renders that shelf (existing product-shelf renderer).

Asserting for sign-off:
- Placement reuses the existing App Sections editor (reorder/position/enable/screen-scope) +
  one new preset + a section picker. No new screen.
- The callout states the context rule (Home = platform; Creator Store = that creator's
  allocation) — the visible proof of Layer 6.
- No backend/mobile change (engine + renderer already support it).
