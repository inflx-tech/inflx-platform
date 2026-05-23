# Expected Outputs — billing-subscriptions-schema (Phase A1)

> Step 4. The concrete artifact contract. Each assertion below is what
> the operator (or a future automated check) verifies after running
> migration 058. Backend-only contract — no API responses, no UI.

## Database state after migration 058

### Tables created (5)
| table | rows seeded | primary use | partial unique |
|---|---|---|---|
| `subscription_tiers` | 4 (free/growth/pro/enterprise) | L1 tier catalog, admin-editable | — |
| `brand_subscriptions` | 0 (lazy-created in Phase A4) | one active sub per brand | `uniq_brand_subs_active` ON `(brand_id) WHERE status='active'` |
| `subscription_invoices` | 0 | L1 invoice history with GST | — |
| `categories` | 16 (Salon&Beauty → Home Services) | L3 fee per path per category, admin-editable | — |
| `attribution_clicks` | 0 (written by Phase A5) | 30-day Path-C window | — |

### Enums created (4)
| enum | values |
|---|---|
| `subscription_status` | `active`, `paused`, `cancelled`, `past_due` |
| `mandate_status` | `pending`, `active`, `paused`, `cancelled`, `revoked` |
| `invoice_status` | `pending`, `paid`, `failed`, `refunded` |
| `attribution_path` | `direct`, `influencer_direct`, `influencer_attributed` *(reserved — not yet written by any code in this phase)* |

### Indexes created (5)
| index | table | columns | predicate |
|---|---|---|---|
| `idx_brand_subs_brand` | `brand_subscriptions` | `(brand_id, status)` | — |
| `idx_brand_subs_next_charge` | `brand_subscriptions` | `(next_charge_at)` | `WHERE status='active'` |
| `uniq_brand_subs_active` | `brand_subscriptions` | `(brand_id)` UNIQUE | `WHERE status='active'` |
| `idx_sub_invoices_brand` | `subscription_invoices` | `(brand_id, created_at DESC)` | — |
| `idx_sub_invoices_status` | `subscription_invoices` | `(status, created_at DESC)` | — |
| `idx_attribution_active` | `attribution_clicks` | `(follower_id, influencer_id, expires_at DESC)` | — |
| `idx_attribution_expires` | `attribution_clicks` | `(expires_at)` | — |

### Triggers created (4)
`updated_at` BEFORE-UPDATE triggers on
`subscription_tiers`, `brand_subscriptions`, `subscription_invoices`,
`categories` — all reusing the existing `update_updated_at()` function
(M001).

## Seed rows (admin-editable; placeholder values surfaced for founder review BEFORE the SQL is generated)

### `subscription_tiers` (4 rows)
```
tier_key    name          monthly_price_inr  max_campaigns  max_sets  max_inf  max_products  is_enterprise
free        Free                       0.00              1         1        5            10        false
growth      Growth                  2,499.00              3         3       25           100        false
pro         Pro                     9,999.00             10        10      100           500        false
enterprise  Enterprise             29,999.00             -1        -1       -1            -1        true
```
`-1` = unlimited. Every numeric editable via Phase A7 admin UI; updates
take effect at the NEXT cycle renewal (no retro-charge).

### `categories` (16 rows)
```
key                name                  label                path_a  path_b  path_c
salon_beauty       salon_beauty          Salon & Beauty        9.00    5.00    7.00
restaurant         restaurant            Restaurant            8.00    4.00    6.00
fashion            fashion               Fashion              10.00    5.00    7.00
car_rental         car_rental            Car Rental            8.00    4.00    6.00
packaged_food      packaged_food         Packaged Food         9.00    5.00    7.00
florist            florist               Florist              10.00    5.00    7.00
wedding_planner    wedding_planner       Wedding Planner      10.00    5.00    7.00
function_hall      function_hall         Function Hall        10.00    5.00    7.00
gym_fitness        gym_fitness           Gym & Fitness         8.00    4.00    6.00
travel_hotel       travel_hotel          Travel & Hotel        9.00    5.00    7.00
electronics        electronics           Electronics           8.00    4.00    6.00
jewellery          jewellery             Jewellery             8.00    4.00    6.00
footwear           footwear              Footwear              8.00    4.00    6.00
furniture          furniture             Furniture             8.00    4.00    6.00
optical            optical               Optical               8.00    4.00    6.00
home_services      home_services         Home Services         8.00    4.00    6.00
```
All percentages PLACEHOLDERS from the brief's Glow Studio walkthrough;
every value editable via Phase A7 admin UI (`/admin/pricing/categories`).
Founder reviews the CSV draft (`backend/seeds/categories_draft.csv`)
BEFORE the migration commits — per `feedback_csv_first_seeds.md`.

## Sanity invariants the runner script asserts
1. `SELECT COUNT(*) FROM subscription_tiers` = 4.
2. `SELECT COUNT(*) FROM categories` = 16.
3. `SELECT COUNT(*) FROM brand_subscriptions` = 0 (no backfill).
4. `SELECT COUNT(*) FROM subscription_invoices` = 0.
5. `SELECT COUNT(*) FROM attribution_clicks` = 0.
6. Each `subscription_tiers` row passes its CHECK constraints (price >= 0; limits >= -1).
7. `uniq_brand_subs_active` index exists with the predicate `WHERE (status = 'active')`.
8. Re-running `058_billing_subscriptions.sql` produces zero state delta (idempotency).

## Regression evidence
- `pnpm qa` 66/66 GREEN, C1 STATE=GREEN, gate=0 — captured BEFORE and
  AFTER applying the migration locally.
- `pnpm qa:db` informational lane: substrate applies migrations 001..058
  with no error; per-migration count == 55 (was 54 with M055; M056+M057
  added by Meals push → 56 migrations); after this contract → 58
  migrations applied 0-error.
- No code under `backend/src/` modified in this phase → behavioural
  regression is impossible.

## Deploy posture
**PRODUCTION-IMPACTING** on push:
- `git push origin main` → Render auto-deploys backend → migrations
  runner applies 058 on Supabase prod (additive only, 5 new tables, 4
  new enums; no existing table touched).
- Vercel auto-deploys brand-web + admin-web (no code change here, but
  Vercel re-deploys on every push by default — behaviourally a no-op).
- Mobile NOT pushed by git; no OTA bundle needed.

Push is surfaced for explicit founder go per CLAUDE.md §1
"production-impacting … surfaced explicitly, never silent; explicit go
required." Never silent.
