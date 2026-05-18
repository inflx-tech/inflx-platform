# Impact Analysis — A5b harden 3 admin pages

> Step 6. Generated BEFORE implementation. Reviewed at the lock.
> FIRST app-code change under the contract pipeline.

## Affected files (app code — minimal guards)
- `Packages/brand-web/app/admin/marketing/funnel/page.js`
  → strengthen the load/guard: a truthy-but-non-shaped `data`
  (missing `.influencers`/`.brands`/`.totals`) must hit the existing
  "Failed to load funnel." branch (not `data.influencers.counts`).
- `Packages/brand-web/app/admin/marketing/leads/page.js`
  → keep the shaped default: only accept `r.data` if it's a plain
  object; else keep `{cities:[],niches:[],sub_niches:[],…}` (so
  `opts.<key>.map` never sees a non-array).
- `Packages/brand-web/app/admin/analytics/page.js`
  → treat a non-shaped/empty `data` as "no data" (render the
  existing empty/`No data` path, don't do nested access).
- New test: `qa/web/admin/data-robustness.spec.ts`.

Smallest viable guards only — no shared util, no refactor, no
behaviour change when data is valid (don't over-engineer).

## Affected routes / APIs
- None changed. Reads `marketingApi.getFunnel`, `getFilterOptions`,
  `listLeads`, `adminApi.getAnalytics` — unchanged contracts; only
  the client's tolerance of empty/odd responses changes.

## Affected workflows (regression surface)
- A5 (nav-sweep v0.3.0) stays green (doesn't assert these).
- The new deep spec must pass BOTH empty and populated cases — the
  populated case is the guardrail against an over-correcting fix
  that mutes real data.
- No other admin page shares this code (verified: escrow/approvals/
  inbox already had fallbacks; this is isolated to the 3).

## Migration / deploy / OTA impact
- **Web app code change** → on release: commit + push (Vercel
  auto-deploys brand-web). **No migration. No mobile. No OTA.**
  (First contract in this series that is NOT deploy-inert — flagged.)

## Risk notes
- Over-correction risk (guard hides real data) → mitigated by the
  mandatory populated non-regression case per page.
- Low blast radius: 3 isolated client components, additive guards.
- Selector brittleness: empty-state copy pinned post-fix at Step 7.
