# change-login-number — spec (DRAFT for the founder's lock)

Founder, 19 Sep 2026: "say i registered with one number … tomorrow i want to change my login
number … click change number, OTP to old number, verify and new number … design that flow."

**Scope: the brand app and the creator app.** The follower app and brand-web are untouched (the
follower app signs in the same way, so the same endpoint can serve it later; the website is
re-skinned later onto the same backend).

## What it delivers

A person can move their account to a new phone number without losing anything — their profile,
their campaigns or collaborations, their wallet, their approval. The old number stops working
the moment the new one is confirmed. Nobody can do this without holding both phones.

## 1. Where it lives

Profile → (creator) Profile info · (brand) Business details → the locked **Phone** field gains a
link: **Change number**. That is the only entry point.

## 2. The flow — four screens

```
Change number
    ↓
1. "We'll text a code to your current number" · +91 98••• ••210 · [Send code]
    ↓
2. Enter the code sent to the OLD number (6 digits, 10 minutes, resend after 30 s)
    ↓
3. Enter the NEW number · [Send code]
    ↓
4. Enter the code sent to the NEW number
    ↓
"Your login number is now +91 9xxxx xxxxx." → back to the profile, phone field updated.
```

Both codes go through the same MSG91 path sign-in uses today. The whole flow must finish inside
**15 minutes** and inside the same session, or it starts over.

## 3. Rules

| # | Rule |
|---|---|
| 1 | The old number must be verified first. Without both phones in hand the number cannot change. |
| 2 | The new number must be a valid Indian mobile number, and **different** from the old one. |
| 3 | **The new number must not already hold an account of the same role.** One number may be a brand *and* a creator (rules doc §1, one number many roles), but never two brands or two creators. Refused with: *"This number already has a brand account. Sign in with it instead."* |
| 4 | The change applies to **this role only**. If the same person also has a creator account on the old number, that account keeps the old number until they change it from the creator app. Stated on screen 3. |
| 5 | Everything else stays: profile, approval status, campaigns, collaborations, wallet, agreements. Nothing about the account except `users.phone` changes. |
| 6 | The old number is signed out everywhere: every refresh token of this account is revoked when the new number is confirmed; the phone that made the change gets a fresh session. |
| 7 | A pending or rejected account may change its number too — it is identity, not an action on the platform. |
| 8 | Both OTP steps use the existing send limits (one code at a time per number, resend after 30 s); five wrong codes end the attempt. |
| 9 | The change is written to an audit row (`phone_changes`: user, old, new, when, from which device) so the team can answer "who changed this". |

## 4. What the server gains

- `POST /auth/change-phone/start` — sends the code to the **current** number. Authenticated.
- `POST /auth/change-phone/verify-old { otp }` — returns a short-lived `change_token` (15 min).
- `POST /auth/change-phone/send-new { change_token, new_phone }` — rules 2 and 3 checked here, code sent to the new number.
- `POST /auth/change-phone/confirm { change_token, otp }` — rewrites `users.phone`, revokes every refresh token, issues a new access + refresh pair, writes the audit row, returns `{ phone }`.

No other endpoint changes. The agreement and payout paths already read `users.phone`, so they
follow automatically (spec registration-and-profile §7).

## 5. What is deliberately out

- Changing a number without access to the old phone (lost SIM). The team does this by hand,
  offline, after their own checks — no self-service recovery this version.
- Email as a second factor (email is collected but not verified — registration-and-profile §10).
- Changing the number from brand-web.

## 6. Sequence

1. This spec locks. ← we are here
2. Mockups (four phone screens, one per side — the same four with the app's own header) drawn.
3. Mockups lock.
4. Build: backend, then both phones, tests, deploy on the founder's go.
