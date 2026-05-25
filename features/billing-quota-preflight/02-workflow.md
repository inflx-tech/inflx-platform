# Workflow — billing-quota-preflight (A12.1.5)

## Actor
Brand user clicking "+ New campaign" on `/dashboard/campaigns` or "+ Add
product" on `/dashboard/products`.

## Preconditions
- A12.1 shipped (quotaCheck middleware reads from tier_features).
- Brand has a `brand_subscriptions` row (auto-created if missing).
- Admin has set the relevant quota in Section C of the tier editor.

## Workflow A — blocked at entry (the founder's ask)
1. Brand on Free has 2 campaigns + admin set "Active campaigns" quota = 2.
2. Brand opens `/dashboard/campaigns`, clicks "+ New campaign" button.
3. Button text flips to "Checking…"; `goCreate()` fires `brandApi.quotaPreflight('createCampaign')`.
4. Backend `evaluateQuota` returns `{would_block: true, used: 2, limit: 2, current_tier: 'free', upgrade_to: ['growth','pro','enterprise']}`.
5. Page sees `would_block === true` → opens QuotaWallModal with friendly message + "View plans" CTA.
6. Brand never enters the create form.

## Workflow B — allowed at entry (happy path)
1. Brand on Pro has 5 campaigns + admin set "Active campaigns" quota = 10.
2. Click "+ New campaign" → preflight → `would_block: false`.
3. Page navigates to `/dashboard/campaigns/new` immediately.
4. Brand fills form, submits → submit-time middleware re-checks → success.

## Workflow C — preflight error (fail-open)
1. Preflight call times out / 5xx.
2. Page catches the error, opens the create form anyway (no popup shown).
3. Submit-time gate still enforces — popup fires there if needed.
4. Net: no degradation vs pre-A12.1.5 (which always went straight to form).

## Workflow D — admin changes the quota live
1. Admin bumps Free "Active campaigns" from 2 → 5.
2. Within 60s (entitlements cache TTL), brand's preflight starts returning `would_block: false` for the 3rd campaign attempt.
3. Brand clicks "+ New campaign" → navigates to the form. No popup.

## Success
- pnpm qa GREEN.
- Founder's "Aveen food paradise" scenario: 3rd "+ New campaign" click on Free with quota=2 shows the popup before the form opens.
- No regression in the submit-time gate (still throws 422 if preflight passed but a race created another campaign in between).

## Failure modes
- Preflight returns `would_block: false` but a race created another campaign before submit → submit-time gate catches it. Brand sees the popup at submit instead of at entry. Acceptable.
- Brand has no `brand_subscriptions` row → middleware lazy-creates a Free one (existing A4 behaviour). Preflight still works.
