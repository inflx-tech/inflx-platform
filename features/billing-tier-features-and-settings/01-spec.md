# billing-tier-features-and-settings — features list per tier + quota popup wiring + Settings hub (Phase A9)

> **Phase A9 — single bundle.** Three follow-on improvements to the
> revenue model surface, scoped from the founder's 2026-05-24 review
> after looking at the live A7-brand pages:
>
>   1. **Features list per subscription tier** — each tier shows a
>      bullet list of what the brand gets (admin-editable text, not
>      yet wired to actual gating — that comes feature-by-feature later).
>   2. **Quota popup actually pops up** — wires `QuotaWallModal` into
>      the 3 mutation flows that hit limits today (createProduct,
>      createCampaign, createSet, inviteInfluencer).
>   3. **Settings hub** — consolidates the 3 separate top-level nav
>      entries (Profile, Subscription, Billing) into one Settings
>      entry with the 3 sub-pages as tabs; old URLs server-redirect.

## What ships

### Database
- **Migration 060** adds `features_json jsonb DEFAULT '[]'` to
  `subscription_tiers`. Seeds the 4 existing tier rows with founder-
  confirmed bullet text (5 bullets per tier).

### Backend
- `GET /v1/subscription-tiers` SELECT now exposes `features_json`.
- `GET /v1/brands/me/subscription` exposes `features_json` on the
  joined tier object.
- `GET /v1/admin/subscription-tiers` SELECT now exposes `features_json`.
- `PATCH /v1/admin/subscription-tiers/:tierKey` accepts
  `features_json` (validated: must be array of non-empty strings,
  each ≤ 200 chars; jsonb-cast on the write).

### Admin UI (`/admin/pricing/tiers`)
- Each tier row now has a "Features (one per line)" textarea below
  its quota fields. Edit mode = textarea; read mode = bulleted list.
- Save converts the newline-separated text into an array of trimmed
  non-empty strings (max 200 chars each), submitted as `features_json`.

### Brand UI
- **`/dashboard/settings/subscription`** (moved from `/dashboard/subscription`):
  each tier comparison card now shows the quota bullets + a "What you
  get" section with the admin-managed features list.
- **Settings hub** at `/dashboard/settings/` — single layout with a
  3-tab top nav (Profile · Subscription · Billing). All 3 sub-pages
  inherit the layout's title + tab strip.
- **Old URLs redirect** server-side via Next.js `redirect()`:
  - `/dashboard/profile` → `/dashboard/settings/profile`
  - `/dashboard/subscription` → `/dashboard/settings/subscription`
  - `/dashboard/billing` → `/dashboard/settings/billing`
- **Dashboard nav** (`Packages/brand-web/app/dashboard/layout.js`):
  3 entries (Subscription, Billing, Profile) → 1 entry (Settings ⚙).
  Final NAV length: 12 (was 14 after A7-brand).

### Quota wall wiring
- `Packages/brand-web/app/dashboard/products/page.js`:
  - import `QuotaWallModal` + `useQuotaWall`
  - `handleSave` + `handleActivate` now route `QUOTA_EXCEEDED` responses through the modal
  - `<QuotaWallModal>` rendered at page root
- `Packages/brand-web/app/dashboard/campaigns/new/page.js`:
  - same imports + hook
  - `saveDraft` (createCampaign), `createSet` loop, `inviteInfluencer` loop all route quota errors through the modal
  - `<QuotaWallModal>` rendered at page root
- `QuotaWallModal` "View plans" CTA now links to `/dashboard/settings/subscription`.

### Tests
`qa/web/brand/subscription-billing-nav.spec.ts` rewritten — 4 tests:
1. `/dashboard/settings/subscription` renders + tab nav visible + features bullets present.
2. `/dashboard/settings/billing` renders + invoice row.
3. Old `/dashboard/subscription` redirects to the settings sub-route.
4. Old `/dashboard/billing` redirects.

## What this is NOT (deferred to your pace)

- **Mapping which features go to which tier.** The seeded bullets are
  display placeholders. You edit via admin to finalize.
- **Per-feature enforcement.** "REST API access" on Enterprise doesn't
  actually gate any code path yet. When you decide a feature lives on
  tier X, a separate small contract wires the actual gate (e.g.
  require the brand's active tier to have feature key Y to call
  endpoint Z).
- **Real Razorpay subscriptions.** Mock mode unchanged.

## Files
- `backend/migrations/060_tier_features.sql`
- `backend/scripts/run-060.js`
- `backend/seeds/tier_features_draft.csv`
- `backend/src/controllers/subscription.controller.js` (4 edits: 2 SELECT lists + 1 admin SELECT + 1 PATCH allowed-list w/ validation + jsonb-cast)
- `Packages/brand-web/app/admin/pricing/tiers/page.js` (load form + handleSave body + render features textarea/bullets)
- `Packages/brand-web/app/dashboard/settings/layout.js` (new — hub layout w/ tabs)
- `Packages/brand-web/app/dashboard/settings/profile/page.js` (moved from `/dashboard/profile`, import path fix)
- `Packages/brand-web/app/dashboard/settings/subscription/page.js` (moved + import path fix + features bullets rendered)
- `Packages/brand-web/app/dashboard/settings/billing/page.js` (moved + import path fix)
- `Packages/brand-web/app/dashboard/profile/page.js` (new — redirect stub)
- `Packages/brand-web/app/dashboard/subscription/page.js` (new — redirect stub)
- `Packages/brand-web/app/dashboard/billing/page.js` (new — redirect stub)
- `Packages/brand-web/app/dashboard/layout.js` (NAV consolidates 3→1 + 1 link path update)
- `Packages/brand-web/app/dashboard/page.js` (profile link path update)
- `Packages/brand-web/components/QuotaWallModal.js` (CTA href update)
- `Packages/brand-web/app/dashboard/products/page.js` (quota-wall wiring)
- `Packages/brand-web/app/dashboard/campaigns/new/page.js` (quota-wall wiring × 3 sites)
- `qa/web/brand/subscription-billing-nav.spec.ts` (4 tests)
- This contract.

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING. Migration runs on Supabase;
  brand-web re-deploys on Vercel; backend re-deploys on Render with
  the controller edits.
- Mobile untouched → OTA skipped.
- RAZORPAY_MOCK stays true.
- Internal redirects use Next.js server-side `redirect()` from
  `next/navigation` — no JavaScript dependency, works on first byte.
