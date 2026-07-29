# 01 — Spec: persistent-session

Founder: *"persistent login, i need once login… after refresh going
back to login"* — plus: the landing page should offer a **Go to
Dashboard** button to someone already signed in on that browser.

## How the session is actually held

Three pieces, and only the third was misconfigured:

| Artifact | Lifetime | Purpose |
|---|---|---|
| `refresh_token` (HttpOnly cookie, server-set) | **30 days**, rotating | the real session |
| `inflx_token` in `localStorage` | access JWT, 15 min | `Authorization` header |
| `inflx_token` **cookie** | — | *only* so `middleware.js` can tell "has a session" before any JS runs |

The cookie is a pre-hydration hint. Real auth is enforced by the API
on every call, and an expired access token is rotated transparently by
`tryRefreshToken()`.

## D1 — the gate cookie expired 30 days before the session did

- `app/login/page.js:199` wrote it with **`max-age=2592000`** (30d).
- `lib/api.js:49` (`tryRefreshToken`) rewrote it with
  **`max-age=900`** (15 min).

`app/dashboard/layout.js:65` calls `tryRefreshToken()` on **every
mount**. So the first visit to the dashboard immediately downgraded a
30-day cookie to a 15-minute one.

Fifteen minutes later, a reload hits `middleware.js:39`:

```js
if (pathname.startsWith('/dashboard') && !token) {
  return NextResponse.redirect(new URL('/login', request.url));
}
```

Middleware runs **on the server, before any JS** — it cannot read
`localStorage` and cannot trigger a refresh. So the user was bounced
to `/login` while holding a perfectly valid 30-day refresh token.
That is the reported bug.

## D2 — `SameSite=Strict` withheld the cookie on inbound links

Both writers used `SameSite=Strict`, which suppresses the cookie on
navigations originating anywhere else — a link in WhatsApp, email, a
search result. Arriving that way looked signed-out **even inside the
15-minute window**, and the middleware redirect fired again.

`Lax` is the correct choice for a first-party session gate: it is sent
on top-level navigations while still blocking cross-site subrequests.

## D3 — four writers, three different attribute sets

`login/page.js:199` (30d, Strict) · `lib/api.js:49` (900s, Strict) ·
`dashboard/layout.js:56` (30d, no SameSite) ·
`admin/layout.js:104` (30d, no SameSite).

Whichever ran last silently won. This is why the bug was intermittent
and hard to pin down — the layouts' re-sync writes masked it whenever
the dashboard actually managed to mount.

## Fix

One exported writer, `setSessionCookie(token)` in `lib/api.js`:
30-day `max-age` (matching the refresh token), `SameSite=Lax`, and
`Secure` when served over https. All four call sites use it.

## L1 — landing page

`app/page.js` reads the stored session **after mount** (localStorage
is client-only, so resolving it during render would break hydration)
and swaps its CTAs for a single **Go to Dashboard** — or **Go to
Admin** for an admin. Influencer and follower roles are deliberately
excluded: they have no web surface, so the button would dead-end.

Deliberately **not** an auto-redirect — the founder asked for the
landing page to still open, with a button.

## Non-goals

- Cross-device / "same email linked browser" recognition. That
  requires an identity check, i.e. logging in. Persistence here is
  per-browser, which is what a 30-day session can honestly offer.
- Changing token lifetimes. Access stays 15 min, refresh 30 days.
