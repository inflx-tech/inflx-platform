# 03 — Expected Outputs: Phase 5b Home Layout

## Visual (vs `04-preview/mockups/home-recolored.html`, Screen 1)
- Hero offers shelf renders as a cream banner: terracotta eyebrow, serif headline
  (`FLAT N% OFF` or brand name), ink-on-gold `SHOP NOW` pill, limited-time badge.
- Shelf headers show only the title + a gold-deep "View all" (no BRANDS/PRODUCTS
  tag chip, no count pill).
- Category row = circular emoji bubbles; gold when active.
- Trust band (Authentic · Returns · Secure) sits above the bottom nav.
- No white text on any gold surface in the Home chrome.

## Functional (unchanged — must still hold)
- Tapping the banner → the offer's ProductDetail with its 4-ID tracking.
- "View all" on each shelf → SectionResults, context preserved.
- Story-rail follow, category navigation, product/brand taps unchanged.

## Gate
- `pnpm qa`: 79/79 GREEN, gate 0.
- No backend/DB/migration; web build unaffected.
