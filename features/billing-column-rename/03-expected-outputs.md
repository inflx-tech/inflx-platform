# Expected Outputs — billing-column-rename (Phase A2)

## Schema state
- `follower_transactions.marketplace_fee_amount numeric(8,2)` present.
- `follower_transactions.platform_fee` ABSENT.
- All existing rows preserved with values intact (RENAME is metadata-only).

## API field names (UNCHANGED)
- `GET /v1/brands/me/transactions` response → still emits `platform_fee` per row.
- `GET /v1/admin/stats/revenue` → still emits the aggregated revenue under existing JSON keys.
- `POST /v1/follower/.../buy` (transaction.controller responses) → still emits `platform_fee` inside `breakdown`.

## Test invariants
- All 6 affected test files pass against renamed column.
- pnpm qa 67/67 GREEN, gate=0.
- Backend jest local-dev DB suite passes.

## Deploy posture
PRODUCTION-IMPACTING on push. Render runs M059 (atomic RENAME on
Supabase prod, metadata-only). Coordinated code change in same commit
means no prod-window where backend reads `platform_fee` after DB
column became `marketplace_fee_amount`.
