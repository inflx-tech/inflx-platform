# Impact Analysis — Creator store auto-fills from live allocation

> Step 6. Backend-only.

## Affected files (read or change)
- **backend:** `services/follower.service.js` — **CHANGED**. New `allocatedProductIds(ciCfg, setProductsJson)` helper; applied to **both** creator-store resolvers:
  - `resolveStore()` (follower-facing `/store/:handle`) — `products[]` now from allocation, not notes-gated `publishedIds`.
  - `getInfluencerStorePreview()` (creator previews own store) — same allocation source; **removed its full-brand-catalogue ELSE fallback that leaked every product** when no notes existed.
  - `noteMap` retained in both → `influencer_note` / `has_note` annotation only.
- No migration, no controller/route change, **no mobile/web change** (response shape `offers[].products[]` unchanged).

## Affected routes / APIs
| Method | Path | Change |
|---|---|---|
| GET | /store/:influencer_handle (resolveStore) | `products[]` now from allocation, not hand-picked notes |

## Affected workflows (regression surface)
- Creator-store rendering (`resolveStore`). **Intended behaviour change:** creators' stores now show their live-allocated products automatically (previously hidden behind the hand-pick gate). Mobile `InfluencerStoreScreen` renders `offers[].products[]` as before — no client change.
- DB-lane `follower-store.test.js` does not directly verify this (it 500s at campaign-create setup — pre-existing tier-cascade); covered by node-syntax + the web gate + manual prod check.
- No change to money / attribution / brand store / platform pages.

## Migration / deploy / OTA impact
- **None new.** Backend `src` only → `git push` (Render). No migration, no mobile/OTA.

## Risk notes
- Low-moderate: changes *what creator stores show* (auto-allocation vs hand-pick). Low live-data volume (few live campaigns). Graceful on malformed config (empty products, no crash). Only `is_active` products shown. Notes preserved as annotations. Reversible (revert the one file).
