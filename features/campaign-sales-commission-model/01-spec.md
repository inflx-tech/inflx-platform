# Campaign creation — sales/commission model correction

Status: **mockup REJECTED by founder 2026-08-09** — "no don't change structure at all".
No wizard restructure. Step order, step count and goal placement (Step 2) all stay as they are.
Awaiting the founder's own list of changes; scope will be exactly that list and nothing more.
The audit section below stays valid (it is code-grounded); the design section is void.
Raised by: founder, 2026-08-07 chat
Flow: brand-web campaign creation wizard (`Packages/brand-web/app/dashboard/campaigns/new/page.js`)
Web-only by design (see LOCKED brand-mobile scope: campaign CREATION + LISTING are the only
web-only brand capabilities). The one exception is **End promotion**, which is a live-campaign
capability and therefore must ship on mobile too.

## The problem (founder's words, restated)

1. A **sales** campaign pays commission only — money moves when a sale happens. There is no
   pre-budget to allocate. Yet the wizard asks for a campaign budget.
2. Start/end dates belong to **offers**, not to the campaign. A creator can promote a product
   for as long as stock lasts.
3. Dates only actually matter **if a discount is attached**.

## Backend-first audit (what is already true)

Verified against code, not assumed:

| Claim | Reality | Evidence |
|---|---|---|
| Budget is required for sales campaigns | **False.** Only required at publish when some set is `engagement` or `hybrid`. Conversion-only publishes with no budget and no wallet check. | `backend/src/controllers/campaign.controller.js:1208-1244` |
| Wizard requires budget for sales | **False** — validation is already goal-conditional. | `new/page.js:677-684` |
| Campaign end date is load-bearing downstream | **Partly.** Every read path is already NULL-tolerant: `AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)`. Coupon expiry is `if (r.end_date && …)`. **`end_date = NULL` already means "never expires".** | `follower.controller.js:728,751,788,889,935,1023,1772`; `follower.service.js:108,151,983`; `brandOffers.adapter.js:347`; `creatorPosts.service.js:48`; `saved.controller.js:84`; `followerPosts.service.js:222` |
| Dates are required at create | **True — this is the only blocker.** | `campaign.controller.js:332-338`; `new/page.js:674-676` |
| Offers own their own validity clock | **True, already built.** `brand_offers.store_starts_at` / `store_ends_at`, NULL = unbounded, enforced in adapters. | `migrations/084_offer_engine.sql:37-38`; `brandOffers.adapter.js:437-438`; `sectionRules.service.js:195-196,607-608` |
| Posting window is separate and real | **True.** `campaign_sets.window_start/window_end` (mig 002) + per-creator override (mig 106). | `migrations/002_add_missing_columns.sql:15-16`; `migrations/106_per_creator_date_window.sql` |
| "Until stock closes" can auto-fire | **False.** `brand_products.stock` and per-variant stock exist, but **nothing decrements stock on a follower order** — stock is a brand-entered attribute only. | `migrations/010:6`, `migrations/047:35`; no write path found in order/checkout services |

### Root cause

The wizard asks for **budget and dates in Step 1**, but **goal is chosen in Step 2**. It has to ask
everyone for everything because it doesn't yet know what kind of campaign this is. One date range
is doing three unrelated jobs.

Additional real defects found while auditing:

- `new/page.js:1389` — Step 1 right rail unconditionally renders *"₹2,50,000 covers this campaign —
  you need wallet ≥ total escrow lock (set budget + 8% platform fee) to publish"* with a hardcoded
  ₹2,50,000 fallback and a fake pre-ticked ✓ "Wallet topped up". A commission-only brand is shown a
  funding requirement that will never apply to them.
- `new/page.js:1493` — start date is forced to ≥ 7 days from today. **Frontend-only rule, no backend
  counterpart.** Blocks a sales brand from launching now.

## Three clocks, not one

