# Workflow prediction — design-hero-slider

Mockups (04-preview/mockups/; 00-hero-slider-screens.html = combined view):
1. `01-follower-hero-slider.html` — the follower home with the hero: full-width
   ~2:1 slide, yellow active dot, auto-advance note, sitting above the
   category row; side notes list the behaviors.
2. `02-wizard-hero-editor.html` — wizard step 2 for the design: slides list
   (upload 1080×560 + label), auto-advance seconds field, per-slide action
   shown as a step-4 pointer.

Predicted runtime behavior after implementation:
- Backend: one enum addition (TILE_STYLES) — hero_slider rows validate; no
  payload/engine change. Deployable ahead of the OTA safely.
- Admin: the P2 wizard's greyed "Hero slider · P3" card becomes selectable;
  everything else in the wizard is reused as-is (images editor grows an
  autoplay field + hero size hint; phone pane gets a hero preview case).
- Mobile: new TileSection style branch. Devices WITHOUT the OTA render the
  same row via the default carousel branch (graceful; images still tappable).
  With the OTA: auto-advance every autoplay_ms, pause-on-touch, dots.
- Scheduling composes for free (P1): an ends_at on the hero removes the whole
  slider silently; countdown bar available like any tiles section.
