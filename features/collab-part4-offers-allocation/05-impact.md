# Impact — Part 4 Offers and allocation

**Verdict: the largest change in the program so far. It touches the creator storefront, the
coupon path and checkout discounting — the revenue path. It does NOT touch commission maths,
attribution or settlement.**

## Blast radius

| Area | Impact |
|---|---|
| What a creator may sell | Now declared, not inferred from an offer |
| Full-price selling | Becomes possible — 7 gates removed |
| Global offers | Now reach creators at all (they never did) |
| Discount chosen at checkout | New resolution step above the engine |
| Pricing engine maths | **None** — untouched |
| Commission, attribution, settlement, TDS | **None** |
| Set-level offer table | Retired from read paths (zero prod rows) |
| Campaign dates, budget, escrow, wallet | **None** |

## Risks and how they are handled

**Removing seven gates opens paths that have never carried traffic.** The gates guaranteed an
offer existed; code downstream may assume a non-null offer. Every removal is paired with a test
that walks the full path — discovery, storefront, coupon resolve, tracking validation, sale
recording — for a creator with no offer at all (W7). This is the single largest source of risk
in the contract.

**Allocation changes what a creator can sell.** A mis-migrated scope would silently widen or
narrow a live creator's storefront. The migration backfills from each collab's current offer
scope and W6 asserts every one of the 19 production collabs resolves to the **same product set
as before**. Verified per row, not in aggregate.

**Offer resolution changes prices.** Mitigated by design rather than by care: the pure engine is
untouched, so the risk is confined to *which* offer is chosen, not to any arithmetic. W12
asserts the applied discount is never worse than the best global offer alone — the property the
dropped per-product design violated.

**Retiring the set-level table spans 49 references in 14 files, including the money path.**
Zero rows in production means each `LEFT JOIN` currently yields NULLs and each `COALESCE`
already falls through, so each removal is provably inert. Removed reference-by-reference with
before/after equivalence, never in one sweep.

**Sequencing.** §4.1/4.2/4.4/4.5 land and go green first; §4.3 follows as a second pass with its
own QA run. A pricing regression is then attributable to one known change rather than to a
combined diff.

## Deploy classification

**Production-impacting.** Backend, a migration, and brand-web. Mobile only if a mobile surface
is touched — currently not planned.

Targets: Render (backend), Vercel (brand-web). Migration runs before the backend deploy.

**Gates:** the wizard scope chooser needs a locked mockup before any `Packages/**` commit
(Rule 3); `06-diff/notes.md` required (Rule 4); explicit founder go before push, per the
standing carve-out that production-impacting deploys are never silent.

**Founder walkthrough owed** on the live surfaces — most importantly a full-price
commission-only sale, which is the capability this part exists to create.
