# change-login-number — expected outputs

Assertions in `backend/tests/change-login-number.test.js` (1–12) and `Packages/Mobile` jest (13–15).

1. `POST /auth/change-phone/start` (signed in) → 200, an OTP row for the CURRENT number; unauthenticated → 401.
2. `verify-old` with the wrong code → 401; five wrong codes → 429 `TOO_MANY_ATTEMPTS`, the attempt is over.
3. `verify-old` with the right code → 200 `{ change_token }`; the code cannot be replayed.
4. `send-new` without a valid change token → 401 `CHANGE_EXPIRED`.
5. `send-new` with the same number → 422 field `new_phone` "That's already your number."
6. `send-new` with a number holding an account of the same role → 409 `PHONE_TAKEN` "This number already has a brand account. Sign in with it instead."
7. `send-new` with a number holding an account of the OTHER role → 200 (one number, many roles).
8. `send-new` with a malformed number → 422.
9. `confirm` with the right code → 200 `{ phone, access_token, refresh_token }`; `users.phone` = new; a `phone_changes` row with old, new, role; the old refresh token is revoked (`/auth/refresh` with it → 401); the new pair works.
10. After confirm, `verify-otp` for the OLD number + role creates a fresh account; for the NEW number signs in to the moved account.
11. A change token older than 15 minutes → 401 `CHANGE_EXPIRED` on `send-new` and `confirm`.
12. A pending account can change its number (no `ACCOUNT_PENDING` on any of the four).
13. (mobile) The four-step screen advances only on server success; the three refusals render the agreed words; the 30-second resend countdown.
14. (mobile) Business details and Profile info show "Change number" beside the locked phone.
15. (mobile) On confirm the app stores the new tokens and shows the green line on return.
