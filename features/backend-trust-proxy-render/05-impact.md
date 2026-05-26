# Impact — backend-trust-proxy-render

## Changes
- `backend/src/app.js` — one line: `app.set('trust proxy', 1)`.
- 1 contract folder.

## Blast radius
- `req.ip` extraction in Express. Affects:
  - express-rate-limit (now correctly buckets per client)
  - morgan log entries (now show real client IP)
  - any custom IP-aware code (none audited beyond rate limit
    middleware).
- No business-logic change. No brand-facing UI change.

## Rollback
Revert this commit. Express reverts to `trust proxy = false`, the
ValidationError returns. No data risk.

## Risks
- **Rate limit behaviour shifts** — pre-fix, all real clients shared
  one bucket via the proxy IP. Post-fix, each client has its own
  bucket. Some brands who happened to be sharing a bucket with
  abusers may now have a less-flaky experience; some abusers may
  find they can hit limits less easily individually. Net positive.
- **No regression surface for QA suite** — the suite's rate-limit
  retry logic already handles 429s gracefully. The trust proxy fix
  should reduce 429 frequency, not increase it.

## Pre-push checklist
1. pnpm qa main lane GREEN.
2. Backend boot smoke clean.
3. gov-check exit 0.
