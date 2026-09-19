# change-login-number — workflow

## Actor
A signed-in brand or creator (any approval status), holding both phones.

## Preconditions
An account with phone A. Phone B free of an account of the same role.

## Steps (user-observable)
1. Profile → Business details / Profile info → tap **Change number** → N1 shows the masked current number and the both-phones note.
2. **Send code** → a code reaches phone A → N2.
3. Enter the code → verified → N3 (the server hands the app a 15-minute change token).
4. Type phone B → **Send code** → a code reaches phone B → N4. The same number, or a number that already holds an account of this role, is refused on N3 with the agreed words.
5. Enter the code → **Confirm new number** → N5: back on the profile, the phone field shows B, a green line confirms it.
6. The app keeps its session. Any other phone signed in to this account is signed out at its next request.
7. Signing in tomorrow with B works; with A it starts a fresh registration (A no longer holds this role).

## Success definition
`users.phone = B` for this user only; one `phone_changes` row; every refresh token issued before the change is revoked; the app that made the change holds a new access + refresh pair; the agreement and payout paths read B (they read `users.phone`).

## Failure / edge workflows
- Wrong code five times on N2 or N4 → the attempt ends, back to N1.
- More than 15 minutes between N1 and N4 → "Time's up", back to N1.
- Phone B already has a brand (creator) account → refused on N3, nothing sent.
- The same person's other-role account on phone A is untouched (stated on N3).
- Lost old phone → no self-service; the team handles it offline.

## Build order
1. Migration 189 (`phone_changes`) + `run-189.js`.
2. `changePhone.controller.js` + four routes under `/auth/change-phone/*`; `jwtService.revokeAllRefreshTokens`.
3. `backend/tests/change-login-number.test.js`.
4. Phones: `ChangeNumberScreen` (one screen, four steps) in both profile stacks; the link on the two detail screens; `authApi.changePhone*`.
5. Deploy on the founder's go: run-189 → commit → push → OTA brand → OTA influencer.
