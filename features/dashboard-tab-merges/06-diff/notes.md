# 06 — Implementation / diff notes (Dashboard Tab Merges)

Frontend reorganization; structure approved in-session (no new mockup — the merge plan text
was the approved design). Reviewer SHIP-CLEAN; QA GREEN.

## What was implemented
- NAV 11→8 (layout.js): removed Contracts, Proposals, Offers.
- E-1: campaigns/page.js ContractSignatureStrip (listPending + bulkSign, rows link to campaign);
  campaigns/[id]/page.js new Contracts tab (per-creator status draft/pending/live/completed +
  counter-sign via brandSign; pending matched by Instagram handle, String-guarded). contracts/page.js
  → redirect to /dashboard/campaigns.
- E-2: influencers/page.js Discover/Proposals sub-tabs; proposals inbox folded in verbatim
  (ProposalsInbox/PrpSettingsCard/PrpProposalDetailModal, .prp/Prp* scoped). proposals/page.js →
  redirect to /dashboard/influencers?tab=proposals.
- E-3: products/page.js Products/Offers sub-tabs; offer library folded in (OffersLibrary, .ofl
  scoped; drilldown auto-redirect skipped when ?tab=offers). offers/page.js → redirect to
  /dashboard/products?tab=offers.

## Reviewer findings
- SHIP-CLEAN: all 8 files valid JSX, no symbol/CSS collisions, no lost functionality, all API
  methods present, redirects + deep-links + NAV correct, handle-match String-guarded (no crash).
- Low-severity follow-ups (not blocking): handle-less pending contract's per-row counter-sign
  hidden (bulk strip still covers it by id); a useCallback dep nit.

## What diverged / deferred
- Exact contract↔creator id link (vs handle) — follow-up read endpoint.
- Per-product "offers on this product" view; E-4 gallery organize — separate.

## What to check after deploy
- Nav shows 8 tabs; Contracts/Proposals/Offers gone as top-level.
- Campaigns list signature strip signs; campaign Contracts tab lists + counter-signs.
- Influencers → Proposals sub-tab (accept/counter/reject); Listings → Offers sub-tab (CRUD).
- Old URLs redirect.
