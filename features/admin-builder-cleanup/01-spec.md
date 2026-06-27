# 01 — Spec: admin-builder-cleanup (clear demarcation + live mobile preview)

## Problem
The App Builder's "Add section" menu was muddled (Tile grid, Featured carousel,
Themed banner, Library Section, two creator presets, two category rails) and it
wasn't clear which sections need a rule. The section preview was empty grey shapes.
Founder asks: clear data-vs-frame demarcation, fold Section Library (rule creation)
into the Frame, and a **live mobile preview** showing real content.

## Scope (admin-only + one backend tweak; no migration, no OTA)
- **Clear kinds + tags** — every section tagged **NO RULE** (data, fills from context)
  or **NEEDS A RULE** (the image/banner Frame). `sectionKind()` derives it from shelf_type.
- **Cleaned, grouped Add-section menu** — optgroups Data / Frame / Controls; world/biz
  gating (food presets only on food). Consolidated:
  - 4 tile presets → ONE **"Image / banner frame"** (style chosen inside).
  - removed **Library Section** + duplicate **Creator carousel (smart)** (Creators rail now uses the smart rule).
  - **Category rail (sticky-able)** relabelled **Food cravings rail** (food-only).
- **Frame rule = Create / Use saved + Save for reuse** — per banner a clear toggle:
  "Create a rule" (inline conditions) or "Use a saved rule" (dropdown); a **"Save for
  reuse"** button writes the inline rule to the Section Library (`adminApi.createSectionLibrary`)
  and wires the banner to it. The separate **Section Library nav link is removed**.
- **Live mobile preview** (`MobilePreview`/`PreviewSection`) — a sticky phone frame beside
  the builder, rendering the section stack from the SAME config: faithful for categories
  (picked nodes + "All") and image/banner frames (real uploaded images in the chosen
  style); representative placeholders for the auto data rails.
- **Category rail "All" tile** — backend `categoryNodes` appends an "All" item (→ existing
  nav). The chosen categories show; the rest live under "All".

## Out of scope
- AI image generation (Phase 6); frame *visual* styles polish (design pass).
- Live data fetch for the auto-rail previews (placeholders for now).

## Acceptance
- Each section row shows NO RULE / NEEDS A RULE. Menu grouped, junk gone.
- Frame banner: Create-or-Saved toggle works; Save-for-reuse creates a library rule + wires it.
- Right-side phone preview reflects the sections live (categories + frames faithful).
- Category rail shows an "All" tile. brand-web build exit 0; pnpm qa green; backend load ok.
