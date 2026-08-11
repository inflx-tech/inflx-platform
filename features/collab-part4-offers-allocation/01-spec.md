# Part 4 — Offers and allocation

Program: Collaboration Restructure (`Docs/COLLAB_RESTRUCTURE_PLAN.md`), Part 4 of 7.
Status: **LOCKED 2026-08-11** — founder: *"ok this is fine, pls write the contract."*
All three §5 questions resolved: 5.1 answered (published-only), 5.2 and 5.3 dissolved by the
best-single-offer design. Spec is locked; the **wizard scope-chooser mockup is NOT yet made or
locked**, so no `Packages/**` commit may land until it is (gov-check Rule 3). Backend work
carries no such gate.

---

## The model (founder, 2026-08-11)

Three independent axes. None constrains the others.

**1. Allocation — what the creator MAY SELL.** A scope declared against the brand's
published store, negotiated between brand and creator:
- **entire store** — every published product; **new products auto-join** (founder's
  explicit choice)
- **category or subcategory** — that subtree; new products in it auto-join
- **individual products** — a fixed list; nothing auto-joins

Allocation is a *declared scope resolved live*, not a frozen snapshot. Publishing is the
brand's lever: unpublished products leave the store and therefore leave every store- and
category-scoped allocation automatically. No extra "exclude from promotion" flag is needed.

**2. Offers — what the CUSTOMER SAVES.** Public-facing mechanics (discount, volume, bogo,
bundle, free_gift), created at two levels, with a precedence rule:
- **Offer engine (global).** Applies to **any** creator who has those products allocated.
  The brand does not assign it per creator.
- **Campaign level (creator-specific).** A special offer for one creator — either built
  inline or a library offer attached to that creator.
- **Precedence: creator-specific overrides global, per product.** If a product is covered
  by both, the campaign-level offer wins for that creator. Other products in the same cart
  keep their global offer.

An offer is entirely optional. A creator can hold products with no offer at all.

**3. Commission — what the CREATOR EARNS.** A percentage per creator, on the net value of
attributed sales, independent of whether any discount existed.

---

## Verified state of the code

| Claim | Reality | Evidence |
|---|---|---|
| Allocation has its own scope | **No.** `resolveAllocatedProductIds` reads `offer_config_json.scope` — the *offer's* scope — to decide what a creator may sell. This one read is the conflation behind everything else. | `follower.service.js:218-243` |
| A creator can sell without an offer | **No — blocked in 7 places**, including `validateTracking`, so a commission-only sale cannot even be *recorded*, let alone displayed. | `follower.service.js:114,162`; `follower.controller.js:729,752,1773`; `brandOffers.adapter.js:390`; `transaction.service.js:165` |
| Global offer-engine offers reach creators | **No.** Global publishing exists but only for the brand's own store and discovery. The creator path consults **only** the per-creator assignment (`bo.id = ci.brand_offer_id`) or the inline config. There is no global→creator application and therefore **no precedence logic at all**. | `brandOffers.adapter.js:388`; `follower.service.js:556`; `sectionRules.service.js:194`; `transaction.controller.js:541-557` |
| An offer can expire independently | **No.** The set-level table has no date columns, the inline config carries none, and `offer_expires_at` is the invitation-acceptance clock driven by `offer-expiry.job` — reusing it would silently expire invitations. Library offers do have `store_ends_at`, but the coupon path ignores it. | `001:327-339`; `002:20`; `offer-expiry.job.js`; `follower.controller.js:1772` |
| The set-level offer table is live | **Dead, and empty.** No app writes it; its only writer is an endpoint no screen calls. **Zero rows in production** — so every `LEFT JOIN` on it contributes only NULLs and every `COALESCE` already falls through. Retiring it is provably inert. | prod query 2026-08-11: `campaign_offers` = 0 rows; 49 references across 14 files |
| The pricing engine can hold two offers at once | **No.** `resolveOfferDiscount` takes **one** offer and applies it to the whole cart, filtered by that offer's scope. Per-product precedence therefore needs a resolution layer above it. | `offer.service.js:399`; 4 call sites in `transaction.controller.js` |
| Commission, attribution, settlement | **Correct, unchanged by this part.** All four attribution IDs on every sale, validated as a chain; commission from the contracted %, into pending balance, released per-category return window, 10% TDS at withdrawal. | `transaction.controller.js:464-490`; `commission.service.js` |

