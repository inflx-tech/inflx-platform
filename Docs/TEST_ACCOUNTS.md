# INFLX test accounts

**Rewritten 2026-08-20** by `features/stage-0-clear-the-decks`. The previous version of this
file described a mock OTP and `localhost` dashboards, neither of which is true any more.

---

## There is no mock OTP. Read this first.

`backend/src/services/otp.service.js` says it plainly:

> *"The code is ALWAYS a real random 6-digit value — there is no mock mode… NOT on a config
> flag — a flag is what let mock codes reach production."*

`OTP_MOCK=true` **is** present in the production environment file. **The code ignores it.**
The only bypass is `NODE_ENV=test`, which exists solely so the automated suite can run.

**Consequence:** to log in as any account, you need the SIM. Every practice account that
someone has to sign into must use a phone number a real person holds.

---

## Where things run

| Surface | Address |
|---|---|
| Backend | `https://inflx-platform.onrender.com/v1` |
| Brand + admin web | Vercel (auto-deployed from `main`) |
| Phones | The apps point at production. There is no staging. |

The staging Supabase database set up in June **no longer resolves** — verified 2026-08-20.
Production is the only database.

---

## One phone, one role

`users.phone` is `UNIQUE` and `users.role` is a single column. **A phone number can be a
follower, or a brand, or a creator — never two of them.** Verified against production
2026-08-20: no user has both a brand and an influencer record.

This matters when picking practice numbers. Reusing a number that already signed up as a
follower will not give you a brand account.

---

## Practice accounts

Managed by `backend/scripts/seed-practice-world.js`. Every row it creates is written to
`backend/scripts/practice-world.manifest.json`, and
`backend/scripts/remove-practice-world.js` removes exactly what that manifest lists.

| Purpose | Number | State |
|---|---|---|
| Practice follower | 8639448121 | Already a follower since 2026-04-10 |
| Practice brand *or* creator | 8465994979 | Free |
| The other of the two | *not yet supplied* | Needed before both sides can be walked |

**The ~21 scenery creators never log in.** They exist so a creator search returns a realistic
result set. They carry reserved phone numbers in the `+9179000001xx` block and no SIM.

## What "switched off" means

Everything the seeder creates is inert to the public:

- practice brands sit at `users.status = 'pending'`, so they are outside brand discovery
- practice products are `is_active = false` and `pushed_to_store = false`, so no store shows them
- practice posts are never `approved`, so the follower feed cannot pick them up

Real followers see exactly what they see today.

---

## Local development

A local Postgres for development: `pnpm db:dev:up` (container `inflx-dev-pg`, port 5433).
The automated suite uses a separate ephemeral container: `pnpm qa:db:up` (`inflx-qa-pg`,
port 5544) — that one is wiped on every run and is the only place `NODE_ENV=test` applies.

Both need Docker Desktop running.
