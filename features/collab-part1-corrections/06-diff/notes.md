# Before / after — Part 1 Corrections

Only one UI surface changed: **campaign creation, Step 1**. Everything else in this
contract is backend or data, listed at the end and covered by tests rather than pixels.

Before/after mockup: `04-preview/mockups/web-campaign-basics.html`.
Rendered-page proof: `qa/web/brand/campaign-basics-money-card.spec.ts` (4 tests, green)
asserts the after-state against the real running page, not against the mockup.

---

## Campaign basics, Step 1 — right rail

**Before.** Every brand saw a "💰 Wallet status" card reading **₹2,50,000 — covers this
campaign** with the note *"You need wallet ≥ total escrow lock (set budget + 8% platform
fee) to publish"*, followed by an "Onboarding tips" checklist whose first row was a
**pre-ticked green ✓ "Wallet topped up."**

Three separate untruths in one card: the figure was a hardcoded literal, not the brand's
balance; the escrow requirement was shown to commission-only brands for whom no wallet is
ever touched (the backend only checks it when a set is engagement or hybrid); and the tick
was unconditional — it rendered `done` regardless of any actual wallet state.

**After.** The card is rendered **only when a set actually needs funding**, and then shows
the brand's real `wallet_balance` labelled *"your wallet balance"*. When nothing needs
funding, a short **"💸 No upfront cost"** card explains why there's no wallet requirement
instead of leaving a gap. The checklist is retitled **"Before you can publish"** and its
wallet row is earned: green only when the balance actually covers what the sets allocate,
amber with the shortfall otherwise, and absent entirely when there is nothing to fund.

When the balance hasn't loaded, the card shows `—` / *"balance unavailable"* rather than
substituting a number.

## Campaign basics, Step 1 — start date

**Before.** `min` was set to today + 7 days, with the hint *"Must start at least 7 days
from today."* A browser-only rule; the backend's only date rule is that end must be after
start. A brand could not launch today.

**After.** No `min`. Hint reads *"Can start today."* The spec asserts both the attribute's
absence and that filling today's date sticks.

## Deltas vs the mockup

- The mockup's funded-campaign panel showed an illustrative ₹1,80,000 against a ₹4,00,000
  campaign budget. The implementation compares the balance against **the sum of set
  allocations** (`totalSetBudget()`) rather than a campaign-level budget figure, because
  that is the number the backend's publish check actually uses. Same intent, correct
  source.
- Added a `—` / "balance unavailable" state the mockup didn't show. Without it a failed
  `brands/me` would have fallen back to some default, which is the exact fault being fixed.
- Checklist rows are conditional on `needsFunding`; the mockup showed one fixed list.

## Unchanged, deliberately

Step order, step count, goal placement (still Step 2), layout, palette, and every field
other than the start-date `min`. The founder ruled out structural change; `W5c` in the spec
is a standing guard that fails if a later edit moves the goal into Step 1 or adds a step.

---

## Not visible in this diff (backend / data)

- Offers refused over unpublished products, with the offending product named — at **both**
  creation levels.
- The in-campaign inline offer path now validated at all: it previously accepted any
  `offer_config_json`, including **another brand's product IDs**.
- Commission no longer resolved as a customer discount. Four sites carried that COALESCE
  fallback, not one — and the fourth (`follower.controller` coupon pricing) fed
  `discountPct`, so a 10% commission was applied as a real 10% price reduction the brand
  never agreed to fund.
- One canonical offer vocabulary across web and mobile, with migration 147 converting
  existing rows and backfilling `sub_type` for mobile-created discounts.
- `offer.service.js` now shares the single normaliser instead of holding a second copy of
  the same legacy map.
- Mobile brand invite gained a client-side ">100%" guard, since the server now validates
  that path and would otherwise return a bare 422.

- **OTA-gap safety.** Wiring validation into the campaign path made pre-canonical mobile
  payloads reachable for the first time: `offer_type: 'percentage'` with a config of just
  `{value}` would have 422'd every conversion/hybrid invite from an un-updated phone, which
  would have forced backend and mobile to ship together. `backfillDiscountSubType` infers
  `sub_type` from the legacy type — the same rule migration 147 applies to stored rows — so
  a collab created by an old build during the OTA gap ends up identical to a migrated one.
  A config that genuinely cannot be inferred (`discount` with no `sub_type`) still fails,
  because defaulting there would silently turn ₹15 off into 15% off.

Tests: `qa/unit/offer-vocabulary-and-publish.spec.ts` (15) +
`qa/web/brand/campaign-basics-money-card.spec.ts` (4). Full suite 144 passed, STATE=GREEN,
gate 0, first run clean.
