# Workflow Definition — offer-engine-library-ui (Sub-contract B)

> Step 3. User-observable workflow for the offer library page.

## Actor
Logged-in **brand**, approved. Has ≥1 product in its catalogue (for product-
scoped / BOGO / bundle / free-gift authoring).

## Preconditions
- Sub-contract A API live (`/brands/me/offers`).
- Brand authenticated (layout guard passes).

## Workflow steps (user-observable)
1. Brand clicks **Offers** in the topbar → lands on `/dashboard/offers`.
2. First visit (no offers) → empty state with "Design your first offer" + CTA.
3. Click **New offer** → builder opens. Brand enters a name, picks a type
   (Discount / Volume / BOGO / Bundle / Free gift); the per-type fields render;
   a live-preview line summarises the offer.
4. For Discount/Volume: choose scope (Whole store / Category / Products). Category
   → pick a section; Products → pick from catalogue. For BOGO/Bundle/Free gift:
   pick the product(s).
5. Toggle availing modes (pay-at-store / online order / pre-book / enquiry).
6. Click **Save** → `POST /brands/me/offers` → on success the offer appears in the
   list with status (draft, or active if activated), toast confirms.
7. Brand edits an offer → builder pre-fills from its `offer_config_json` →
   **Save** → `PATCH` → list updates.
8. Brand switches an offer to Active via the row/menu → `PATCH {status:'active'}`.
9. Brand archives an offer → `DELETE` → it moves to the Archived tab (soft
   archive; row remains).
10. Status tabs (All/Active/Drafts/Archived), the type filter, and search narrow
    the visible list using the API `?status=&type=&q=` filters (or client-side).

## Success definition
SUCCESSFUL only if: a brand can create an offer of each of the 5 types via the
builder, see it listed with the correct type + status, edit it (config pre-fills
and round-trips), activate it, and archive it — all through `/brands/me/offers`,
with the page matching the locked mockups (01-offers-list, 02-offer-builder) and
the existing campaign discount builder untouched.

## Failure / edge workflows
- Save with an invalid/incomplete config (e.g. bundle with <2 products or no
  price) → API 422 → field error shown, modal stays open, nothing persisted.
- Empty catalogue → product pickers show "add products first" hint; store/
  category-scoped discounts still authorable.
- Not authenticated → layout guard redirects to /login (API never called).
