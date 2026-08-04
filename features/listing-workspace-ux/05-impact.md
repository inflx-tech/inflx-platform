# Impact — Listing Workspace UX

## Verdict

**Zero functional disturbance — layout + navigation only.** One new client-side
capability (bulk Hide/Show/Remove/Edit price) built entirely on endpoints that
already exist.

## Mechanics

### Blast radius

> **Amended 2026-08-04:** the push also carries a one-line backend fix under its
> own contract, `backend-defect-inventory-hidden-products` (hidden products were
> unreachable from the category browse). The release is therefore **backend +
> brand-web**, not brand-web alone. Everything below still describes this
> contract's own blast radius.

| Area | Effect |
|---|---|
| `backend/**` | **Untouched by this contract.** The sibling defect contract changes one WHERE clause in `getMyNodeProducts` — no route, migration or seed. |
| Database | **Untouched.** No schema change, no data migration. |
| Mobile | **Untouched.** Not a Mobile-governed release; no Maestro gate. |
| admin-web | **Untouched.** |
| brand-web | `app/dashboard/products/listing/page.js` restructured; new shared `CategoryTree` + `InventoryBrowser` components. |

### Why the layout change is safe

The 960px cap lives only at `listing/page.js:658`. The dashboard shell
(`app/dashboard/layout.js:211`) is already `flex-1 p-7` with no width
constraint, so widening the page fights nothing upstream and cannot affect any
sibling route.

### Why the behaviour change is safe

Every handler — `drillInto`, `jumpTo`, `addItem`, `saveBatch`, `saveEdit`,
`handleImport`, `addTrayPhoto`, `pickImages`, `addImagesFromUrls`, the step
validators and `renderFacet` — is carried over unchanged. The work is in the
JSX wrappers and CSS that surround them, plus where the staging tray is
rendered. The wizard's validation contract (`stepErrors` / `draftErrors`
stricter-or-equal to `taxonomy.validateItem`) is untouched, so nothing new can
reach the server.

### Bulk actions — the one genuinely new behaviour

Bulk Hide / Show / Remove loop `brandApi.updateProduct(id, {is_active})` and
`brandApi.deleteProduct(id)`; bulk Edit price loops
`brandApi.updateProduct(id, {price})`. These are the same calls the existing
single-row buttons make, issued N times. Consequences to be aware of:

- **Not transactional.** A partial failure leaves some rows changed. Mitigation:
  the UI reports `n updated, m failed` and refetches from the server rather than
  assuming success — no optimistic lying.
- **Remove is destructive** and already exists per row; the bulk version keeps a
  typed confirmation before firing.
- N sequential requests on a large selection is slower than one bulk endpoint. A
  real bulk endpoint is the right fix later; it is not needed to ship this.

### Deferred, and why

- **Move category** — `updateListingProduct` reads `category_node_id` from the
  existing row and never writes it (`listing.controller.js:725–729`, leaf
  explicitly preserved). Re-parenting is a backend change.
- **Attach offer** — `brandOffer.routes.js` has no attach endpoint, only
  `GET /offers/:id/attachments`.

Both are drawn out of the locked mockup so the mockup matches what ships.

## Release classification

**Production-impacting** — `Packages/brand-web/**` runtime code; `git push`
triggers a Vercel deploy of brand-web. Backend and mobile are unaffected.
Explicit founder go required before push.

## Rollback

Single-surface revert: `git revert` the implementation commit restores the
960px page. No data written, so nothing to unwind.
