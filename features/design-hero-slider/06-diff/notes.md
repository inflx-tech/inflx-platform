# Before/after diff — design-hero-slider (P3a)

**Before** = the locked mockups in `04-preview/mockups/` (00-hero-slider-screens.html,
locked 2026-07-03).
**After** = real screenshots from the e2e walkthrough against local brand-web +
backend + real admin JWT: `06-diff/after/02-wizard-step1-hero-enabled.png`
(catalog card selectable), `03-wizard-step2-slides.png` (slides editor +
autoplay field + phone-pane hero preview), `04-wizard-step4-action.png`.
On-device hero screenshot to be captured at the Maestro/OTA verify step.

## Differences vs the locked mockups
- Hero renders inside the existing App Builder wizard (P2) rather than a
  standalone screen — same catalog card, same slides editor content, same
  business copy ("upload slides 1080×560", "0 = manual").
- Follower hero uses 14px side margins + 16px radius (matches the mockup's
  framed look and the toing tiles convention) — NOT screen-edge full-bleed;
  ~2:1 via the 1080×560 canvas ratio (0.5185).
- Dots overlay the bottom of the slide (yellow active, stretched) exactly as
  mocked; shown only when >1 slide.
- Auto-advance default 4000ms, pauses on touch, resumes after momentum —
  behaviors from the mockup notes.

## Verification evidence (2026-07-03, local e2e, real JWT + dev DB)
11/11 walkthrough assertions green (scratchpad hero-walkthrough.mjs):
- backend accepts style=hero_slider (was 422 pre-enum) · bogus style still 422
- wizard: Hero slider card selectable (no longer P3) · slides editor + autoplay
  field present · PUT 200 carrying config.style/design=hero_slider + autoplay_ms
  · row shows "Hero slider" template name · phone-pane hero preview renders with
  no client error
- follower payload passthrough (type=tiles + config.style=hero_slider) · baseline
  sections unchanged · cleanup verified
Mobile unit: `TileSection.test.js` 25/25 pass; RN babel-preset transform clean.
Full `pnpm qa` recorded in lock.json.

## Out-of-scope pre-existing failure (classified, NOT introduced)
`FollowerWalletScreen.test.js` suite fails to run — jest transform-config
choke on `react-native-vector-icons/MaterialCommunityIcons` (FollowerWalletScreen.js:26,
a file untouched by this contract). Independent of P3a; TileSection tests pass.
Belongs to test-harness debt, not this release.