| Clock | Lives on | Sales | Engagement | Hybrid |
|---|---|---|---|---|
| **Post-by deadline** — content obligation | `campaign_sets.window_*` + per-creator (mig 106) | required | required | required |
| **Promotion live-until** — coupon + attribution validity | `campaigns.end_date` | **Ongoing (NULL) by default** | = posting window | Ongoing |
| **Offer validity** — the discount itself | `brand_offers.store_starts_at/ends_at` | only if offer attached | only if offer attached | only if offer attached |

Money follows the same logic: a sales campaign has no budget. Its real numbers are **commission %**
and the coupon code.

## Decisions — SUPERSEDED 2026-08-09

The 2026-08-07 answers below were given against a restructure proposal the founder has since
rejected. **Treat none of them as locked.**

1. ~~Ongoing by default for sales~~ — direction still plausible, not locked.
2. ~~Goal first, then adaptive Step 1~~ — **rejected. No structural change to the wizard.**
3. ~~Manual "End promotion" only~~ — not locked.

## Design (VOID — rejected 2026-08-09, retained only for the record)

### New Step 0 — "What are you paying for?"
Three doors, reusing the existing goal copy and `--conv` / `--eng` / `--hyb` palette tokens:
- **Pay per sale** (conversion) — commission only, no upfront cost
- **Pay for content** (engagement) — flat fee per creator
- **Both** (hybrid) — base fee + commission

This sets the campaign's **primary goal**, which drives Step 1's field set. Sets still carry their
own `goal` (unchanged schema), defaulting to the primary.

### Step 1 — Sales variant
- Campaign name
- **Go live:** Immediately (default) | pick a date — drops the 7-day rule
- **Runs until:** `● Ongoing — until you end it` (default) | `○ End on [date]`
  Ongoing → `end_date = NULL`
- Commission summary card replacing the budget card: *"No upfront cost. You pay commission only on
  tracked sales. Set the % per creator in Step 2."*
- Right rail: wallet/escrow card **removed**; replaced with "How you get paid" explainer + honest
  checklist (products listed in catalogue, coupon prefix, brand assets)

### Step 1 — Content / Both variant
Unchanged from today, minus the hardcoded ₹2,50,000 fallback and the fake ✓.

### Mixed-goal safety net
If the brand enters through **Pay per sale** and later adds an engagement or hybrid set in Step 2,
budget was never asked. A "Funding needed" card appears inline in Step 2 and blocks at Review with
a direct "Add campaign budget" action. No silent failure at publish, no re-running Step 1.

### Offer dates
Surfaced **only inside the offer builder**, only when a discount-shaped offer is attached, writing
the existing `store_starts_at` / `store_ends_at`. Removed from the campaign level entirely.

### End promotion (new control, live campaign)
Sets `end_date = CURRENT_DATE` and status → completed. Required because
`campaign-status.job` keys off `end_date < CURRENT_DATE`, so ongoing campaigns would otherwise
never auto-close. Ships in brand-web campaign detail **and** `Packages/Mobile` brand campaign
detail (live-campaign capability → mobile-mandatory per locked scope).

## Impact

**Zero functional change for engagement and hybrid.** Everything else is field gating plus one
nullable validation relocated from create-time to publish-time.

Four code consequences:

1. **`campaign.controller.js:332-338`** — `start_date`/`end_date` become optional at create.
   Sets don't exist yet at create, so the goal-aware date rule moves to **publish**, into the same
   block that already holds the goal-aware budget rule (`:1208`). This is the correct seam.
2. **`campaign-status.job.js`** — `WHERE end_date < CURRENT_DATE` never matches NULL rows.
   Correct behaviour for ongoing campaigns, and precisely why End promotion is mandatory, not
   optional.
3. **`production.service.js:53-58`** — visit-deadline fallback chain terminates at
   `campaign_end_date` behind a comment reading *"should never happen — campaign always has an
   end_date"*. NULL end dates make that branch reachable. Needs a real fallback (post-by deadline,
   which always exists).
4. **`new/page.js:1493`** — drop the 7-day start rule for sales (no backend counterpart).

## Open

- Mockup lock (founder)
- Whether "Both" (hybrid) should also default to Ongoing, or inherit the posting window
