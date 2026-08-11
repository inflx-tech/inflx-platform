# Before / after — Part 4 Offers and allocation

One UI surface changed: **campaign creation, Step 2, the per-creator terms sub-step.**
Everything else in this contract is backend or data, listed at the end.

Mockup: `04-preview/mockups/web-allocation-scope.html` (locked 2026-08-11 after two
rounds of founder feedback).

---

## Terms sub-step — what a creator can sell

**Before.** There was no such question. What a creator could sell was inferred from the
**shape of their discount**: the offer builder's `Whole store / Category / Products`
toggle, present once per offer type (`d_scope` for Discount, `v_scope` for Volume), was
read by the server to decide the creator's product universe.

Three consequences, all visible to a brand:
- **No offer meant no products.** A creator could not be set up to sell at full price on
  commission alone — the invite was rejected outright.
- Editing a discount silently changed what the creator was allowed to sell.
- "Sell the whole store, discount one category" was impossible to express, because both
  meanings shared one control.

**After.** Two separate questions, asked separately, allocation first:

*"What \<creator\> can sell"* — `Whole store / Category / Products`, with the offer block
below it retitled **optional** and its copy saying plainly that leaving it empty means
selling at full price while still earning commission.

- **Whole store** — "Every published product. Anything you publish later is added
  automatically."
- **Category** — a real expandable tree with a product count at every level; picking a
  parent includes everything beneath it, now and later.
- **Products** — a fixed list, with "products you publish later are **not** added
  automatically" stated on the control.

## Category picker — flat select → tree

**Before.** A single `<select>` of breadcrumb strings — `Women › Footwear › Sandals (23)`
— every depth flattened into one list. Workable for three categories, unusable for a real
catalogue.

**After.** An expandable tree, indented by depth, product count on every node, click to
select at any level. Brands with no taxonomy fall back to the flat section list, which is
what the server accepts as the legacy category label — so the control still works for them.

## Selected products — chips → a real list

**Before.** Name-only chips (`Silk Kurta ✕`). You could not tell at a glance what a
creator had been given.

**After.** One row per product: image, title, category/SKU, price, remove. The picker
itself is unchanged — it already had search, category filters, image, title and price;
an early draft of the mockup understated that and was corrected.

## Deltas vs the locked mockup

- **The mockup showed an allocation control for open groups. The implementation does
  not.** Publish-time materialisation of joiners inserts only
  `(set_id, influencer_id, status, influencer_budget, offer_expires_at)` — no offer, no
  commission, nowhere to put an allocation. The control was built, then removed, because
  it would have silently done nothing. Pinned by test X4 so it is not added back before
  the backend can carry it. Recorded as a follow-up.
- The selected-product list resolves each product against the live catalogue at render
  time rather than trusting the stored object. Hydration restores only ids and the
  catalogue loads asynchronously, so a reopened draft would otherwise read "Product ₹0"
  purely from load order.

## Unchanged, deliberately

Step order, step count, goal placement (still Step 2), layout, palette, the Apply-to-all
behaviour, and the offer builder itself — which keeps its own scope control, now used only
for what the **discount** applies to.

---

## Not visible in this diff (backend / data)

- **Allocation owns its scope** (migration 148). The resolver reads the allocation, never
  the offer. Backfill asserts per row that all 19 production collaborations resolve to the
  **same product set as before**.
- **Eight gates, not seven.** Six read gates widened; the eighth — a *write* gate on
  invite — was found late and mattered most: it refused to create a conversion
  collaboration without an offer, so full-price selling had been made readable while
  remaining impossible to set up.
- **Allocation write path** — invite and update validate scope, category node and product
  list, refusing another brand's products and unpublished ones. An omitted allocation
  leaves the existing one alone, so editing a fee cannot wipe what a creator may sell.
- **Global offers reach creators** for the first time, best single offer per checkout,
  scored against the whole cart by the untouched pricing engine.
- **Display parity** — the creator storefront uses the same product-card evaluator as the
  discovery shelves; found and fixed a bug where the fields were computed then discarded
  by a field whitelist.
- **Cart-shaped badges** — volume/bundle/BOGO/free-gift now surface as availability
  badges, each matched on its own product keys so a BOGO is not badged across the whole
  catalogue.
- **Expiry** — an expired offer stops applying at checkout *and* stops being advertised on
  all seven payload surfaces.

Tests: 46 new across six specs. Suite 222 passed, gate 0, STATE=GREEN.

**Browser verification of the allocation control is OWED** — it sits behind
goal → basics → fork → creator-pick, which needs a long brittle interaction chain, so it
is source-verified rather than browser-verified. Stated plainly because earlier in this
contract a green test asserted a value was computed while a whitelist silently discarded
it. A natural thing for the founder to hit during their walkthrough.
