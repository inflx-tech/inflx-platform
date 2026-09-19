# change-login-number — before/after notes

**Before:** the login number was written once, at sign-in, and never again. The Phone tile on
Business details and Profile info was locked with no way out; a person who changed SIM was a
support ticket.

**After (server):** four authenticated routes under `/auth/change-phone/*`. The old number is
verified first, a 15-minute change token carries the attempt, the new number is checked (valid,
different, not already this role's), its code confirms the change, `users.phone` is rewritten for
this role only, every refresh token is revoked, the device gets a fresh pair, and a
`phone_changes` audit row is written (migration 189). Five wrong codes end the attempt.

**After (phones):** one shared four-step screen reached from the "Change number" link on both
detail screens; the three refusals use the locked words; on confirm the app stores the new
session and returns to the tile with the new number and a green line.

_Phase 3 details from the phone build report — see the build summary in `lock.json`._
