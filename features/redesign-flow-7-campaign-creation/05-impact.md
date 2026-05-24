# Impact — Flow 7

## Verdict

**Zero functional / backend / logic / DB impact — visual + UX restructure only.**

Same 3-step wizard. Same 11 API endpoints. Same field shapes on every
request body. Same validation rules. Same draft resume. Same publish
escrow lock. Pure restyle (dark wave1 → light wave2 locked palette) +
Step 2 layout swap (tabbed sets → vertical accordion + side drawers).

## Files touched (1 web)

- `Packages/brand-web/app/dashboard/campaigns/new/page.js` — rewrite (2570 → est. 1800-2200 LOC; some density relief from drawer extraction but most original logic preserved verbatim)

## Files NOT touched

- `backend/**` (all 11 endpoints used as-is)
- `Packages/brand-web/lib/api.js` (all calls reused)
- `Packages/brand-web/app/dashboard/gallery/components/GalleryPicker.js` (imported as-is)
- Mobile (no mirror in mobile — wizard is web-only today)
- All other web pages

## NO-TOUCH (preserved exactly)

- `campaignApi.{create, update, get, createSet, updateSet, inviteInfluencer, updateInfluencer, publish, searchInfluencers, getOpenGroupMatches}` (10 methods)
- `brandApi.{getMe, getProducts}` (2 methods)
- `influencerApi.search` (1 method)
- `creatorInvitationApi.create` (1 method)
- Per-set + per-influencer field shapes (every property name + type)
- 5 offer-type sub-shapes (Discount/Volume/BOGO/Bundle/Free gift)
- Open-group group_params JSON shape
- localStorage `inflx_influencer_groups` key + JSON shape
- Validation rules (per-field messages + step-error counts)
- `?editId=X` resume path
- Brand-approval gate from layout.js
- Toast pattern
- Auth/role gating (brand role required)

## Window A coordination

NONE. Window A doesn't touch this surface.

## Regression risk

LOW-MEDIUM (largest single-file flow yet). `pnpm qa` 67/67 must hold.
No Playwright spec asserts on `/campaigns/new` layout/copy — but there
ARE specs that exercise the publish path indirectly via fixtures
(meals-setup.spec.ts touches restaurant-flow campaigns). Carefully
re-check on QA run.

## Deploy classification — PRODUCTION-IMPACTING (web only)

- `git push origin main` → Vercel auto-deploys brand-web
- NO mobile, NO OTA
- Rule 5 does not fire

## Time estimate

~6-8h focused work. Smaller than Flow 6 (one file vs four) but the
Step 2 density + 5 offer sub-forms + 2 drawer extractions make the JSX
work substantial. The locked-palette swap is mechanical (s/var(--orange)/
inline hex/) but the layout restructure needs careful per-section work.
