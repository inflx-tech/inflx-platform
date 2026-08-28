# Impact

**Verdict: one rule relaxed, one duplicate control deleted, one stale warning silenced.**

| Target | What lands | Risk |
|---|---|---|
| Migration | none | **Nil** |
| Render (`backend/src`) | one blocker becomes a warning | **Low** |
| Vercel | nothing | **Nil** |
| OTA (brand app) | the wizard and the review screen | **Low** |

## What changes for something already live

**Campaigns become publishable that were not.** A selling set where nobody has a shopper offer
now publishes with a warning instead of a refusal. That is the founder's decision, stated twice.

Nothing already published changes. No stored row is reinterpreted, no offer created or removed.

## Where it could bite

**Relaxing one rule too many.** The gate holds five refusals and only one should move. G-4 walks
the other four and asserts each is still pushed into `blockers`; a mutation that demotes
`NO_ALLOCATION` alongside it is caught.

**Silencing too much of the server.** Only two codes are dropped, and only until publish. If the
whole server list had been suppressed, a real refusal — an unfunded wallet, a creator already
invited against a dead agreement — would have gone quiet.

## Rollback

OTA to the previous bundle and revert `backend/src`. A campaign published without an offer stays
published; nothing about it depended on this change.

## Test-suite position

Mobile jest for the screens; the backend rule is asserted by reading the service from the
phone's checks, because the backend suite still cannot run. Certified **no-regression**.
**Never claimed green.**
