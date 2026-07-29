# 05 — Impact

**Verdict: a session now lasts as long as its refresh token instead of
15 minutes. No backend, no schema, no token-lifetime change.**

## Mechanics

- **Schema / migrations / backend:** none. This is entirely
  brand-web.
- **Token lifetimes:** unchanged — access 15 min, refresh 30 days.
  Only the *gate cookie's* `max-age` changed, and that cookie was
  never an authorisation artifact.
- **Middleware:** untouched.
- **New export:** `setSessionCookie()` from `lib/api.js`, now the sole
  writer of `inflx_token`.

## Security reasoning

The cookie carries the access JWT and is **not** HttpOnly — it never
was, since client JS has to write it. Extending its `max-age` does not
widen exposure: the same token already sat in `localStorage` under the
same origin, readable by the same script. The JWT itself still expires
in 15 minutes; a stale cookie value simply fails server-side
validation and triggers a refresh.

`SameSite` moves from `Strict` to `Lax`, which is a deliberate
loosening. `Lax` still withholds the cookie on cross-site
subrequests and on cross-site POSTs — the CSRF-relevant cases — while
allowing top-level inbound navigation. For a session gate on a
first-party app this is the standard choice, and `Strict` was actively
breaking normal use.

`Secure` is now set on https, which the previous writers omitted
entirely. That is a small net improvement.

## Risk

Low, with one behaviour change worth stating plainly: **middleware
will now admit users whose session has genuinely died.** They reach
the dashboard shell, the first API call 401s, the refresh fails, and
`clearSession()` bounces them to `/login`.

That is the correct trade. The gate is a hint, not the authority. The
alternative — what we have today — blocks people who are genuinely
authenticated, which is both more common and far more damaging than
one extra bounce through a shell.

## What this does not do

Recognise a user across devices or browsers. That requires identity,
i.e. signing in.

## Classification

**Production-impacting** — `Packages/brand-web/**` → Vercel. No
backend, no migration, no OTA. Explicit founder go required before
push.

## Verification

`pnpm qa` **GREEN — 79 passed, gate 0**, including
`qa/web/admin/role-gate.spec.ts` M1/M3/M5, which assert that a missing
cookie still produces the redirect. That behaviour is deliberately
unchanged.
