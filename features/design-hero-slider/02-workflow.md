# Workflow Definition — Hero slider design

## Actor
Admin in the App Builder (wizard live from P2); follower on the mobile app.

## Preconditions
P1 + P2 live. A world scope open (e.g. Home · fashion). At least 2 slide
images available to upload.

## Workflow steps (user-observable)
1. Admin: ＋ Add section → **Hero slider card is selectable** (no longer
   greyed/P3) under Banners & frames.
2. Step 2 Content: images editor shows **"slides"** with the 1080×560 size
   hint + an **autoplay seconds** field (default 4). Admin adds 2 slides
   (image + optional label).
3. Step 3 Display: schedule optional (unchanged). Step 4 Action: per-slide
   action pickers (grid rule / category / page). Publish → 200; row shows
   "Hero slider" template name; **live phone preview shows the uploaded image
   full-width with dots** (not a wireframe).
4. Follower app (OTA'd): the section renders full-width slides; **advances by
   itself every ~4s**; dots reflect the active slide; swiping works and
   pauses the auto-advance while touching.
5. Tapping a slide opens its action (SectionResults for a rule-wired slide).
6. `autoplay_ms: 0` → no auto-advance, manual swipe only.
7. Old-app grace: a device WITHOUT the OTA renders the same section as the
   default carousel (no crash, images still tappable).
8. Regression: every other tiles style + all existing sections render
   unchanged; `pnpm qa` 79/79; Maestro flow green on device.

## Success definition
Admin ships a scheduled hero campaign entirely alone; followers see an
auto-sliding hero whose slides tap through to the right destinations; no
regression anywhere else.

## Failure / edge workflows
- Slide without image_url → renderer falls back to label initial (existing
  Fallback), never crashes.
- Single slide → no dots, no auto-advance.
- Backend not yet deployed with the enum → wizard publish shows the 422
  field error on step 2 (validation surfacing from P2).
