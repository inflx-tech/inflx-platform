# Workflow Prediction — follower-card-foundation

> Step 6 (UI-governed). What the reviewer should see in the mockup, and what the
> built kit will render, before any screen consumes it.

## What the mockup shows (source of truth)
The agreed comprehensive mockups
(`design/wave4-creator-vibe/home-comprehensive.html` + the other `*-comprehensive.html`)
define the card vocabulary. `04-preview/mockups/component-gallery.html` extracts
exactly those cards into one review page so the kit can be checked card-by-card:

1. **Story circle** — gradient ring (coral `#FF6A5F` → amber `#FFB24C`), 62px round
   avatar, `@handle`, `● LIVE`.
2. **Category circle** — 60×60 rounded-square (radius 20) white tile + emoji, label.
3. **Feature card** ("What's Hot") — 188×158 gradient tile, category chip, serif
   title, `via @creator` pill, big emoji.
4. **Deal card** — 182px; gradient header (78px) with big discount (`20% OFF`/`B2G1`)
   + emoji; body with item name, brand, `via @creator` chip; optional `⏳ 4h left`.
5. **Shelf product card** — 154px; image hero (heart + offer badge), name, brand,
   `₹price`.
6. **Shelf brand card** — 162px; image hero, name, cuisine/category line.
   (Mockup shows ★rating + distance; the build OMITS these — no backing data.)
7. **Shelf header** — serif title + sub + count badge + type tag.

## What the built kit will render (and where it honestly diverges)
- **Gradients** are reproduced with the OTA-safe `Gradient` primitive (stacked View
  slices). Close at a glance; not a true GPU gradient. **Divergence: intentional**
  (OTA constraint — no native gradient lib).
- **Brand card rating/distance OMITTED.** **Divergence: intentional** (backend-first
  — `mapBrandItem` has no such field). Re-added only when reviews/geo are wired.
- **Avatars/emojis:** the mockup uses decorative emoji; the build uses the real
  `avatar` image when present, falling back to an initial/category emoji.
- Everything else (rings, round categories, deal/feature gradients, via-creator
  chips, ranked badge, prices in rupees) renders to the mockup.

## Review signal
Founder green on the kit (delegated design decision per standing autonomy) =
mockup-lock. Then Phase 1 (Home) wires it.
