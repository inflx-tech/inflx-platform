# Phase 3 — World Rules (per-world engine behaviour)

**Program:** Section-rules admin-control program, Phase 3 (locked 2026-07-05).
**Founder go:** "push the phase 2 and start phase 3" — 2026-07-06 (lock delegated).
**Decision honoured:** per-world only; per-section override deferred to Phase 4 (D2).

## Problem

Location behaviour was one hardcoded policy for all five worlds: `cityBoost`
soft-sort + `dist_km` ordering, no radius, no switch. "Food is deliverable-only,
fashion is discoverable-everywhere" was inexpressible — a Hyderabad follower saw
a Vijayawada restaurant with an Order CTA (undeliverable). The trending window
default was likewise not settable per world.

## Scope

**Mig 126 — `world_rule_settings`** (ships EMPTY; absent row = legacy rank_only):
world_key PK · location_mode boundary|rank_only|off · radius_km ·
empty_fallback widen|show_nearest|show_empty · window_days_default ·
item_limit_default (reserved). Prod runner `scripts/run-126.js`.

**Engine seam** (`sectionEngine`): `getWorldRules(worldKey)` (ttlCache, "no
row" cached as false); `ctx.worldRules`; freshness = section `window_days` >
world default > 7; world-rules state added to the rule cache key (one-TTL
convergence); engine-level empty-fallback — a boundary shelf resolving empty
retries once per fallback (widen = 2× radius; show_nearest = unbounded;
show_empty = honest empty), cached under `key:fb`.

**Rule enforcement** (`sectionRules`): `locationMode(ctx)` + `boundaryClause()`
applied in the 4 DISCOVERY listing rules — products_in_category,
library_products, businesses_in_category, restaurants_with_featured.
Boundary semantics: coords + radius → haversine ≤ radius (rows without
coords excluded); no coords but city → hard city match; neither → rank-only
degrade. **Never applied on curation surfaces** (ctx.brandId / ctx.influencer
— a share link from another city always opens the full page). Mode `off`
suppresses distance ranking AND city boost.

**Admin**: GET/PUT/DELETE `/v1/admin/world-rules(/:world_key)`
(requireCapability('sections'); validation; instance cache bust) + World
Settings screen (`/admin/world-rules`, nav under Content) — per world: mode,
radius, fallback, trending default; Reset-to-default deletes the row.

## Explicit limitation (documented)

Offer/creator rules are NOT boundary-gated in this phase — deals shelves keep
rank-only everywhere (offers are marketing; ordering happens via pages whose
listing shelves ARE gated). Candidate for a later phase if food's deals shelf
proves confusing.

## 3c (founder action after deploy — not code)

Open World Settings → food → Boundary + delivery radius → Save.
