# Before / after — pass 3, disconnecting the server

## Screenshots

**Not applicable.** This pass has no user interface. It removes server code that nothing
calls; the screens for all of it were removed in pass 1.

## What was implemented

| | Before | After |
|---|---|---|
| Route files | 47 | **40** |
| `/v1/agencies/*` | answered | **404** |
| `/v1/referrals/*` | answered | **404** |
| `/v1/meals/*` and `/v1/admin/meals/*` | answered | **404** |
| The pre-agreement handshake endpoints | answered | gone |
| Creator lookbooks | answered | gone |
| Brand enquiry inbox endpoints | answered | gone |

## Verified

- **The whole server loads.** `require('./src/app.js')` resolves every route, controller
  and service. Fourteen deleted files, nothing left referencing them.
- **Confirmed in production after deploy:** `/v1/agencies/me`, `/v1/meals/settings` and
  `/v1/referrals/settings` all return **404** where they previously answered.
- 729 mobile tests pass.

## Two honest notes on the verification

**A mid-rollout false alarm.** The first probe showed `/v1/agencies/me` still answering
while `/v1/meals/settings` had already gone — Render was part-way through the rollout. It
was re-probed rather than treated as a failed removal.

**Two endpoints cannot be proved gone from outside.** `/v1/brands/me/collab-requests` and
`/v1/follower/enquiry` still return 401 — but so does `/v1/brands/me/this-never-existed`.
Those prefixes authenticate at the router level, before route matching, so a 401 there
says nothing about whether the route exists. The real evidence is the source and the app
loading. Recorded rather than glossed as a clean sweep.

## What to check — the device walk

Light. Open each of the three apps once and confirm they work. The removed features have
no screens left to visit.

## Known, and not fixed here

Every table these controllers wrote to still exists, with its data intact. That is
**pass 4** — exported first, then dropped.
