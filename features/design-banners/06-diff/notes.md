# Before/after diff — design-banners (P3b)

**Before** = the locked mockup `04-preview/mockups/00-banner-pack.html`
(follower renders of announcement strip, split banner, full-width image fill,
collage slot layouts; locked 2026-07-03).
**After** = real screenshots from the e2e walkthrough against local brand-web +
backend + real admin JWT: `06-diff/after/01-catalog.png` (both cards
selectable), `02-collage-slots.png` (slot picker in the images editor).
On-device renders captured at the Maestro/OTA verify step (batched with P3a).

## Differences vs the locked mockup
- All four render inside the P2 wizard (not standalone) — same designs, same
  business copy (1080×240 / 520×520 / 1080×720 hints, slot layout names).
- Full-width banner is one card with a two-way fill toggle (My images ↔ My
  rule); switching reshapes the draft cleanly (image→tiles/fullbleed,
  rule→products/banner). Matches founder decision #3 ("one component, multiple
  fills").
- Collage per-tile Small/Large dropdown hides when a slot template is chosen
  (the template drives sizing) — a clarity add beyond the mockup.

## Verification evidence (2026-07-03, local e2e, real JWT + dev DB)
17/17 walkthrough assertions green (scratchpad banner-walkthrough.mjs):
- backend accepts strip/split/fullbleed styles + mosaic slot_template
- announcement strip + split banner cards selectable (no longer P3)
- strip flow → PUT style=strip/design=announcement_strip
- full_width_banner dual-fill: default images (1080×720), switch to rule
  (headline field), switch back to images → PUT shelf_type=tiles/style=fullbleed
- collage slot_template=1big+2small saved
- no page errors; follower passthrough (type=tiles + config.style); baseline
  unchanged; cleanup verified
Mobile unit: TileSection.test.js 5/5; RN babel transform clean.
Full `pnpm qa` recorded in lock.json.

## Change surface (3 files)
TileSection.js (+85: strip/split/fullbleed styles + slot-aware MosaicStyle) ·
page.js (+89: 2 un-greyed cards + full_width_banner dual-fill + collage slot
picker + preview cases) · adminSections.controller.js (+1 word: enum).

## Pre-existing out-of-scope failure (unchanged from P3a)
FollowerWalletScreen.test.js jest transform-config choke on
react-native-vector-icons — untouched by this contract; test-harness debt.
