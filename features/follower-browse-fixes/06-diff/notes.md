# 06 — Before / after notes

**Before:** "All" tile → legacy global Find screen; filter sheet faint/rough.
**After:** "All" → in-world category browser ("All categories"); filter sheet = handle +
rounded pills + solid-pink selected + roomier layout (`04-preview/mockups/filter-sheet.html`).

## Delivered vs mock
- `navigateCategory` All-tile case → `CategoryBrowser { vertical }`; browser vertical-entry
  drills the first segment so the grid isn't empty — matches "stay in fashion world".
- Filter sheet styles updated (handle, radius 22, vpill radius 20, `vpillOn` solid pink) —
  matches the mock.

## Filter UI rebuild (founder live-test follow-up 2026-06-27)
The restyled single-scroll sheet still read poorly on-device — the **chips rendered as
tall "long boxes"** (the horizontal chip ScrollView wasn't height-constrained inside the
flex column). Founder gave two reference screenshots (Myntra/Flipkart). Rebuilt:
- **Chips:** wrapped in a fixed-height `chipRow` (48px) → compact dropdown pills (no more
  tall boxes); each facet chip opens the modal focused on that facet.
- **Filter modal → LEFT-NAV pattern:** facet names down the left (Sort + each filter),
  the selected facet's values on the right (radio rows for Sort, checkbox rows for
  filters), `Clear filters` / `Apply` footer. Replaces the single-scroll sheet.

## Batch 2 (founder live-test 2026-06-27)
- **"All categories" was broken** — the vertical entry drilled into the first segment and
  showed an empty product grid ("0 items"). Rebuilt: "All categories" now renders a clean
  **grid of rounded category tiles grouped by segment**; tapping one opens the browser for
  that category. (`isAllMode` render path.)
- **＋ quick-add to cart** — every product card in the grid gets a ＋ button → adds to cart
  (organic, qty 1; cross-brand → "Start a new cart?" confirm). A **cart bar** ("N items ·
  ₹total · View cart") floats at the bottom when the cart has items.
- **Tap feedback** — ＋ fires `Vibration.vibrate(10)` + a quick scale-bounce animation.

## Batch 3 (founder live-test 2026-06-27)
- **Cross-brand prompt is now FOOD-ONLY.** `CartContext` gains a cart `kind`: food =
  one restaurant per cart (delivery), shop = multi-brand allowed (fashion/furniture/…).
  Shopping adds pass `cartKind:'shop'` → no "Start a new cart?" prompt; lines tagged with
  `brand_id`/`brand_name`. **NOTE: multi-brand CHECKOUT (split into per-brand orders) is
  the follow-up — the cart now accumulates multiple brands.**
- **＋ feedback** — `Vibration` needs the VIBRATE permission, which was MISSING from the
  manifest (added now, but native → only works after an APK rebuild). So the OTA feedback
  is a strong **visual**: the ＋ scale-bounces and briefly turns into a green ✓.
- **Cart bar** redesigned to show small **product thumbnails** (overlapping) + item count +
  total + "View cart →" (matches the founder's reference).

## Batch 4 (founder live-test 2026-06-27 — variant popup)
- **＋ on a product with variants → a "Select variant" sheet** (founder reference): colour
  swatches (sold-out dimmed), size pills with per-size price + "N left" stock, a product
  summary, and ADD → adds the chosen colour + size (`variant_sku`/`variant_label`).
  Vertical-agnostic (any world with `variants_json.colors[]`). No-variant products keep
  the direct ＋ add.
- Backend `getNodeProducts`/`mapBrowseProduct` now surface a `variants` summary +
  `has_variants` (added `bp.variants_json` to the SELECT).
- Founder CONFIRMED the multi-brand model: one customer-facing cart/order list (items,
  discounts, total), backend splits per brand internally → **checkout batch** (queued).

## Verification
- Backend load ok; `pnpm qa` GREEN 79; mobile babel-compile clean; jest 20/20.
- Capture after Render + OTA + founder re-test. (VIBRATE = next APK.)

## Follow-up fixes (2026-06-28, founder E2E testing)
- **Cross-brand "replace cart?" popup on the product page (bug):** the ＋ quick-add
  passed `cartKind:'shop'` (multi-brand, no prompt) but `ProductDetailScreen.addToCart`
  passed `extra` WITHOUT `cartKind` → defaulted to `food` → wrongly showed the
  single-brand replace prompt. Fixed: PDP add now passes `cartKind:'shop'` (the
  product page is the shopping path; dining uses RestaurantDetail). `ProductDetailScreen.js`.
- **＋ on every product card (consistency):** the section/"Top Trending" shop card
  (`ShelfProductCard`) had no ＋ (only food's `FoodDishCard` did). Added a ＋ button
  (`onAdd`) to `ShelfProductCard`; `SectionRenderer` wires it for shop products →
  opens the PDP to pick variant + add (section payload carries no variant data, so a
  size-less fashion item can't be added silently). `ShelfProductCard.js`, `SectionRenderer.js`.
- Verified: babel-clean (3 files), jest 25/25 (FollowerWallet baseline excl.). Mobile OTA only.
