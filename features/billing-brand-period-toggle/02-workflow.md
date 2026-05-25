# Workflow — billing-brand-period-toggle (A11)

## Actor
Authenticated brand user on `/dashboard/settings/subscription`.

## Preconditions
- A10 + A10.5 shipped (admin can edit tiers + create tiers; features catalog populated).
- M061 applied on prod (verified earlier session).

## Workflow A — render the page
1. Brand opens Settings → Subscription.
2. Page fires `GET /brands/me/subscription` + `GET /subscription-tiers` in parallel.
3. Tier list response now includes prices + entitlements per tier.
4. Renders Current plan card + Usage card + Period toggle (Monthly default) + 4 tier cards each with their feature bullets grouped by category.

## Workflow B — toggle Yearly
1. Brand clicks "Yearly" on the toggle.
2. Each tier card swaps to the yearly price if admin has set one; shows "—" + "Not available" button if no yearly price for that tier.
3. "Save N% vs monthly" appears under the price when both periods are set and yearly is cheaper than 12 × monthly.

## Workflow C — upgrade with selected period
1. Brand clicks "Choose Growth" (with Yearly toggle active).
2. Confirm dialog shows tier + period.
3. POST `/brands/me/subscription/upgrade` with `{tier_key:'growth', billing_period:'yearly'}`.
4. Mock-mode backend resolves the yearly price row, writes a `brand_subscriptions` row with `subscription_price_id` + 365-day cycle, writes a paid invoice with `period_end = today + 365`.
5. Page reloads → Current plan card shows Growth + yearly price + 365-day cycle.

## Workflow D — graceful failure
1. Brand toggles Yearly. Some tiers have no yearly price.
2. Those tier cards show "—" price + "Not available" disabled button.
3. Toggle hint reads "(no yearly prices configured yet)" if NO tier has yearly.

## Success
- pnpm qa GREEN.
- Brand subscription page shows the toggle on prod after Vercel deploy.
- Toggling Monthly ↔ Yearly swaps every tier card's price simultaneously.
- Upgrade flow works end-to-end with either period.

## Failure modes
- API failure on listTiers → red error banner, no plans render. No silent empty.
- API failure on upgrade → red error banner, no state change.
- Yearly selected but no yearly price for the chosen tier → 422 from backend, banner shown.
