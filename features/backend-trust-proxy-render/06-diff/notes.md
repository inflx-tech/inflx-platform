# 06-diff — backend-trust-proxy-render

**Before:** `backend/src/app.js` had no `trust proxy` setting, so
Express used its default (`false`). Render's reverse proxy adds the
real client IP to `X-Forwarded-For` and forwards the request to our
backend, but with `trust proxy = false` Express treats that header
as untrusted and falls back to using the proxy's IP as `req.ip`.

express-rate-limit (loaded for /v1/auth/* + /v1/auth/send-otp/*)
detects this misconfiguration and throws a ValidationError on every
authenticated request, polluting Render logs:

```
ValidationError: The 'X-Forwarded-For' header is set but the Express
'trust proxy' setting is false (default). ...
```

Net effects:
- Log noise on every protected request.
- All real clients share one rate-limit bucket (the proxy IP),
  making the auth limiter effectively global.
- "Failure mix varies per run" behaviour on QA W3/W5/W5a/W5b specs
  consistent with global bucketing.

**After:** one line near the top of app.js:

```js
const app = express();

// Render runs us behind a single reverse proxy. Trusting one hop
// lets express-rate-limit + req.ip correctly resolve to the real
// client IP from X-Forwarded-For. See
// features/backend-trust-proxy-render/.
app.set('trust proxy', 1);
```

`1` means trust exactly one hop (Render's proxy). NOT `true` (which
would trust unlimited hops — IP spoofing risk on platforms that
allow direct external connections).

Net effects:
- ValidationError stops firing.
- `req.ip` resolves to the real client IP from X-Forwarded-For.
- Rate limits apply per-real-client.
- QA runner specs should see more stable rate-limit behaviour
  (each runner's IP gets its own bucket).

**Defensive behaviour preserved:**
- Local dev (`http://localhost:*`) has no X-Forwarded-For → Express
  uses the socket IP, same as before. No regression.
- Other platforms (Heroku, Fly, Vercel, Cloud Run) use the same
  single-proxy pattern; this config is portable.

**Verified locally:** boot smoke clean; pnpm qa stays 76/76 GREEN.
Local dev requests have no X-Forwarded-For so behaviour is
unchanged for the dev environment.
