# Spec — Photos with variants (not before them)

## Problem
The drill-down add wizard asks for photos in the WRONG place and TWICE:
- **Step 1 (Basics)** requires "cover photos" up front — before the brand has even
  chosen the product's colours.
- **Step 2 (Variants)** then asks for photos again, per colour.

So a multi-colour product uploads images twice, and the very first thing the wizard
demands is a photo with no context. (Founder: "why ask images even before variants
and asking again for all selected variants — Step 1 should ask everything except
images.")

## Root cause (from code)
Two image concepts exist: product-level `cover_images` (Step 1) and per-colour
`colors[].images` (Step 2). The main thumbnail `image_url` = `coverImage()` already
falls back to the first colour's first photo — so a separate cover ask is redundant
for colour products. Cover only genuinely mattered as the *sole* photo slot for
products with **no colour variant** (Step 2 was skipped for those).

## Goal
Collect photos once, in the right place — alongside the variants they describe.

## Change (frontend only)
- **Step 1 (Basics):** product info only — name, brand, price, MRP, stock, SKU,
  description. No photo field, no photo requirement.
- **Step 2:** always shown now (it hosts photos for every product). Label is
  "Variants" when the leaf has variant facets, else "Photos".
  - Colours chosen → per-colour photos + per-size stock (as today).
  - No colours → a single **"Product photos"** uploader (writes the product image
    set).
- **Photo requirement** moves to Step 2: at least one photo (per-colour OR the
  product set). `image_url` derives automatically (`coverImage` fallback), so the
  main image is set whether photos came per-colour or as the single set.

## Out of scope
- Backend: none. `coverImage`/`buildVariants` already handle both photo sources;
  the Excel bulk path (URL columns) is unchanged.
- Removing the legacy product-level `cover_images` concept — old products keep
  theirs; new colour products simply won't set one.

## Applies to
The shared drill-down stepper — so both **add** and **edit** modes (edit reuses the
same form).
