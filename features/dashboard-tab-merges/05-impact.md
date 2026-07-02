# Impact Analysis — Dashboard Tab Merges (E-1/E-2/E-3)

> Terse verdict: frontend reorganization of existing screens — reuses existing components +
> APIs, no backend, no migration, no mobile. Reviewer SHIP-CLEAN; QA GREEN.

## Affected files (all Packages/brand-web/app/dashboard/)
- layout.js (NAV 11→8; removed Contracts/Proposals/Offers)
- campaigns/page.js (ContractSignatureStrip + bulk-sign)
- campaigns/[id]/page.js (new Contracts tab)
- influencers/page.js (Discover/Proposals sub-tabs; proposals inbox folded in)
- products/page.js (Products/Offers sub-tabs; offer library folded in)
- contracts/page.js, proposals/page.js, offers/page.js (thin client redirects)

## Affected routes / APIs
- No new endpoints. Old routes /dashboard/contracts|proposals|offers → redirect.
- Reuses contractApi/proposalApi/brandApi(offers)/campaignApi — all confirmed present.

## Affected workflows (regression surface)
- Campaign detail (hierarchy/analytics/inline review), contracts signing, proposals, offer library,
  product catalogue — reran under pnpm qa (GREEN). Reviewer confirmed no lost functionality.

## Migration / deploy / OTA impact
- Frontend only → push (Vercel). No migration, no OTA, no backend.

## Risk notes
- Reversible (frontend). Low risk.
- Follow-ups (not blocking): exact contract↔creator id match (today by Instagram handle);
  per-product "offers on this product" view; E-4 gallery organize.
