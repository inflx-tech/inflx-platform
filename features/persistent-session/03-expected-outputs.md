# 03 — Expected outputs

## The `inflx_token` cookie

Written by exactly one function, `setSessionCookie()` in
`lib/api.js`:

```
inflx_token=<access_jwt>; path=/; max-age=2592000; SameSite=Lax; Secure
```

`Secure` is appended only when `location.protocol === 'https:'`, so
local http development is unaffected.

| Writer | Before | After |
|---|---|---|
| `login/page.js` | `max-age=2592000; SameSite=Strict` | `setSessionCookie()` |
| `lib/api.js` (refresh) | **`max-age=900`**; `SameSite=Strict` | `setSessionCookie()` |
| `dashboard/layout.js` | `max-age=2592000`, no SameSite | `setSessionCookie()` |
| `admin/layout.js` | `max-age=2592000`, no SameSite | `setSessionCookie()` |

Unchanged: `clearSession()` still expires the cookie by name + path,
which does not depend on the other attributes.

## Middleware behaviour

Untouched. Still: no cookie on `/dashboard` or `/admin` → 307 to
`/login`. The fix is that the cookie now survives as long as the
session, not 15 minutes.

## Landing page (`/`)

| Stored role | Navbar / hero / brand block |
|---|---|
| none | Sign In · Get Started · Register Your Business (unchanged) |
| `brand` | **Go to Dashboard →** |
| `admin` | **Go to Admin →** |
| `influencer` / `follower` | signed-out CTAs — no web surface to send them to |

Server-rendered HTML is identical for every visitor; the swap happens
after mount, so there is no hydration mismatch and no flash of the
wrong state for signed-out users.

The Brand Dashboard block's sub-copy changes to "You're already signed
in on this browser" when a session is present.

## Regression bar

`pnpm qa` green — in particular the role-gate matrix, which asserts
the no-cookie redirect still fires.