---

## What we build

### 4.1 — Allocation owns its scope

A per-creator allocation carrying `scope` = `store` \| `category` \| `products`, plus the
category reference or product list. `resolveAllocatedProductIds` reads **the allocation**,
never the offer.

Store and category scopes resolve live so new published products auto-join. Product scope
is a fixed list.

**Wizard — verified 2026-08-11, the control already exists.** Founder was right to push back on
this being "new UI". `scopeToggle(scopeField, catField, nodeField, …)` in the campaign wizard
already renders exactly **Whole store / Category / Products**, with a tree-aware category-node
picker (falling back to brand sections) and a separate product-chip picker. It is parameterised
by field name and is currently instantiated **twice — inside the discount offer builder
(`d_scope`) and inside the volume offer builder (`v_scope`)**.

That is the conflation made visible in the UI: the scope control lives inside the offer, per
offer type, which is exactly why allocation is derived from the offer.

So the work is a **move, not an invention** — lift the existing control up one level to a
per-creator allocation control bound to `alloc_*` fields, and drop it from the offer builders
(the offer keeps its own pricing scope server-side). Reused verbatim, no new design.

**Migration:** the 19 existing production collaborations get their allocation scope
backfilled from their offer's current scope, so nothing shifts underneath them.

### 4.2 — Selling without a discount

All 7 offer-required gates come out, because they only existed to guarantee that products
could be derived from an offer. Once allocation stands alone they are obstacles, not
guards. A creator with an allocation and a commission can sell at full price.

A creator with **no allocation** stays hidden — we do not surface empty storefronts.

### 4.3 — Global offers reach creators; the best single offer wins per checkout

The new behaviour, and the design changed during discussion — see §5.2 for why.

**Candidates.** For a given creator, the candidate offers are:
- **creator-specific** — the campaign-level inline offer (`ci.offer_type` +
  `ci.offer_config_json`) and/or a library offer attached to that creator
  (`ci.brand_offer_id`)
- **global** — every offer in the brand's engine that is **published and live**:
  `status = 'active' AND published_to_store = true` and inside
  `store_starts_at`/`store_ends_at` (§5.1, founder-answered)

**Resolution.** Score **each candidate against the whole cart** with the existing pricing
engine, then apply the **single best result for the customer**. Never combine, never stack.

**Why this shape.** `resolveOfferDiscount` is already a pure "score one offer against one
cart" function: it handles all five offer types with their own scope filtering, and returns
`discount_amount: 0` **with a reason** when an offer doesn't apply rather than throwing. That
is exactly the contract a candidate-scoring loop needs, so this is a loop plus a max() with
the tested money maths **completely untouched**.

The founder's override rule survives as a natural consequence: the brand makes a creator's
offer better, so it wins. It can no longer backfire, because a creator-specific offer can
never leave the customer worse off than they'd have been without it.

**Trade-off accepted.** One cart carries one offer. A customer does not get a creator's
jacket deal *and* a global kurta deal in the same basket. This is the near-universal
e-commerce norm ("best available offer applied, cannot be combined"), it has no edge cases
to explain, and it keeps the brand's discount exposure predictable rather than emergent.

**How a brand expresses "10% for everyone, more for Bilal":** state the final number. Bilal's
offer says 30%, not "extra 20% on top." Nothing composes, so nothing has to be reasoned about.

**Storefront display vs checkout.** Checkout resolves best-single-offer against the real
cart. A product tile cannot express a cart-shaped offer (a bundle price is not a percentage
off one product), so display resolves the best *simple* discount applicable to that product
for that creator, and cart-shaped offers surface as an availability badge rather than a
price. Both sides ask "what is best", so they agree in kind; the tile simply cannot promise a
bundle it has no cart to evaluate.

**Scale guard.** Candidate scoring is O(offers). Production has 5 library offers, so this is
trivial today, but the resolution must cap and log rather than degrade silently if a brand
accumulates many.

### 4.4 — Offer expiry

An offer gets its own expiry, and it becomes the only thing that stops selling. No offer
means no date anywhere. Library offers' existing validity dates start being honoured on the
coupon path, where they are currently ignored.

