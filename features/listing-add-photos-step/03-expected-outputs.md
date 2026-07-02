# Expected outputs

## Step structure
- Step labels: `Basics` · (`Variants` if the leaf has variant facets, else `Photos`)
  · `Details` · `Review`. Step 2 is ALWAYS present now.

## Step 1 (Basics)
- Fields: name*, brand, price*, MRP, stock, SKU, description. **No photo field.**
- Blocks Next only when name or price is missing ("Still needed: product name,
  price").

## Step 2
- With colour facet + colours selected: per-colour photo uploaders + per-size stock
  (unchanged behaviour).
- Without colours selected: a single "Product photos" uploader (up to 6).
- Blocks Next when a required variant facet is empty OR no photo has been added
  ("Still needed: … , at least one photo").

## Persistence (unchanged backend)
- Colour product: `variants_json.colors[].images` populated; `cover_images` may be
  empty; `image_url` = first colour's first photo (`coverImage` fallback).
- No-colour product: `variants_json.cover_images` populated; `image_url` = first.

## Review
- Shows the first available image: cover if present, else the first colour's first
  photo (`reviewImg`). Never blank when a photo was added.

## Edit mode
- Same layout; product photos load from per-colour and/or legacy cover; save
  preserves whatever the brand didn't change.
