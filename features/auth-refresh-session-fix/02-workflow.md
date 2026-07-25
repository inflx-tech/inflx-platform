# Workflow

1. User logs in on mobile → access (15m) + refresh (30d) tokens stored.
2. Any authed call after 15m → 401 → client silently refreshes → retry.
3. **Refresh response lost** (app killed / TCP reset): device keeps the
   OLD refresh token. Expected end state after this fix: that token is
   STILL VALID server-side → next launch refreshes normally → user
   never sees "Session expired".
4. **Refresh call transiently unreachable**: user sees a retryable
   "Could not reach the server" error; session storage untouched;
   the very next attempt succeeds.
5. **Refresh token genuinely invalid/expired** (30d idle, logout):
   session cleared + "Session expired. Please log in again." — the
   ONLY path that logs the user out.
