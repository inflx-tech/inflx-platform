# backend-trust-proxy-render

> Tiny config fix surfaced during the A6.5 smoke debug session. The
> backend on Render runs behind Render's reverse proxy. Express's
> default `trust proxy = false` means `req.ip` returns the proxy's
> IP for every request, and `X-Forwarded-For` is rejected by
> express-rate-limit as untrusted. This produces a noisy
> ValidationError in Render logs on every authenticated request
> AND causes rate limits to apply globally (one shared bucket
> across all real clients) instead of per-client-IP.

## Symptom

Render logs (visible during the smoke debug 2026-05-26):

```
ValidationError: The 'X-Forwarded-For' header is set but the Express
'trust proxy' setting is false (default). This could indicate a
misconfiguration which would prevent express-rate-limit from
accurately identifying users.
    at Object.xForwardedForHeader (.../express-rate-limit/...)
```

This appears on most auth-protected endpoints. express-rate-limit
falls back to using `req.ip` (the proxy IP), so the auth limiter
(20 requests / 15 minutes) was effectively one global bucket — the
"failure mix varies per run" behaviour the founder noticed on the
QA suite's W3 / W5 / W5a / W5b specs is consistent with this
(every pnpm qa run + every brand login + every webhook + every
random scraper all share the same bucket).

## Fix

```js
// In app.js, near the top after `const app = express()`:
app.set('trust proxy', 1);
```

`1` means trust one hop (Render's proxy). With this set:
- `req.ip` returns the real client IP from the X-Forwarded-For
  header.
- express-rate-limit's ValidationError stops firing.
- Rate limits apply per-real-client-IP correctly.

## Why this is correct

Render runs every web service behind a single reverse proxy. The
proxy adds the real client IP to `X-Forwarded-For` and forwards
the request. Telling Express to trust ONE hop is the documented
Render pattern (and the standard pattern for any service behind
a single reverse proxy: Heroku, Vercel, Fly, Cloud Run, etc).

Setting it to `1` (not `true`) is intentional — `true` trusts
unlimited hops which is IP-spoofing risk on platforms that allow
direct external connections. `1` trusts exactly the single hop
Render's infra adds, which is the correct posture.

## Verify-twice notes

- The fix doesn't change any business logic. It changes how
  Express extracts the client IP, which downstream code (rate
  limiters, logs) uses.
- The QA suite's rate-limit-flake behaviour should IMPROVE post-
  fix (each QA runner gets its own IP bucket instead of sharing
  with all other traffic).

## Out of scope

- The mandate-status quirk on Aveen's row (separate follow-up if
  prioritized).
- Diagnostic logging cleanup (separate follow-up).
- Yearly billing rollout (separate flow).

## Files

- `backend/src/app.js` — one line.
- This contract.

## Non-functional

- Deploy posture: PRODUCTION-IMPACTING (Render redeploys backend
  with corrected proxy trust setting). NO migration. NO schema
  change. NO behaviour change for the brand-facing UI — only the
  internal IP extraction + rate-limit bucketing changes.
- pnpm qa should remain GREEN. May improve W3/W5/W5a/W5b stability
  by giving each runner its own rate-limit bucket.
