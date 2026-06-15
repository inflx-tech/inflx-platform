# Impact — Categories: one brain (Phase 2.5a)

**Terse verdict:** Backend + data consolidation. Removes 4 of the 5 category sources,
merges the fashion split (already alias-covered), and re-points every backend filter at
the admin table. Same API shapes, same screens — only *where the filter reads from*
changes. Parity-safe by design; the only intended visible change is that categories now
behave **consistently and correctly** across screens.

## Blast radius
- **Backend filtering only.** No endpoint contract changes; no web runtime files; no
  mobile files → **no OTA, no Vercel runtime redeploy**. Render backend redeploys.
- **Data migration** touches `brands.category` (fashion merge) and `follower_categories`
  (5 tiles + hide rest) and `section_config.category_key` (2 rows). All reversible
  (hidden, not deleted; alias keeps old values working).

## What could break + mitigation
- *A screen still reading an old map* → that's the whole point: all readers repointed;
  the acceptance test (#10) proves every surface moves together.
- *Straggler `fashion_walkin` brand* → `normalizeBusinessType` alias maps to `fashion`;
  schema resolution already aliases. No orphan.
- *DB/table read fails at runtime* → minimal hardcoded fallback (the 5 tiles) keeps feeds
  alive; never empty, never a divergent source.
- *Brands outside the 5 tiles* (florist, grocery) → intentionally absent from category
  browse; they remain reachable via direct links / home (unchanged). Documented, not silent.
- *DB-lane (`pnpm qa:db`) failure count* → watch for a rise; classify against the known
  tier-cascade baseline (informational lane, not the gate).

## Reversibility
- Re-show old tiles: `UPDATE follower_categories SET status='active'` for the 7 keys.
- Fashion merge: alias remains, so even a partial rollback keeps both values resolving.
- Code: standard git revert; backend-only, no data shape lost.

## Deploy classification
**Production-impacting** (backend/src + migration) → **explicit founder go required**,
migrate-prod-first then push. Not silent.
