# Workflow — backend-trust-proxy-render

## Actor
Any request handler that reads `req.ip` (rate limiters, logs).

## Preconditions
- Backend deployed on Render (single reverse proxy in front).
- `app.set('trust proxy', 1)` in app.js.

## Workflow A — auth request post-fix

1. Real client at IP `203.0.113.42` hits POST /v1/auth/send-otp.
2. Render's proxy adds `X-Forwarded-For: 203.0.113.42` and forwards
   to our backend.
3. Express sees `trust proxy = 1`, parses X-Forwarded-For, sets
   `req.ip = '203.0.113.42'`.
4. authLimiter / otpLimiter use `req.ip` as the bucket key →
   per-real-client rate limiting.
5. No ValidationError logged.

## Workflow B — pre-fix (reference)

1. Same client hits same endpoint.
2. Render's proxy adds X-Forwarded-For + forwards.
3. Express sees `trust proxy = false`, ignores X-Forwarded-For,
   sets `req.ip = '<proxy IP>'`.
4. express-rate-limit detects "header set + trust=false" mismatch →
   throws ValidationError → logs noise.
5. Rate limit applies per proxy IP — effectively one global bucket
   for all real clients.

## Success

- No more ValidationError in Render logs.
- pnpm qa main lane GREEN.
- Rate limits behave correctly per-client.

## Failure modes

- `req.ip` returns `undefined` for requests without X-Forwarded-For
  (e.g. direct localhost) — Express falls back to socket IP. No
  regression for local dev.
- Render reverse proxy changes hop count in the future — would
  need updating from `1` to whatever the new hop count is. Not
  expected; documented for posterity.
