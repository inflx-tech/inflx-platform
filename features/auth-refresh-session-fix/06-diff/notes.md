# Before / after — auth-refresh-session-fix

No visual surface: this is a service-layer reliability fix (mobile
`services/api.js` + backend refresh handler). The "diff" is behavioural:

- **Before**: refresh response lost (app killed mid-refresh, TCP reset)
  → stored refresh token already revoked server-side → next authed
  action shows "Session expired. Please log in again." Founder hit this
  on address save after a day of OTA double-relaunches. Separately, a
  transient network failure on the refresh call itself wiped a valid
  session.
- **After**: the old refresh token stays valid until its natural 30-day
  expiry, so a lost rotation response cannot brick the session; a
  transient refresh failure returns a retryable "Could not reach the
  server" error with the session left intact. The only logout path is a
  definitive server-side rejection of the refresh token.

Verified by `pnpm qa` (auth suite exercises login/refresh flows) +
mobile jest; device confirmation = founder re-logs in once (his token
was already revoked by the pre-fix defect) and address save works.
