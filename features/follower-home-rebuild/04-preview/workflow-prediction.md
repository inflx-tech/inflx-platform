# Workflow Prediction — follower-home-rebuild

> Step 6 (UI-governed). Reviewed before code.

## Locked mockup (source of truth)
`design/wave4-creator-vibe/home-comprehensive.html` — the agreed Home (left phone
panel) + its Admin Section Manager (right). This is the pixel spec; the build
matches the phone panel. (Not duplicated here to avoid a 28 KB copy; it is the
canonical, founder-iterated mockup referenced by NEXT-WINDOW-PROMPT §0.3.)
The Phase-0 card vocabulary it uses is also in
`features/follower-card-foundation/04-preview/mockups/component-gallery.html`.

## What the reviewer should see (mockup → build)
- **Header:** "📍 DELIVER / DISCOVER IN · Vijayawada ▾" left; round bell + round
  profile avatar right. Build: same layout; avatar shows the real user initial and
  opens Profile; bell is an icon button (no fabricated count — backend-first).
- **Greeting:** serif "Hey, what's good today?" + "Shop · Support · Stay Inspired".
- **Search:** rounded bar + brown filter button → Find.
- **Stories:** gradient-ring round avatars, @handle, ● LIVE.
- **Browse by Category:** round rounded-square emoji tiles; **Eat → agreed Category**.
- **Top Eats (BRANDS):** serif shelf header + image-hero brand cards.
- **Trending Dishes (PRODUCTS):** image-hero product cards, ₹price.
- **Offer shelves (What's Hot / Best Deals / Ending Soon):** gradient deal/feature
  cards — **currently empty** (offer-source gap, Phase 3) → render nothing.

## Honest divergences (carried from Phase 0 + data state)
- Gradients approximated (OTA-safe primitive). Brand cards omit rating/distance.
- Offer shelves empty until the Phase-3 data fix (no fake deals).
- Bell shows no count (no unread-count endpoint).

## After-capture
Mobile "after" = a Maestro screenshot of Home (founder-side emulator), declared in
`home.maestro-flow.json`. If the emulator is unavailable at release, the founder
does a physical-APK/OTA smoke and we record honestly (+ `GOVERNANCE_OVERRIDE` if
flipping `released` without an automated Maestro run), per GOVERNANCE §10.

## Review signal
Founder green (delegated design decision) = mockup-lock; then implement.
