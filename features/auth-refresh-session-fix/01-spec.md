# auth-refresh-session-fix — sessions must survive lost refresh responses

## Problem (founder device report, 2026-07-25)

Follower app, address save → "Failed — Session expired. Please log in
again." despite a fresh login earlier the same day.

## Root cause (verify-twice: code read, both sides)

Two compounding defects:

1. **Backend — revoke-on-rotate** (`auth.controller.js` refresh handler):
   every `/auth/refresh` stores a NEW refresh token and immediately
   revokes the presented one. If the response never reaches the phone
   (app killed mid-refresh — the OTA double-relaunch ritual does exactly
   this — or a Render TCP reset, or a mid-flight network drop), the
   device keeps the now-revoked token. Every later refresh 401s and the
   session is permanently bricked until re-login.

2. **Mobile client — transient treated as terminal** (`api.js`
   `tryRefreshAccessToken` + `request`): when the refresh CALL fails
   transiently (network error, timeout, 5xx, malformed body) the code
   returns null, falls through to the 401 branch, `clearSession()`s and
   shows "Session expired" — wiping locally-stored tokens that are
   still perfectly valid server-side.

## Fix

1. **Backend**: stop revoking the old refresh token during rotation.
   The old token dies at its own natural `expires_at` (30 days).
   `refresh_tokens` storage is already additive (every login INSERTs a
   coexisting row), so multiple live tokens per user is the existing
   model — this closes the lost-response brick with zero schema change.
   Logout revocation unchanged.
2. **Mobile**: `tryRefreshAccessToken` now returns a tri-state —
   `{token}` on success, `{invalid}` only when the server definitively
   rejects the token (401/403), `{transient}` for everything else
   (network error, timeout, non-ok, unparseable). `request()` only
   clears the session on definitive invalid; a transient refresh
   failure surfaces a retryable NETWORK_ERROR and leaves the session
   intact. Refresh fetch also gets the same 30s abort timeout as every
   other call (it previously had none and could hang).

## Out of scope

Mobile logout not revoking server-side (cookie-only revocation) —
pre-existing, unrelated to this defect.
