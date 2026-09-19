# change-login-number — impact

**Production-impacting. No money moves.** Migration 189 is additive (one audit table).

## Behaviour that changes
- Four new authenticated routes under `/auth/change-phone/*`. Nothing existing changes shape.
- A confirmed change revokes every refresh token of that account: other devices signed in to it
  are signed out at their next refresh. The device that made the change gets a new pair.
- `users.phone` becomes writable after registration for the first time. Everything that reads it
  (the agreement, the payout contact, admin pages, SMS notifications) follows automatically.

## What does not change
OTP delivery (same MSG91 path and limits), sign-in, the one-number-many-roles rule, balances,
contracts, any other table.

## Apps
Brand and creator OTA (JS only). One new screen, one link on two existing screens.
