# Backend defect — discovery joins a table that has no rows

Status: **CARVED, NOT FIXED.** Found 2026-08-11 while scoping
`features/collab-part4-offers-allocation` §4.5. Needs founder go before the fix, because
the fix changes what followers see.

## The defect

`campaign_offers` — the set-level offer table — has **zero rows in production**, and no
application code writes it. Its only writer is `POST /campaigns/:id/sets/:sid/offers`,
which no screen calls.

Eight read paths **INNER JOIN** it. An inner join against an empty table returns nothing,
so those queries return nothing — always, in production, today.

## Verified, not inferred

Against production, 2026-08-11:

```
campaign_offers rows                                     0
live collaborations (contracted/active/completed,
  campaign published/active/live, not ended)             1
...of those, surviving the campaign_offers INNER JOIN    0
```

So the one live collaboration in production is invisible to every query built on that join.

## What is affected

**Discovery shelves — the largest surface.** `sectionRules.service` builds a shared
`OFFER_FROM` clause containing `JOIN campaign_offers co ON co.set_id = cs.id AND
co.is_active = true`, and **12 rule queries** use it. Every shelf driven by those rules
evaluates to empty. This is very likely the explanation for discovery surfaces that look
correctly configured but render nothing.

**Follower "active deals" count.** `follower.service` computes
`COUNT(DISTINCT co.id)` behind the same inner join for each creator a follower follows, so
every followed creator shows **0 active deals** regardless of reality. Concretely wrong and
user-visible.

**Also on the same pattern:** saved-items resolution (`saved.controller`), a contract-side
existence check (`contract.controller`), prebook advance lookups
(`transaction.controller`), and post-attached deals (`followerPosts.service`).

## Why this was mis-described in Part 4

`collab-part4-offers-allocation` §4.5 states that retiring this table is "provably inert:
zero rows in production means every LEFT JOIN contributes only NULLs and every COALESCE
already falls through."

That is true for the **8 LEFT JOIN** references. It is **wrong for the 8 INNER JOIN**
references: those are not falling through to NULLs, they are eliminating every row. Removing
them is therefore a **behaviour change**, not a cleanup — content will appear where none
appears today.

Part 4's spec has been corrected. This contract owns the functional half.

## The fix

Remove the dead inner joins so these queries evaluate against real collaborations, and take
each affected read path's offer data from the per-creator source that Part 4 established
(`campaign_influencers.offer_type` / `offer_config_json` / `brand_offer_id`) plus published
global offers via `offerResolution` / `offerDisplay.sql`.

**This is a functional change to the follower app.** Shelves that render nothing today will
start rendering. It needs before/after evidence per query and a founder walkthrough of
discovery, not a silent sweep.

## Deliberately NOT bundled into Part 4

Part 4 is already a large change to the storefront, coupon and checkout paths. Folding a
discovery behaviour change into it would mean a follower-visible change arriving inside a
commit whose stated scope is "retire a dead table", and would make any regression harder to
attribute. Separate contract, separate evidence, separate deploy.

## Sequence

1. Part 4 deploys and is verified (migration 148 + backend).
2. This defect is fixed against a codebase where the per-creator offer path is already live,
   so each removed inner join has a working replacement to fall back on.

Fixing this first would mean fixing discovery to read a source Part 4 is still changing.

## Open

- Founder go, with the understanding that discovery content will change.
- Whether the unused `POST /campaigns/:id/sets/:sid/offers` writer and the table itself are
  dropped in the same pass, or left in place until the read paths are proven.
