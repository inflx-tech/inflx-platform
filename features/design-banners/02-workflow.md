# Workflow Definition — Banner pack designs

## Actor
Admin in the App Builder wizard; follower on the (OTA'd) mobile app.

## Preconditions
P1+P2+P3a-web live. A world scope open. Slide images available.

## Workflow steps (user-observable)
1. ＋ Add section → **Announcement strip** and **Split banner** cards are
   selectable (no longer greyed/P3).
2. Announcement strip → Content = My images → upload one 1080×240 image →
   Action (single tap destination) → Publish 200; row = "Announcement strip";
   phone pane shows a thin full-width strip.
3. Split banner → My images → two tiles, each its own image + label →
   Action step shows per-tile pickers → Publish 200; phone pane shows two
   half-width tiles.
4. **Full-width banner** → Content now offers **My images** and **My rule**:
   - My images → upload one 1080×720 → Publish → renders one edge-to-edge
     image (style fullbleed).
   - My rule → the existing headline+rule banner (unchanged) still works.
   Switching the fill tab reconfigures the draft cleanly (no stale fields).
5. **Collage** → images editor shows a **slot layout** picker
   (1 big + 2 small / 2×2 / 1 + 3 / free). Picking "1 big + 2 small" arranges
   the first tile full-width, next two half — visible in the phone pane.
6. Follower app (OTA'd): strip/split/fullbleed render per style; collage
   respects slot_template. Taps route via onTile as usual.
7. Grace: pre-OTA device renders the new styles as a carousel (no crash).
8. Regression: existing collage (mosaic) rows without slot_template render
   exactly as before; all other sections unchanged; pnpm qa 79/79; Maestro
   green on device.

## Success definition
Every non-parked catalog design is buildable end-to-end; new renders correct
on device; zero regression to existing sections.

## Failure / edge workflows
- fullbleed/strip with no image → Fallback initial, no crash.
- split with one tile → renders one half-width tile (no crash).
- collage slot_template with fewer tiles than slots → empty slots omitted.
