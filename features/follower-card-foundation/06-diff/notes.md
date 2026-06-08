# Before / After — follower-card-foundation (Phase 0)

> Step 13 (UI-governed gate). Phase 0 wires into no screen, so there is no live
> URL/Maestro screenshot to capture yet — the kit becomes visible in Phase 1
> (Home), where the side-by-side against `home-comprehensive.html` is captured.
> This note records what was built vs the agreed mockup vocabulary and the honest
> divergences, so the Home diff inherits a clean baseline.

## What shipped (12 new files, `Packages/Mobile/src/components/vibe/`)
- `Gradient.js` — OTA-safe pure-JS 2-stop linear gradient (stacked View slices).
- `palette.js` — category → warm gradient pair + emoji; story ring pair.
- `ShelfHeader.js` — serif title + sub + count badge + type tag + See-all.
- `StoryCircle.js` — `StoryCircle` + `StoryRail` (coral→amber gradient ring, avatar, @handle, ● LIVE).
- `CategoryCircle.js` — `CategoryCircle` + `CategoryRail` (round rounded-square tiles).
- `FeatureCard.js` — "What's Hot" gradient tile (chip, serif title, via pill, emoji).
- `DealCard.js` — gradient header (discount + emoji + clock) + body (name, brand, via chip).
- `ShelfProductCard.js` — image hero (heart, offer badge, rank), name, brand, price + struck MRP.
- `ShelfBrandCard.js` — image hero (heart, rank), name, cuisine/category line.
- `ViaCreatorChip.js` — "via @handle" pill (soft + glass tones).
- `RankBadge.js` — "#1/#2" overlay (top-3 only).
- `index.js` — named-export hub.

## Matches the mockup
- Round gradient-ring stories with LIVE tag; round category circles (replacing the
  square grid-wrap); gradient deal cards with via-creator chips + ending-soon clock;
  feature/What's-Hot gradient tiles; image-hero product/brand cards; serif shelf
  headers with count + type tags; ranked badges. Palette/typography = `creatorVibe`
  tokens + serif-display fallback, identical to the comprehensive HTML.

## Honest divergences (intentional, recorded)
1. **Gradients are approximated, not true GPU gradients.** Bare RN 0.73.6 has no
   `react-native-linear-gradient`/SVG/Expo, and the rebuild is OTA-only (no APK), so
   a native gradient lib is off-limits. `Gradient` stacks ~14 interpolated `View`
   slices — close at a glance, banding visible under close inspection. Same class of
   trade-off as Flow-52 D1 (serif font OTA fallback). Upgrade path: swap `Gradient`
   for a native lib in a future APK build with no call-site change.
2. **`ShelfBrandCard` omits the mockup's "★ 4.5 · 1.2 km".** The brand item shape
   (`mapBrandItem`) carries no rating or distance; restaurant reviews exist but are
   not in the section payload and distance is not computed. Per the backend-first
   tile rule we omit rather than fabricate; re-added when reviews/geo are wired.
3. **Avatars/emojis:** mockup uses decorative emoji; the kit uses the real `avatar`
   image when present, falling back to an initial (stories) or the category emoji
   (cards) — truthful to live data.

## Verification
- Babel transform via `module:@react-native/babel-preset`: **12/12 PASS** (the
  mobile "does it compile" check).
- `pnpm qa`: **GREEN — 79 passed, C1 GREEN** (`qa/reports/2026-06-08T04-49-44-609Z/`).
  A mobile-only, unimported change cannot affect the web/api suite — the GREEN
  confirms zero regression.
- Inert: `grep` confirms no screen/`SectionRenderer` imports `components/vibe` yet.

## Release
**deploy-inert** — new unimported files; `git push` changes nothing in production.
`released` stays false. These first render (and ship via OTA) in Phase 1 (Home).