### 4.5 — Retire the dead set-level path — **SPLIT 2026-08-11, claim corrected**

This section claimed retiring the table was "provably inert: zero rows in production." That
is **true for the 8 LEFT JOIN references** (their `co.*` columns are always NULL, so every
COALESCE already falls through) and **wrong for the 8 INNER JOIN references**.

An inner join against an empty table returns **nothing**, so those queries are not falling
through to NULLs — they are eliminating every row. Verified in production: 1 live
collaboration exists, and 0 survive the join. Twelve discovery rule queries share one such
join, so those shelves are empty today; the follower "active deals" count reports 0 for every
followed creator.

Removing them therefore **changes what followers see**. That is a functional fix, not a
cleanup, and it is carved into its own contract:
**`features/backend-defect-dead-offer-join/`**, sequenced after Part 4 deploys so each
removed join has the per-creator offer path already live to fall back on.

**What remains in Part 4's scope:** nothing. The inert half is low value on its own and
touches files the defect fix will also touch, so doing it first would mean editing the same
queries twice. It rides with the defect contract.

---

## What is true after Part 4

- A creator can sell full-price products and earn commission — impossible today.
- A brand publishes one offer in the engine and every creator holding those products gets
  it, with no per-creator assignment.
- A brand can still single out one creator with a better offer, and it wins for that
  creator only, on the products it covers.
- A discount expires on its own schedule instead of when the campaign ends.
- An offer lives in one place, not three.

---

## 5 — Open questions (must be answered before lock)

These three affect money, so they are decided by the founder, not defaulted by me.

**5.1 — Does a library offer that is NOT published to the store still apply to creators?**
**ANSWERED (founder, 2026-08-11): no — only a published offer applies.** A global offer
reaches creators only when it is published and inside its live window, reusing the existing
live-offer definition (`status = 'active' AND published_to_store = true` AND within
`store_starts_at`/`store_ends_at`). Unpublished drafts never leak to creators. Consequence
accepted: a brand cannot currently run a creator-only global offer without also showing it
on their own store — if that is wanted later it is a separate change.

**5.2 and 5.3 — DISSOLVED, not answered (founder, 2026-08-11).**

Both questions were artefacts of an implementation choice, not of the founder's model. The
original §4.3 split a single cart into groups, each governed by a different offer. That is
fine for flat and percentage discounts, which are per-product — and it breaks volume, bundle
and BOGO, which are cart-shaped and need a threshold to measure or several specific products
to be present. Splitting the cart destroys the thing they depend on.

Founder: *"whenever volume, bundle and other discounts mix with normal discount and mix and
match of global and specific causing lot of confusion."* Correct — and the fix is to stop
splitting the cart.

With best-single-offer-per-checkout (§4.3):
- **5.2 volume thresholds** — nothing to decide. Each candidate is scored against the whole
  cart, so a threshold always measures the real basket. No partial subtotals exist.
- **5.2 bundles / BOGO** — nothing to decide. No product is ever pulled out of the cart, so a
  bundle either has all its products or it doesn't, exactly as today.
- **5.3 two global offers on one product** — collapses into the same max(): both are scored,
  the better one wins, nothing stacks.
- **pay-at-store bills with no line items** — also collapses. Every candidate is scored
  against the bill; the engine already returns zero-with-a-reason for offers that need line
  items, so only store-scope offers can win, which is today's rule unchanged.

One case the earlier design got wrong and this one fixes: under strict per-product override, a
creator-specific *25% off kurtas* would have broken a global *3-item bundle* and left the
customer **₹851 worse off because the creator had a special offer**. Scoring whole-cart
candidates and taking the best makes that impossible by construction.

---

## Sequencing note

§4.3 touches checkout pricing; §4.1–4.2 do not. Recommendation is to implement and verify
**4.1, 4.2, 4.4, 4.5 first**, prove QA green, then **4.3** as a second pass with its own
verification — so a pricing regression, if any, is isolated to a known change. Both halves
sit under this one contract and lock together.

## Out of scope

Parts 2, 3, 6 and 7. An explicit per-creator product picker beyond the three scope shapes.
Wiring stock decrement. Changing commission maths, attribution or settlement.
