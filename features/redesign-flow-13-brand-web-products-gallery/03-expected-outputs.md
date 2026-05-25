# Flow 13 · expected outputs — what the user sees per state

These outputs map 1:1 to the 6 states in `04-preview/mockups/web.html`.

---

## State 1 · Products · Master Catalogue (car_rental fleet)

- Crumb: `/dashboard › products`
- Count chip: `{activated count} active in fleet` (mono)
- Outfit H1: `{schema.icon} {schema.product_noun_plural}` (e.g. "🚗 Vehicles")
- INK schema info bar: schema icon + label + mono availing modes + booking type + yellow "✦ Professional catalogue" badge
- "My Fleet" section: pip + count chip + "{X} of {Y} available models added" right-aligned
- Activated grid (3-col on desktop): image-card with name + `₹{price}/d` overlay · Live/Hidden palette pill · spec line · package list · Edit/Remove footer
- "Browse to Add" section: pip + count chip
- Segment chips: All + per-segment palette chips with counts
- Master grid (4-col): image-card with `topbadge` (segment) · Outfit name · spec line · ink `+ Add to Fleet` CTA

## State 2 · Products · Standard view (restaurant dishes)

- Crumb: `/dashboard › products`
- Count chip: `{active count} active of {total}` (mono)
- Outfit H1 + `+ Add Dish` ink-yellow primary
- INK schema info bar (no master-catalogue badge for standard categories)
- Section chips: All + per-section palette chips with counts
- Compact row cards:
  - Veg/non-veg colored avatar (success-pale/danger-pale) with 🟢/🔴/⬜
  - Name (Outfit) + section tag + Hidden tag if `!is_active`
  - Meta line: description (truncated) · stock indicator · variant chip · bookable indicator
  - Mono price + "price" label
  - Live/Hidden status pill (success-pale / bg2)
  - Edit / Hide-Show / Del action buttons (small ghost)
- Empty state if no products: yellow-pale gradient card with category icon + Outfit copy + `+ Add` CTA

## State 3 · Products · ProductFormModal (Edit "Paneer Tikka")

- Modal header: Outfit H3 ("Edit Dish") + mono category sub ("🍽 Restaurant")
- Modal body: dynamic field renderer
  - Veg toggle: 3 palette buttons (success-pale veg / danger-pale non-veg / bg2 N/A) with active state
  - Name input (palette focus ring)
  - Section select (palette focus ring)
  - 2-col grid: Price ₹ + Stock (mono inputs)
  - Description textarea
  - Variant builder for `variant_builder` fields (label + ₹ inline pairs with × delete)
  - Duration select for `duration_select` (chip-row preset durations)
- Active toggle: success-colored switch with "Show to followers" sub-label
- Modal footer: ink-bg with `Cancel` ghost + `Save Changes` ink+yellow primary

## State 4 · Gallery · Brand Assets tab

- Crumb: `/dashboard › gallery`
- Count chip: `{N} assets`
- Outfit H1 "Media Gallery" + rule + sub
- INK sub-tab pills: Brand Assets (active) / Reference Links / Contracts with mono counts
- INK UsageBar: `{used} / {quota} MB` (mono, yellow `used`) + "Storage used" Outfit label + yellow fill bar (red if ≥90%) + `{remaining} MB free` mono right
- Tag filter chips: All + per-tag palette chips with counts
- Yellow-pale gradient upload dropzone: ☁️ icon + Outfit "Click or drag files here to upload" + mono sub
- Asset grid (4-col): each card = palette-colored image header (file-type-based gradient if no preview) + Outfit title + mono file-size + relative upload date + palette tag chips + Open / Edit / Del footer

## State 5 · Gallery · Reference Links tab

- Same header + sub-tabs as state 4
- Top-right `+ Add Link` ink button
- Helper text: "URLs to YouTube · Drive · Figma · Notion · etc."
- Row cards: platform-colored avatar (auto-detected emoji) + Outfit title + meta line (URL + description) + platform tag + `Open ↗` primary + Edit/Del secondary

## State 6 · Gallery · Contracts tab + PDF preview modal

- Same header + sub-tabs as state 4
- Search input + status filter select (palette focus rings)
- Row cards: influencer initials avatar + campaign name + goal tag + meta line (@handle + signed date + deliverable) + mono fee + status pill + `View PDF` primary action OR `No PDF yet` muted note
- PDF preview modal (overlay): Outfit campaign title + mono influencer sub + ink+yellow Download button + iframe for PDF

---

## Cross-state invariants

- Locked palette is the only color source on both routes (no `text-blue-600`, `bg-orange-50`, etc. from OLD)
- All numbers / file sizes / fees / dates / IDs in JetBrains Mono
- Products page `useListingWizard === true` path passes through to `<ListingWizard />` unchanged (only the wrapper H1 + sub-line restyle to locked palette)
- All CSS scoped under `.prd` (products) or `.gal` (gallery) wrapper
- All hover states re-assert color; all disabled states lock bg + color
- Empty states use yellow-pale gradient pattern
- Modals use the ink+yellow primary / white-bordered cancel pattern
