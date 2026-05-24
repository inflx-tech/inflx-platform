# Workflow — billing-brand-ui (Phase A7-brand)

## Actor
Authenticated brand user navigating from the dashboard nav.

## Preconditions
- Brand is approved (existing `requireApproved` gate; lazy `free` sub
  row will be created by quota-check on first mutation).
- Phases A1–A6 shipped (schema + endpoints).

## Workflow steps

### Subscription page
1. Brand clicks "Subscription" in the dashboard nav.
2. Page loads → fires `GET /brands/me/subscription` + `GET /subscription-tiers` in parallel.
3. Page renders Current plan + Usage cards + 4-tier comparison grid.
4. Brand clicks "Choose Growth".
5. Confirm dialog: "Upgrade to GROWTH? You will be charged at the start of the next cycle."
6. On confirm → `POST /brands/me/subscription/upgrade {tier_key:'growth'}`.
7. Mock-mode backend cancels prior sub, inserts new, writes a paid invoice (2,499 + 449.82 GST = 2,948.82).
8. Page re-loads → Current plan card now shows Growth + Active.

### Billing page
1. Brand clicks "Billing" in the dashboard nav.
2. Page fires `GET /brands/me/billing/invoices?limit=100`.
3. Page renders invoice table + summary stat tiles (invoice count, paid sum, pending count, failed count).
4. If no invoices → empty state message.

### Quota-wall modal (when wired)
1. Brand tries to create their 11th product on the Free plan.
2. Backend returns `422 QUOTA_EXCEEDED` with payload `{action, used, limit, current_tier, upgrade_to}`.
3. Page calls `useQuotaWall().showFromResponse(res)`.
4. Modal renders: "Plan limit reached" + used / limit / current tier + list of upgrade-to tiers + "View plans" CTA → `/dashboard/subscription`.

## Success
- Each page reachable by brand session (not gated to /login).
- Renders heading + landmark elements.
- Upgrade happy path → invoice appears under Billing within the same session.

## Failure modes
- 401 from any endpoint → existing `authFetch` clears session + redirects to /login.
- 5xx on upgrade → error banner on Subscription page; no state change.
- Tier list empty → page renders zero tiers card (deferred to founder; no current path to this in seeded data).
