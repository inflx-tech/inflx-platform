# profile-only-apps — spec

**Founder instruction (2026-09-10, verbatim):** "we have three apps....except profile in all
apps....delete evrything front end..........only frontend screens.....not backend,DB....only
visible screens"

Clarified the same day, in four answers:

| Question | Founder's answer |
|---|---|
| Which apps | **The three phone apps only** — Brand, Influencer (creator), Follower (shopper). Brand website and admin untouched. |
| Login | **Keep login** — phone, OTP, registration, waiting, rejected. Without them nobody can reach a profile. |
| Shopper profile | **Me + Edit Profile only** — orders, wishlist, addresses, returns, followed creators and saved posts go, with their rows on Me. |
| Deploy | **Ship to phones** — commit, push, OTA. |

## What stays on each phone

| App | Screens left |
|---|---|
| Brand | Brand Profile · Legal list · Legal document |
| Creator | Profile · Legal list · Legal document |
| Shopper | Me (Profile) · Edit Profile · Sign-in · Legal list · Legal document |
| All | Splash, and the whole sign-in stack (`screens/auth/`) |

**Legal kept on judgement, not instruction.** The Play Store requires the privacy policy to be
reachable inside the app. The legal pages sit under each profile, are in neither app folder,
and cost nothing to keep. Removing them would put all three apps out of store policy.

**Shopper sign-in kept** because the founder kept login. It is the only way from a guest
profile into an account.

## What goes

Every other screen file in `Packages/Mobile/src/screens/{brand,influencer,follower}/` — 89 of
the 94 — plus the 28 test files (and 1 fixture) that only tested those screens.

With one screen left, the bottom tab bar goes too. Each app opens straight on its profile.

## Explicitly NOT touched

- `backend/**` and the database. Every server route keeps answering.
- `Packages/brand-web`, `Packages/admin-web`.
- `components/`, `utils/`, `services/`, `contexts/`. They are not screens. Some are now
  unused; clearing that dead code is a separate, deploy-inert job.
- The APKs. This is a JS-only change and ships by OTA. `NATIVE_RUNTIME` is unchanged.

## Riding along (adjacent fix, login path)

Two uncommitted edits from 2026-09-03 sat in the tree, both on the rejected-brand screen, which
stays. `brandApi.resubmit` was missing, so "Resubmit" threw before any request left the phone.
The server route `POST /brands/resubmit` is live (`backend/src/routes/brand.routes.js:30`).
RejectedScreen also now checks the result instead of always saying "Resubmitted". Both
included: the OTA ships the working tree regardless, so they go out either way. Committing them
makes the record match what ships.
