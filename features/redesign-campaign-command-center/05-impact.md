# Impact — Campaign Command Center

**Verdict: frontend-only rewrite of one page — zero backend change, zero
mobile change, all sub-routes preserved; Vercel-only deploy.**

- Single file rewritten: Packages/brand-web/app/dashboard/campaigns/[id]/
  page.js. Data layer identical to before (same five fetches); only the
  render changed. The planned backend products-endpoint enrichment proved
  unnecessary — set names join client-side from campaign.sets.
- Functionality previously on the page and KEPT: progress/budget numbers
  (now in the strip), escrow + conversions (strip cells with detail ↗
  links), brief toggle, needs-attention actions (now a banner), all
  drill-route links. Functionality REMOVED: nothing — the old tiles' five
  destinations remain linked from strip/banner/rows.
- New surface uses only existing endpoints incl. POST /deliverables/:id/
  refresh-stats (Apify cost note: header refresh = one scrape per live
  deliverable, sequential).
- W5b/W5d/W5e fixed as side-effects of the layout: products finally have a
  view, refresh is back at two levels, submitted content is loud.
