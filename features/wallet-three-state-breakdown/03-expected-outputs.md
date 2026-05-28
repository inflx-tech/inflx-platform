# Expected Outputs — wallet-three-state-breakdown (Wave 2 commit 1)

## Database
No schema change.

## API JSON shape — `GET /v1/brands/me/wallet`
```json
{
  "success": true,
  "data": {
    "wallet": {
      "brand_id": "uuid",
      "total_loaded": 100000,
      "available_balance": 65000,
      "reserved_balance": 35000,
      "settled_balance": 0,
      "wallet_balance": 65000,
      "escrow_locked": 35000,
      "total_deposited": 100000
    }
  }
}
```
(Legacy fields `wallet_balance`/`escrow_locked`/`total_deposited`
retained for backward compatibility.)

## UI
`/dashboard/wallet` KPI strip: 4 cards — Available · Reserved ·
Settled · Total loaded.

## Test results
- pnpm qa main lane 76/76 GREEN (45.3s).
- Backend boot smoke clean.

## Deploy posture
PRODUCTION-IMPACTING (Render + Vercel redeploy). NO migration.
