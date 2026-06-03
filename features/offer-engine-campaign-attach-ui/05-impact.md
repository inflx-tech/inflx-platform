# Impact Analysis — offer-engine-campaign-attach-ui (Sub-contract C, UI)

## Verdict (terse)
**Additive UI on the campaign wizard — inline authoring byte-unchanged.** A
saved-offer `<select>` that only appears when the brand has active offers; picking
one swaps the inline builder for a summary and sends `brand_offer_id`. No backend
change; the existing offer-authoring path is untouched.

## Mechanics
- **Picker is conditional** (`libOffers.length > 0`). Brands with no saved offers
  see the wizard exactly as before — zero visual/behavioural change.
- **Coexist, not replace.** Default selection is "Author inline below" → the
  existing offer-type chips + `renderOfferConfig` render unchanged. Only when a
  brand actively picks a saved offer does the inline builder hide.
- **Validation satisfied without new logic.** Picking a saved offer mirrors its
  type into the existing `offer_type` field, so the wizard's current
  offer-required validation passes untouched.
- **Server-authoritative config.** When `brand_offer_id` is sent, the payload
  omits `offer_config_json`; C-backend snapshots from the library row. No risk of
  stale inline state leaking into the attachment.
- **Draft hydration** maps `ci.brand_offer_id` so editing a draft preserves the
  link (no silent unlink on re-save).
- **Scope limited to handpick conversion/hybrid.** Engagement offer UI + open-group
  group offers are out (engagement deferred to D for the follower path).

## Blast radius if it failed
Confined to the per-influencer offer step of the campaign wizard. A bug only
manifests when a brand selects a saved offer; the inline path (the only path that
exists today) is unchanged. Build verified green.

## Regression guard
`next build` GREEN; the diff is additive (new state + a conditional block +
one optional payload field + a hydration line). Inline authoring unchanged.
C-backend tests already prove the receiving end.

## Deploy posture
PRODUCTION-IMPACTING (brand-web → Vercel) but additive. No backend/OTA. Surfaced
for explicit go.
