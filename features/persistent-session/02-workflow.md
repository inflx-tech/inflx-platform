# 02 — Workflow

## W1 — Sign in once, stay signed in

1. Brand signs in with phone + OTP.
2. Uses the dashboard; `tryRefreshToken()` fires on every mount.
3. Closes the tab. Returns **hours or days later** and opens
   `/dashboard`.
4. **Predicted:** middleware sees the still-valid gate cookie and
   serves the page. The access token is rotated in the background
   from the 30-day HttpOnly refresh cookie. No login screen.
5. **Today:** if more than 15 minutes have passed since the last
   refresh, the gate cookie is gone and middleware redirects to
   `/login` — even though the session is alive.

## W2 — Plain refresh, mid-session

Press F5 on any `/dashboard/*` route.

- **Predicted:** the page reloads in place.
- **Today:** reloading more than 15 minutes after the last mount
  bounces to `/login`.

## W3 — Arriving from an external link

Open an `inflx.in/dashboard/...` link from WhatsApp, email or a search
result.

- **Predicted:** the cookie travels with the navigation
  (`SameSite=Lax`) and the page opens.
- **Today:** `Strict` withholds it, middleware sees nothing, and the
  user lands on `/login` regardless of how recently they signed in.

## W4 — Landing page for a signed-in visitor

1. Signed-in brand opens `inflx.in`.
2. **Predicted:** the landing page renders as normal, but the navbar,
   the hero and the Brand Dashboard block all offer a single
   **Go to Dashboard →**. An admin sees **Go to Admin →**.
3. A signed-out visitor sees the unchanged Sign In / Get Started
   pair.
4. The page is **not** auto-redirected — the founder asked for the
   landing page to still open.

## W5 — Session genuinely expired

Refresh token dead or revoked.

- Middleware now lets the user through to `/dashboard` (the gate
  cookie may still be present).
- The first API call 401s, `tryRefreshToken()` fails, `clearSession()`
  wipes storage and the cookie and redirects to `/login`.
- **This is intended:** the gate is a hint, not the authority. The
  worst case is one bounce through the dashboard shell instead of
  being blocked while genuinely authenticated — the far more common
  and more damaging failure.

## Verification

- `pnpm qa` green, including the existing role-gate matrix
  (`qa/web/admin/role-gate.spec.ts`), whose M1/M3/M5 cases assert that
  a **missing** cookie still redirects. That behaviour is unchanged.
- Manual: sign in, wait past 15 minutes, reload. Founder's E2E pass.
