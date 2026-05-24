# Workflow — billing-tier-features-and-settings (Phase A9)

## Actors
- **Admin** editing tier features.
- **Brand user** browsing plans + hitting a quota wall.
- **Repo operator** running M060 + push.

## Preconditions
- A1–A8 + A7-brand shipped (`origin/main` at 591fdc4).
- pnpm qa baseline GREEN (73/73).

## Workflow — Admin edits a tier's features
1. Admin opens `/admin/pricing/tiers`.
2. Clicks "Edit Tiers".
3. In the Growth row, edits the multi-line textarea to add a new bullet "Webhook events".
4. Clicks "Save Changes".
5. Confirm dialog → backend `PATCH /admin/subscription-tiers/growth` with `features_json: ["Everything in Free", "Bulk influencer outreach", "Email templates", "Campaign analytics", "Priority email support", "Webhook events"]`.
6. Re-load shows the 6-bullet list on the read-mode tier row.
7. Brand on Growth visits `/dashboard/settings/subscription` → sees the new bullet under "What you get" on the Growth card.

## Workflow — Brand hits Free plan's 10-product cap
1. Brand on Free with 10 products opens `/dashboard/products`.
2. Clicks "+ Add product" → modal opens.
3. Submits form → backend `POST /brands/me/products` returns `422 QUOTA_EXCEEDED {action:'createProduct', used:10, limit:10, current_tier:'free', upgrade_to:['growth','pro','enterprise']}`.
4. Frontend `handleSave` calls `showFromResponse(res)` → `<QuotaWallModal>` renders.
5. Modal shows: "Plan limit reached. You've hit your FREE plan's products limit." + Used: 10 / Limit on FREE: 10 + upgrade pills + "Close" + "View plans" CTA.
6. Brand clicks "View plans" → navigates to `/dashboard/settings/subscription` → sees the Choose Growth button.

## Workflow — Settings hub navigation
1. Brand clicks "Settings" in the dashboard nav.
2. Default lands on `/dashboard/settings/profile`.
3. Settings layout renders title "Settings" + 3 tabs (Profile · Subscription · Billing); Profile active.
4. Brand clicks Subscription tab → URL becomes `/dashboard/settings/subscription`; same layout retained.
5. Brand clicks Billing tab → URL becomes `/dashboard/settings/billing`.
6. Brand types old URL `/dashboard/subscription` → server redirect → lands on `/dashboard/settings/subscription` without flash.

## Workflow — repo operator deploy sequence
1. Apply M060 locally → re-apply → idempotent.
2. `pnpm qa` GREEN (target 75/75 — was 73, +2 new redirect tests; existing 2 tests rewritten).
3. Stage all files, commit, push.
4. Render redeploys backend with the 4 controller edits + applies M060 on Supabase.
5. Vercel redeploys brand-web with the moved pages + redirect stubs + new layout.
6. No mobile push.

## Success
- Admin can add/edit/remove tier features from the UI; changes flow to brands within 60s (cache TTL).
- Brand hitting any of the 4 quota walls (campaign, set, product, invite) sees the popup with the correct used/limit/upgrade-to payload.
- Settings hub is a single nav entry with 3 working tabs.
- Old URLs redirect cleanly (no 404).
- pnpm qa GREEN 75/75, gate=0.

## Failure modes
- Migration fails on Render → deploy stalls; idempotency guard means safe retry.
- Brand-web build fails because of an import path miss → caught by Vercel preview build before prod (Vercel only promotes successful builds).
- Quota response payload shape drift → modal's `useQuotaWall.showFromResponse` looks for `error.code='QUOTA_EXCEEDED'` and pulls fields from either `error.details` (preferred) or directly off `error` (fallback) — resilient to both shapes the middleware might use.
