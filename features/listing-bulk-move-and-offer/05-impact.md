# Impact — Bulk Move category + Attach offer

## Verdict

**Two new brand-scoped endpoints, no schema change.** Both write columns that
already exist, reuse the validators create/edit already use, and answer per
product so nothing fails silently.

## Mechanics

### Blast radius

| Area | Effect |
|---|---|
| Database | **Untouched.** No migration, no new table or column. |
| `offer.service.js` | **Read, never modified.** Its rules dictate what an attach may do; checkout evaluation is unchanged. |
| Existing endpoints | **Untouched.** Two additive routes. |
| Mobile / admin-web | **Untouched.** |
| backend | New `listingBulkActions.service.js` (pure rules) + 2 controllers + 2 routes. One additive export added to `listingBulk.service.js`. |
| brand-web | `InventoryBrowser` gains 2 bulk buttons + 2 modals; 2 api helpers; modal CSS. |

### Why the move is safe

`insertProducts` derives four columns from the node. A move that rewrote only
`category_node_id` would leave `section` pointing at the old category — and
`section` is what category-scoped offers match on, so the product would keep
receiving a discount for a category it no longer belongs to. All four are
rewritten in one transaction.

SKU is `${storeCode}-${pad4(seq)}` — a brand-level sequence with no category
component — so a move cannot invalidate a SKU or the `variants_json` built from
it. Photos, price and stock are not touched.

Eligibility runs through `taxonomy.validateItem`, the same gate as create and
edit, so a move can never land a product the edit form would reject.

### Why the attach is safe

The merged config goes through `validateOfferConfig` — the shared validator used
by offer create and update — before it is written. That re-checks shape *and*
catalogue ownership, so this path cannot write a config the offer builder would
refuse, and cannot smuggle in another brand's product.

### The risks worth naming

- **Move is not reversible in one click.** There is no undo; the brand moves it
  back the same way. Acceptable — nothing is destroyed, and the target is
  explicit in the modal before confirming.
- **Attach narrows nothing by surprise, by design.** The one genuinely dangerous
  case — a legacy offer with no `scope` and an empty products array, which
  `resolveScope` treats as store-wide — is **refused**, because attaching would
  silently shrink a store-wide discount to a handful of products. The brand must
  set the scope deliberately in the offer builder first.
- **The client mirrors the offer rule** to sort the picker. That is a display
  convenience and can drift from the server; the server re-checks independently
  and is authoritative. Marked as such in the code.
- **Bulk move is one transaction.** A DB failure rolls back every move in the
  request; refusals are decided before the transaction opens, so they never
  cause a partial write.

## Release classification

**Production-impacting** — `backend/src/**` (Render) and `Packages/brand-web/**`
(Vercel). No migration, so deploy order does not matter; the frontend simply
cannot call the endpoints until the backend is up.

## Rollback

Revert the commit. No data migration ran. Products already moved stay moved —
that is a legitimate data edit the brand made, not something the rollback should
undo.
