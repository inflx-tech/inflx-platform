# Product approval — the admin switch

**Asked for:** founder, 26 Oct 2026.

> "Brand first list then publish the listed products, for that I need to give approval for those
> to go live. Here as an admin I need a toggle for this: if I switch it on then this approval
> feature is on and all published products need admin approval to go live; if the toggle is off
> then no need of permission."

---

## 1. What this is

**One switch in Admin → Settings → Platform that decides whether a brand's published product
goes live at once, or waits for INFLX.**

- **OFF** — exactly what happens today. A brand publishes, the product is in its store.
- **ON** — a brand publishes, the product is **waiting for INFLX approval**. It is not in the
  store, not in a creator's product list, not in a post, not in an offer's live set, until an
  admin approves it from the new **Product Queue**. An admin can also send it back with a
  reason; the brand sees the reason and can fix the product and send it again.

The switch ships **OFF**, so applying this changes nothing for anybody until an admin turns it on.

## 2. What "live" is, and why nothing downstream changes

Verified by reading the code (26 Oct 2026): every shopper, creator, offer and discovery reader of
a product tests `brand_products.is_active AND pushed_to_store` (brandProducts.service `PUBLISHED`,
sectionRules, shopperStores, shoppablePosts, creatorTerms, follower.service, discovery, remoteParcel,
orderPricing, listing.controller's public browse, invitationInputs, offerConfig.validator). The
brand's own screens draw `pushed_to_store` as **In store / Hidden**.

So **`pushed_to_store` stays the one and only live flag.** Approval decides *when it may become
true*; it never adds a second gate. Not one reader is edited. A waiting product is simply a
product with `pushed_to_store = false` plus a reason the brand can see.

## 3. The state on a product

New columns on `brand_products` (migration 211):

| column | meaning |
|---|---|
| `approval_status` | `approved` (default — every existing product, and every product published while the switch is off) · `pending` (waiting) · `rejected` (sent back, with a note) · `withdrawn` (the brand hid it while it was waiting) |
| `approval_requested_at` | when it was last sent for approval |
| `approval_decided_at`, `approval_decided_by` | the admin's decision |
| `approval_note` | the reason given when sent back; cleared on approval |

The invariant: **a product is `pushed_to_store = true` only while `approval_status = 'approved'`.**

## 4. Where the gate sits

Every way a brand publishes passes through one function, `productApproval.gatePublish(brand, product)`:

1. **Create** — `POST /brands/me/products` (the generic create), `POST /brands/me/products/batch`
   and the Excel import (both through listing.controller `insertProducts`), and the master-catalogue
   activation in brand.controller. Switch on → inserted with `pushed_to_store = false`,
   `approval_status = 'pending'`.
2. **Show in store** — `PATCH /brands/me/products/:id { pushed_to_store: true }` on a product whose
   `approval_status` is not `approved` (never approved, sent back, or withdrawn). Switch on → it
   becomes `pending` instead; `pushed_to_store` stays false. The response says so.
3. **Hide** — `PATCH … { pushed_to_store: false }` on a `pending` product → `withdrawn`: it leaves
   the queue. Showing it again sends it again.

**Once approved, a product is approved.** The brand may hide and show it freely, and edit it,
without a second review (decision D4 — the founder asked for approval of *published products*,
not of every edit; a re-review rule can be added later as its own contract). Products that existed
before the switch is turned on are `approved` by default and are not touched.

## 5. The admin's side

- **Product Queue** — `Packages/brand-web/app/admin/products/page.js`, under the Approvals
  capability, tabs *Waiting · Approved · Sent back*, each product with brand, name, price, photo,
  category, when it was sent. **Approve** makes it live (`pushed_to_store = true`,
  `approval_status = 'approved'`). **Send back** takes a reason (required) and leaves it off the store.
- Nav entry **Product Queue** with a badge of the waiting count; the Approvals summary page gains a
  tile and a card; `/admin/stats` gains `pending_products`.
- The switch — `product_approval_required` in `platform_settings`, drawn on Settings → Platform by
  the existing switch renderer, with its description.
- **Turning the switch OFF releases every waiting product at once** (decision D7): the brand asked
  for it to be live and permission is no longer needed. They become `approved` with the note
  *"released: approval switched off"*, and their creators are told the product is on sale the same
  way an approval tells them. Turning it ON changes nothing already live.

## 6. What the brand sees

- The products list: a **Waiting for INFLX approval** pill (blue) instead of In store / Hidden on
  a pending product; **Sent back** (red) with the reason under the name on a rejected one; the
  In-store toggle still works and means *send / withdraw*.
- The listing wizard's finish screen: with the switch on, *"Sent to INFLX for approval"* and
  *"Your products go live in your store once INFLX approves them"* instead of *"You're live"*.
- A notification on each decision: *"<product> is live in your store"* / *"<product> was not
  approved: <reason>"*.

## 7. Out of scope

- The brand mobile app lists no products of its own and publishes none (verified: `ProductPicker`
  reads `is_active` only, for campaign sets). No OTA.
- No re-review on edit (D4). No per-brand exemption. No bulk approve. No automatic approval timer.
- Offers and posts are not approved here; they keep their own flows.

## 8. Decisions

| # | decision |
|---|---|
| D1 | one switch, `product_approval_required`, ships OFF |
| D2 | `pushed_to_store` stays the only live flag; no reader changes |
| D3 | four states: approved / pending / rejected / withdrawn |
| D4 | approval is once per product; edits and re-showing an approved product need no review |
| D5 | hiding a waiting product withdraws it; showing sends it again |
| D6 | a sent-back product is re-sent by the brand with Show, after fixing it |
| D7 | switch OFF releases every waiting product; switch ON touches nothing live |
| D8 | queue under the Approvals capability, like the Post Queue |
| D9 | the brand is told by notification on each decision |
| D10 | reason is required on Send back |
