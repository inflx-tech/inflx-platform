# 04 — Workflow prediction

Stated before the diff is captured.

## The one test that matters

Sign in. Wait **more than 15 minutes**. Press F5 on any `/dashboard`
route.

- **Predicted:** the page reloads in place.
- **Today:** you land on `/login`.

Fifteen minutes is the threshold because that is what
`tryRefreshToken()` was setting the gate cookie to. Testing a reload
immediately after signing in will *not* reproduce the bug — the cookie
is still alive — which is likely why it read as random rather than
reproducible.

## Second observable

Open an `inflx.in/dashboard/...` link from WhatsApp or email while
signed in.

- **Predicted:** it opens.
- **Today:** `/login`, regardless of how recently you signed in,
  because `SameSite=Strict` withholds the cookie on inbound
  navigation.

## Landing page

Signed in, visit `inflx.in`: the navbar, the hero and the Brand
Dashboard block each collapse to a single **Go to Dashboard →**
(**Go to Admin →** for an admin). Signed out: completely unchanged.

The page still renders normally — no auto-redirect, as asked.

## Verify in devtools

Application → Cookies → `inflx_token`. Expiry should read roughly
30 days out and `SameSite` should read `Lax`, both immediately after
login **and** after any background refresh. Previously the expiry
collapsed to 15 minutes as soon as the dashboard mounted.

## Explicitly NOT predicted

- **Recognising you on another device or browser.** The founder's
  "same email linked browser" is not achievable without identifying
  the user, which means signing in. This is per-browser persistence.
- **Never seeing the login screen again.** After 30 days without a
  visit, or after a revoked refresh token, a fresh sign-in is
  correct.
- **A change to who is allowed in.** The middleware rule is
  untouched; only the cookie's lifetime and SameSite changed. Real
  authorisation was always, and still is, enforced by the API.
