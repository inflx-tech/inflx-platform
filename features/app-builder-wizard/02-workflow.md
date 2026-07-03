# Workflow Definition — App Builder 4-step wizard

> Step 3. Each numbered step becomes an assertion in the QA workflow test.

## Actor
Logged-in admin on `/admin/sections` (local brand-web against local backend,
same as the existing admin QA lane).

## Preconditions
- P1 backend live (starts_at/ends_at accepted; config validation on).
- At least one existing shelf in the Home scope (edit + regression baseline).
- Section Library reachable (for inline rule builder + preview).

## Workflow steps (user-observable)
1. Admin clicks **Add section** → wizard opens on **1 Design**: grouped
   thumbnail grid with business names; P3-only designs greyed with "P3" chip
   and not selectable.
2. Admin picks **Product shelf** → **2 Content** shows tabs Automatic /
   My rule (My images locked for this design); picks *Automatic → "Products
   in this world"* → sample note visible.
3. **3 Display** → world preselected from the builder scope; admin sets
   `ends_at` = tomorrow via the picker → summary chip shows "Live until
   <date>".
4. **4 Action** → default "Product grid (see all)" preselected → **Publish**
   → PUT succeeds; shelf list shows the new row with template name
   "Product shelf" + schedule chip; live phone preview shows the shelf.
5. Admin adds a second section, picks **Image cards** → Content locks to
   *My images*; uploads/enters a tile with label; **4 Action** per-tile:
   Custom page → picks a page key → Publish succeeds; row visible.
6. Admin creates a **Deals shelf** via *My rule*: inline builder (business=
   fashion, has_offer, min 20%) → "Matches N products" preview renders →
   Publish → succeeds (library row created + placed).
7. Admin opens the PRE-EXISTING legacy shelf → wizard opens with resolved
   design name, existing values intact → changes only the title → Publish →
   row updated, nothing else changed (config_json round-trips).
8. Validation surfacing: admin sets `ends_at` earlier than `starts_at` →
   inline error on step 3 naming the field; Publish blocked until fixed.
9. Retirements: the Add flow's Automatic list contains NO `top_by_sales` and
   NO offer-gated creator twins; a NEW products shelf saved via wizard uses
   `products_in_category`. Collections preset absent.
10. Regression: all previously-rendered shelves in the scope still render in
    the live preview and on the follower endpoint after the session.

## Success definition
An admin can create all three section kinds end-to-end through ONE wizard
(steps 2, 5, 6), edit a legacy row losslessly (7), schedule visually (3, 8),
and the dead/duplicate pickers are gone (9) — with zero regression (10).

## Failure / edge workflows
- Library preview endpoint down → "preview unavailable" note, Publish still
  possible.
- PUT 422 (backend validation) → error mapped to the wizard step that owns
  the field.
- Unknown legacy config shape → wizard shows raw-JSON fallback panel instead
  of a broken form.
