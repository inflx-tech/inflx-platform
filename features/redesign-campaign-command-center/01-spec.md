# redesign-campaign-command-center

> Founder walkthrough W5a–W5e (2026-06-11, Docs/WALKTHROUGH_LEDGER.md).
> Campaign detail page (brand-web /dashboard/campaigns/[id]) redesigned as a
> full-width hierarchy: campaign → sets → influencers → deliverables +
> products, with analytics at every level and review states visible.

## Scope (agreed in discussion 2026-06-11)

1. Full-width layout (right rail removed; "Needs your attention" becomes a
   top banner when non-empty).
2. Hierarchy tree as the primary view: expandable Set rows (set-level
   analytics inline) → Influencer rows (rollup analytics, status, offer
   terms) → Deliverable rows (status incl. SUBMITTED/awaiting-live badges,
   per-deliverable stats, ↻ re-scrape) + product chips.
3. Products tab: full table — product | category/section | set | influencer |
   publish status (fixes W5b: Publishing tile currently navigates to the
   influencers page; no products view exists).
4. Analytics tab: 4-level drill (campaign totals → by_set → by_influencer →
   per-deliverable) — ALL already computed by GET /brands/me/campaigns/:id/
   engagement + deliverable_stats; frontend-only exposure (W5c).
5. Refresh restored (W5d): campaign-level "Refresh analytics" (re-scrape all
   live deliverables sequentially + refetch engagement) + per-deliverable ↻.
   POST /deliverables/:id/refresh-stats unchanged.
6. Honest content counts (W5e): tile/strip shows "X to review · Y awaiting
   live · Z live" instead of live-only.

Backend touch (small): /campaigns/:id/products response enriched with set
name per product (everything else already returned).

## Status

Mockup authored for founder review (04-preview/mockups/command-center.html,
interactive). NOT implemented — awaiting founder mockup-lock per the
redesign 5-step rhythm.
