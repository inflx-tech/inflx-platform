# Impact

**One line: creators can finally set the photo the rules already insisted on, and brands can
see which audience actually buys.**

## Deploy class

**production-impacting** — both phone apps via OTA, `backend/src`, **and a migration that
drops a column**.

## The destructive part, stated plainly

Migration 157 runs `ALTER TABLE influencers DROP COLUMN avatar_url`.

* The column is **one day old** (migration 156, mine).
* It is **provably empty** — checked on production: 22 influencers, 0 populated.
* Nothing reads it after this change.

Dropping it is still a one-way action on a live database and needs an explicit go. The
alternative — leaving a dead lookalike column beside the real one — is how a future screen
ends up reading the empty one forever.

## Blast radius

| Area | Effect |
|---|---|
| Creator — My Profile | Avatar tile becomes tappable. |
| Brand — creator profile | Three reach tiles above the stats; real photo in the hero. |
| Brand — search + Talking lists | Now read the consolidated photo field. |
| `GET /influencers/:id` | Gains a live INFLX following count; photo resolved from her key. |
| `GET /influencers/search` | Photo field renamed to the consolidated one. |
| `PATCH /influencers/me` | Accepts her photo key. Previously a whitelist that would have silently discarded it. |
| Scraped Instagram pictures | Still never shown. Explicitly stripped from search responses. |

## What could go wrong on the handset

1. Photo uploads but does not appear → the key was not saved.
2. Old photo persists after replacing → cache; the timestamped key exists to prevent this.
3. A brand sees a scraped picture anywhere. Must never happen.
4. INFLX tile reading "—" instead of a real count.

## Reversibility

Apps roll back by OTA. The dropped column can be recreated empty in seconds, which is
exactly what it is today.
