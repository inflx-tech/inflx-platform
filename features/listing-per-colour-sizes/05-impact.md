# 05 — Impact

**Verdict: additive UI change in one file — no data migration, no backend, no
effect on existing products until a brand re-saves one.**

## Blast radius

| Surface | Impact |
|---|---|
| `Packages/brand-web` listing stepper | Changed — Step ② colour cards, payload build, edit load |
| `backend/src/**` | **None.** `buildVariants` already consumes per-colour `sizes` |
| `backend/migrations/**` | **None** |
| `Packages/Mobile` | **None.** No product-add screen exists in the RN brand app |
| Excel import | **None.** Already row-per-colour-per-size |
| Follower app | **None** at code level. Products saved after this ship will simply stop advertising unstocked colour+size pairs |

## Existing data

Products already saved carry uniform sizes across colours — that is what the old
UI produced. This change does **not** rewrite them and does not need to: the
stored shape is already legal and renders fine.

The only consequence is editorial: to make an existing product accurate, the
brand reopens it and unticks the sizes a colour does not stock. No forced
migration, no breakage if they never do.

## Risk

| Risk | Mitigation |
|---|---|
| `facets[stockKey]` drifts out of vocabulary → 422 on every save | Per-colour lists are always a subset of the master list, and the union of subsets is a subset. Filtered through the master on read |
| Union becomes empty → required-size validation fails | Step-② gate blocks before that state can be saved |
| Shrinking the top row leaves orphaned per-colour entries | `sizesFor()` filters through the master list on every read, so orphans are invisible and are dropped on the next save |
| Shopper filters a size no colour stocks | Fixed by this change — storing the union instead of the master is strictly more accurate than today |
| Free-size leaves regress | Whole block is already gated on `selectedVariants.length > 0`, which is empty for those leaves |

## Deploy classification

**Production-impacting.** `Packages/brand-web` is runtime — `git push` triggers a
Vercel deploy. Not an OTA. Explicit founder go required before push.

`released` stays `false`: the standing rule is one combined brand + follower
end-to-end pass at the end of the walkthrough, not per slice.
