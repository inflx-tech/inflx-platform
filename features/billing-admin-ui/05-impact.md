# Impact — billing-admin-ui (Phase A7-admin)

## Changes
- 2 backend controllers (subscription extended, categories new).
- 1 backend route file (admin.routes.js — 8 new routes).
- 1 frontend api file (Packages/brand-web/lib/api.js — 7 new adminApi methods).
- 1 frontend nav (Packages/brand-web/app/admin/layout.js — 2 new sections / 4 new entries).
- 4 new frontend pages (Packages/brand-web/app/admin/{pricing,subscriptions,billing}/...).
- 1 backend test file extended with 7 admin assertions.
- 1 Playwright nav-sweep extended with 4 new routes.

## Blast radius
- Brand UX unchanged — no `/dashboard/**` files touched.
- Admin UX gains a new PRICING section + 2 FINANCE entries; existing admin pages untouched.
- The new backend endpoints have zero callers from non-admin code paths.
- pricing.service cache-bust calls land on every category mutation → live transactions pick up changes within ~60s.

## Window B coordination
- Window B owns redesign of EXISTING pages. The 4 new admin pages are NEW files Window B will style consistently with the new design system when admin-web restyle lands. Until then, the new pages adopt the same Tailwind token names already in use by `/admin/escrow-fees` — restyles will be cosmetic-only.
- `Packages/brand-web/app/admin/layout.js` nav touched — small additive edit (4 entries). Window B may restructure nav styling later; the additive nature minimizes conflict.

## Rollback
Revert the commit. No DB migration in this phase — all schema work is in A1's M058.

## Risks
- **Reviewer-role admin accidentally tries to PATCH a tier** → 403 caught by the existing `requireAdminRole('superadmin')` middleware. UI shows the Edit button regardless of role; clicking through to Save returns the 403 toast. Acceptable: matches the existing escrow-fees pattern (admin-web) precisely.
- **DELETE category mid-traffic** → brands registered with that category fall back to `brands.platform_fee_pct` (legacy 8% default) via pricing.service. Acceptable; surfaced via the delete confirm dialog ("brands will fall back to brands.platform_fee_pct").
- **Cache TTL drift** → 60s window where some workers serve old rate. Acceptable; same pattern as the M037 escrow_fee_tiers cache.

## Pre-push checklist
1. pnpm qa GREEN 67+4=71 routes.
2. Backend jest admin tests pass (qa:db informational).
3. gov-check Rules 1/3/4 satisfied (UI-governed contract; mockup_locked + non-empty 06-diff).
