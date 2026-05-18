# Backend Audit — sibling `city`-column defect class

> Status: **DRAFT** (Steps 1–6). Implementation GATED on
> `lock.json.approved = true`. Proactive follow-up to the
> shipped fix `backend-defect-city-column` (HEAD 39219e4,
> `listing.service.js:201`).
>
> ⚠️ **Deploy posture is CONDITIONAL.** This is a defensive
> classification audit. If it finds NO genuine defect it is
> **deploy-inert** (only the dispositioned inventory + qa:db
> evidence log — no runtime code change). If Step 7 proves a
> genuine latent 500, a **minimal column-resolution fix** edits
> backend runtime SQL → on Step-14 release `git push` makes
> **Render auto-deploy the backend**. Same posture rule as the
> precedent: any real fix is a conscious Step-14 decision.

## Problem / goal
The shipped fix proved a real defect *class*, not a one-off:
backend SQL selecting/filtering `city` against a relation or
alias that does not expose it → `column "city" does not exist`
→ HTTP 500 in production. `listing.service.js:201`
(`SELECT … city … FROM brands`, but `brands` has no `city`; it
lives on `users`) was the instance that surfaced. The carved
contract listed sibling *candidates* as unverified hypotheses.

Goal: **systematically classify every `city`-referencing query
in backend runtime code** and prove the defect class is fully
closed — or carve/fix any remaining genuine latent 500. The
deliverable is a complete dispositioned inventory backed by real
qa:db evidence, not a presumption that more defects exist.

Roles affected: any (the bug class spans brand / influencer /
follower / admin read paths).

## Scope
- **In scope:**
  - Static inventory of all runtime SQL referencing `city`
    (`backend/src/**`, excluding tests/migrations/mocks/helpers
    with no SQL such as `location.service.js` CITY_COORDS).
  - For each site: verify-twice the FROM/JOIN and confirm the
    targeted table/alias/view actually exposes a `city` column,
    using the authoritative schema (53 migrations).
  - Dynamic confirmation at Step 7 against the real qa:db
    Postgres for every site reachable by the backend jest suite.
  - If a genuine latent 500 is found: a **minimal
    column-resolution fix** (alias/qualifier/JOIN) identical in
    spirit to `listing.service.js:201` — behaviour-preserving,
    no refactor. If a site needs a behaviour change, **carve**
    it as its own `backend-defect-*` finding (do not fix here).
- **Explicitly out of scope:**
  - Any behaviour/logic change, refactor, or query rewrite
    beyond making `city` resolvable.
  - Non-`city` column-resolution bugs noticed in passing →
    carve separately, do not fix here.
  - Silent-`undefined` JS field reads (e.g. `obj.city` on a row
    whose query didn't select `city`) — these are
    data-correctness, not 500s; **note** them in the inventory
    but they are not the crash class this contract closes.
  - Frontend / mobile / migrations.

## Surfaces touched
- App(s): **backend** only.
- Roles involved: read paths across all roles; no auth change.

## Data / contracts
- New or changed tables / columns / migrations: **none**
  (columns already exist; the class is SQL referencing them in
  an unresolvable context).
- New or changed API endpoints: **none** (no contract change;
  endpoints that 500 today must instead return their existing
  documented success/​error shape).
- Money/units, attribution IDs, status machines: **unaffected**.

## Confirmed schema facts (verify-twice, this session)
Tables/views that **DO** expose `city`:
- `users.city` — `001_initial_schema.sql:96`
- `follower_addresses.city` — `001_initial_schema.sql:382`
- `influencers.city` — `003_seed_influencers.sql:11`
- `followers.city` — `011_follower_app_redesign.sql:26`
- `creator_profiles.city` (+ `inferred_city`) —
  `024_creator_profiles.sql:71`, `043_marketing_columns_extra.sql:55`
- `brand_profiles.city` (+ `inferred_city`) — `040_brand_profiles.sql:61`
- view `v_searchable_creators.city` —
  `045_profile_pic_r2_cache.sql:45` (projects `cp.city`/`i.city`)

Tables that **DO NOT** have `city` (the trap):
- `brands` — `001_initial_schema.sql:127-144` (no `city`; brand
  city lives on `users`, set via `UPDATE users SET city` in
  brand/influencer/follower registration). **This is the root
  of the class.**

## Preliminary site inventory & disposition (to be PROVEN at Step 7)
These are *preliminary static reads*, NOT conclusions. Step 7
re-confirms each against the real qa:db Postgres; any site that
cannot be proven safe is treated as a finding, not assumed safe.

- `listing.service.js:201` — **FIXED** (precedent, reference-correct
  pattern `FROM brands b JOIN users u ON u.id=b.user_id`).
- `creatorAnalytics.controller.js:41/77/96/98/100` — FROM
  `v_searchable_creators` which projects `city` → *preliminary
  SAFE* (overturns the carved hypothesis; confirm via view at S7).
- `brandInbox.controller.js:210` — `inf` = `JOIN influencers inf`
  → `influencers.city` exists → *preliminary SAFE* (overturns
  the carved hypothesis).
- `campaign.controller.js:141-142` (`i.city`/`u.city`),
  `:1498/:1516` (`i.city`) — aliases to `influencers`/`users`
  → *preliminary SAFE* pending alias/JOIN confirm at S7.
- `admin.controller.js:535/546/559` (INSERT … `city` …
  `EXCLUDED.city`), `:857/:893` (`u.city`) — *preliminary SAFE*
  pending target-table / `u`-join confirm.
- `proposal.service.js:31/46/159/182/204/220` — joins **both**
  brand-user and influencer-user; alias-mixup is exactly the
  bug class → **MEDIUM, prove at S7**.
- `follower.controller.js:36/749/967/1010` — `:1010 b.city`
  fallback where `b` may be `brands`-shaped → **MEDIUM/HIGH,
  prove at S7** (SQL vs JS-field distinction matters).
- `follower.service.js` (`u_b.city` ×6), `saved.controller.js:64`,
  `lookbooks.controller.js:119`, `proposal.controller.js:68`,
  `production.service.js:99`, `influencer.controller.js:434/512`,
  `marketingAdmin.controller.js` (`creator_profiles`/
  `brand_profiles`) — *preliminary SAFE* pending JOIN/table
  confirm at S7.

## Non-functional
- Auth/role gates: unchanged.
- Failure modes the audit must handle:
  - A site not exercised by any qa:db test → cannot be
    dynamically proven; classify by **static schema resolution**
    (read FROM/JOIN, confirm column exists). State this
    limitation explicitly; if it cannot be statically proven
    safe, carve it as a finding rather than assert safe
    (uncertainty → fail, never fake-green).
  - More than one genuine latent 500 → fix the
    column-resolution-only ones minimally; carve any needing a
    behaviour change.
