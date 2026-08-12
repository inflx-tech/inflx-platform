# Before / after — the creator side

Mockup: `04-preview/mockups/creator-side.html` (5 panels, locked 2026-08-12).
Tests: `qa/unit/creator-settled-terms-and-discovery.spec.ts` (23).

Both features exist because a value that was **already stored was delivered to nobody** —
the fault family in `feedback_computed_is_not_delivered`. So the two summarisers are
executed on real inputs rather than grepped for, and the query carrying them is asserted to
actually select the columns.

---

## The invite for terms already agreed

**Before.** Asha settles 15% and a 15 September post-by date with Kanchi Silks over three
days. A week later the campaign invite arrives showing 15% and 15 September — with nothing
saying these are the numbers she negotiated. It reads as a brand-new offer, and a
**Negotiate button sits there implying the terms are open**, when the server has refused
renegotiation since Part 2. The link to the agreement was stored on every collaboration and
returned to the creator on no endpoint at all.

**After.** The collaboration detail returns `agreement_id`, the settled terms and the date
they were agreed, and the screen splits in two:

- **✓ Already agreed with you** — commission or fee, and the post-by date or window, over
  *"Settled with Kanchi Silks on 8 Aug 2026. Nothing to decide again."*
- **New in this campaign** — the coupon code, what she can sell, the brief, any offer.

Negotiate is hidden **for these collaborations only**. That is not a removal — it is the
screen stopping short of promising something the server would reject.

**A cold invite is untouched:** one undivided list, and the full accept / decline /
negotiate choice. `summariseSettledTerms` returns `null` rather than an empty shell
precisely so a creator who never negotiated is never shown an empty "already agreed" box.

## What she is allowed to sell

**Before.** The allocated products were reachable on their own screen, but the *rule* behind
them was never stated. Twelve new sarees would appear and Asha could not tell whether that
was intended. A creator given a fixed list of twelve had no way to know nothing would ever
be added.

**After.** One line: *"You can sell: Their whole store"* / *"Ethnic Wear"* / *"12 selected
products"* — carrying `auto_joins_new_products`, because that is the distinction that
actually matters to the creator. Singular is handled (`1 selected product`).

## Finding brands

**Before.** Name search only, while every row already displayed the brand's industry and
city — both sent to the phone, neither filterable.

**After.** Industry and city are filters on the same request. Tapping an active chip clears
it. The available values are **derived from the same eligibility conditions as the list**,
so a filter that would return nothing is never offered, and they ride along on the same
response rather than costing a second round trip.

---

## Predictions vs what shipped

- **The web surface in the first draft did not exist.** The spec said 6.2 ships "web and
  mobile" and carried a P1 assertion for it. `brand-web` is the brand + admin dashboard and
  contains no reference to brand discovery; creators are mobile-only. Corrected **before**
  the lock rather than satisfied by building a page nobody asked for.
- **`collab_agreements` has no `agreed_at` column.** The first draft of the query selected
  one, which would have thrown on every creator collaboration detail. The row is *created*
  at the moment of acceptance, so `created_at` is the agreed date. Caught by reading the
  prod schema, then proved by running the finished query against production read-only.

## What the checks caught

- **One assertion of mine was too crude.** B8 forbade interpolating a filter value into
  SQL and matched `params.push(\`%${search}%\`)` — which builds the bound *value*, not the
  query, and is not an injection surface. Narrowed to the lines that build the SQL string.
  No production code changed.
- **`pnpm qa` failed first at 380/386, then passed at 386/386 with nothing changed.** All
  six failures were in the API lane at exactly 60.0s — a timeout signature. Probing the
  backend showed it answering in 1.5s then 0.67s: it had spun down during the run and the
  probe woke it. The same six specs failed the same way in Part 5's first run and cleared
  identically. Classified as the documented Render cold start
  (`reference_render_cold_start`), not a defect, and **not** a weakened test — nothing was
  skipped, relaxed or deleted.

## Recorded, deliberately not built

**Creators cannot ask to join a live campaign, and this contract keeps it that way on
purpose.** The brand half is complete — an application inbox, approve/reject, and
auto-decline once a set fills — but **nothing in the backend can create an application**;
all three insert sites write `'invited'`. Production has never seen one, and has never had
an open-group set at all.

A test now walks every backend file and asserts no writer exists, so a future half-build is
a deliberate act rather than an accident. Two things for whoever picks it up:

1. **It would not work as-is.** An open-group joiner carries no allocation and no
   commission rate (Part 4 leftover), and since Part 4 having something to sell *is* the
   discovery gate — so they would join and be unable to sell.
2. **The notification lies.** Publishing an open group pushes *"Apply now!"* to creators and
   deep-links to `open_offers`, a screen in neither app. It has never fired.

Brands already reach creators three working ways, including automatic invitations to
everyone matching their filters, so nothing is blocked by this gap.

---

Suite: **386 passed, gate 0, STATE=GREEN.** Mobile: full production RN bundle builds.
No migration — `agreement_id` (Part 2) and `alloc_*` (Part 4) already existed.
Maestro skipped per founder — `released` stays false.
