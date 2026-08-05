# Feature Spec — Bulk Move category + Attach offer

> Completes the two bulk actions deferred from `listing-workspace-ux`, which
> were parked because both need backend work. Founder go 2026-08-04.

## Problem / goal

The Listings → Inventory bulk bar ships Hide / Show / Edit price / Remove. Two
more were designed and cut:

- **Move category** — a mis-filed product (a kurta listed under Shirts) can only
  be fixed today by deleting and re-adding it, losing its SKU and photos.
  `updateListingProduct` deliberately preserves `category_node_id`.
- **Attach offer** — an offer can only be scoped to products from inside the
  offer builder, one offer at a time. There is no way to go the other
  direction: "these 12 products, put them on the Monsoon Sale."

Role: **brand**.

## Scope

- **In scope**
  - `POST /brands/me/listing-products/move` — move N products to a target leaf.
  - `POST /brands/me/offers/:id/products` — add N products to an offer's scope.
  - Both return **per-product outcomes**, never a bare success.
  - Bulk-bar buttons + a category-picker modal and an offer-picker modal.
  - Pure eligibility rules extracted to a service and unit-tested.

- **Explicitly out of scope**
  - Detaching products from an offer (the offer builder already edits its own
    product list).
  - Moving to a non-leaf node — products live on leaves.
  - Creating an offer from the inventory screen.
  - Any change to how offers are *evaluated* at checkout (`offer.service.js`
    is read, never modified).

## Surfaces touched

- brand-web (`InventoryBrowser`, `lib/api.js`), backend (new service + 2
  controllers + 2 routes). No mobile, no admin.

## Data / contracts

**No migration. No schema change.** Both endpoints write columns that already
exist.

### Move — what a move actually has to write

`insertProducts` (`listing.controller.js:122`) derives **four** columns from the
node, not one:

| column | source |
|---|---|
| `category_node_id` | `node.id` |
| `category_key` | `node.vertical` |
| `super_category` | `node.segment` |
| `section` | `node.category` |

A move that updated only `category_node_id` would leave `section` stale — and
`section` is what category-scoped offers match on. All four are rewritten
together.

**SKU is safe.** It is `${storeCode}-${pad4(seq)}` — a brand-level sequence with
no category component — so a move never invalidates a SKU or its
`variants_json`.

**Facets are per-leaf, so a move can be invalid.** Every product is validated
against the target leaf with the same `taxonomy.validateItem` used by create and
edit; a product missing a facet the target requires is **refused with a reason**,
not moved and left broken.

**Sizes are checked against the target's vocabulary.** The backend already owns
the size systems (`listingBulk.service.js` `SIZE_SYSTEMS`, used to build the
Excel templates), so rather than assuming any change of `size_system` is fatal,
a product's actual size values are validated against the target leaf's system.
Moving a Free-Size kurta between two free-size leaves passes; moving alpha-sized
shirts into UK-sized footwear is refused, naming the offending sizes. That
export is the single definition of the vocabulary — no second copy.

### Attach — what an offer can actually accept

Offers have no product join table. Scope lives inside `offer_config_json`, and
`offer.service.js:104` resolves it three ways: `store`, `category`, `products`.
Consequences, all verified in that file:

- Only **`discount`** and **`volume`** offers take a flat product list.
- **`bundle`** also has a `products` array but it is the bundle *set* — every
  entry must be in the cart for the offer to fire (`offer.service.js:344`).
  Adding unrelated products would silently break the bundle.
- **`bogo`** (`buy_product`/`get_product`) and **`free_gift`**
  (`offers[{main,gift}]`) use pair shapes, not a list.
- An offer explicitly scoped `store` or `category` **ignores** its products
  array (`filterItemsByScope`). Attaching there would be a silent no-op.

So the picker lists only offers that can actually honour the attachment, and
tells the brand why the others are excluded rather than hiding them.

## Non-functional

- Auth: both endpoints `authenticate` + `requireRole('brand')`, and every
  product and offer id is re-checked against the caller's `brand_id` — a
  product from another brand is silently excluded, never moved or attached.
- Move runs in a transaction per request; a refused product blocks only itself.
- Attach is a read-modify-write on one JSONB column; it dedupes by product id so
  attaching twice is idempotent.
