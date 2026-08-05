# Workflow prediction — Bulk Move category + Attach offer

> Mockup: `04-preview/mockups/bulk-move-and-offer.html`, 3 states from the black
> bar (mockup-only chrome, does not ship).

## State 1 — Move category

Three products ticked, bulk bar showing. **Move category** opens a modal holding
the brand's own category tree.

**Prediction:** branches expand on click but cannot be chosen — only item types
(leaves) select, and the confirm button stays disabled until one is picked. On
confirm, the server rewrites all four node-derived columns
(`category_node_id`, `category_key`, `super_category`, `section`) so a moved
product's category-scoped offers keep matching. SKU, photos, variants and price
are untouched.

## State 2 — Attach offer

The picker splits in two. Offers that can carry a product list sit on top and
are selectable. Everything else is listed below, greyed, each with the reason it
cannot.

**Prediction:** the greyed list is not padding — it is the honest answer to "why
isn't my bundle here?". Bundle, BOGO and free-gift configs are not flat product
lists, and a store- or category-scoped offer ignores its products array
entirely, so attaching would be a silent no-op. Attaching the same products
twice reports "already on it" and changes nothing.

## State 3 — The result line

`2 products moved to Kurtas. 1 skipped: "Silk Blend Kurta" — Sleeve length is
required.`

**Prediction:** this is the shape of every outcome from both actions. Neither
endpoint returns a bare success — each answers per product, and the UI names
what it refused and why. A product that cannot satisfy the target leaf's facets,
or whose sizes are not valid under the target's size system, is refused rather
than moved and left broken.

## What should NOT change

The offer engine's evaluation at checkout (`offer.service.js` is read, never
written) · the offer builder · the wizard · SKU generation · every other bulk
action already shipped.
