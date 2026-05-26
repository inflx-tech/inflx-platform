# Expected Outputs — backend-trust-proxy-render

## Database
No schema change.

## API JSON shapes
Unchanged.

## Render log signal post-fix

**Before:**
```
ValidationError: The 'X-Forwarded-For' header is set but the Express
'trust proxy' setting is false (default). ...
    code: 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR'
```
(fires on most auth-protected requests)

**After:**
(silent — no ValidationError; req.ip correctly resolves to client IP)

## Test results
- pnpm qa main lane GREEN unchanged.
- Backend boot smoke clean.

## Deploy posture
PRODUCTION-IMPACTING (Render redeploys backend with one line of
config). NO migration. NO schema change. Rate limits now correctly
apply per-real-client-IP — potential side effect: each pnpm qa
runner now has its own bucket, which should make the W3/W5/W5a/W5b
specs MORE stable, not less.
