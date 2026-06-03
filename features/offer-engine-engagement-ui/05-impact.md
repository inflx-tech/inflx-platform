# Impact Analysis — offer-engine-engagement-ui (D3a)

## Verdict (terse)
**Additive UI — conversion/hybrid unchanged.** Widens the wizard's existing
offer-section gate to also show for engagement (optional, promotional) and sends
the offer for engagement in the invite payload. No backend change.

## Mechanics
- **Gate widened, not rewritten.** `needsOffer(goal) || goal === 'engagement'`
  reveals the existing offer section (saved-offer picker + inline) for engagement;
  conversion/hybrid render identically to before. Copy is goal-conditional.
- **Offer is optional for engagement.** No validation requires it (needsOffer
  stays false for engagement) → pure-engagement campaigns are unchanged when no
  offer is picked.
- **No commission/coupon for engagement.** Those fields live in a separate
  needsCoupon-gated section (untouched); the engagement offer payload sends
  commission/coupon as null. C-backend derives `allocation='promotional'` and
  defensively rejects commission/coupon — belt and suspenders.
- **Payload change is conditional + additive.** `offer_type`/`brand_offer_id`/
  `offer_config_json` now sent for engagement too; for conversion/hybrid the
  expression evaluates exactly as before.
- **No backend, no migration, no OTA.**

## Blast radius if it failed
Confined to the engagement path of the wizard's offer step. Conversion/hybrid
campaigns (the only ones with offers before) are unaffected. Build verified green.

## Regression guard
`next build` GREEN; conversion/hybrid offer flow byte-unchanged (gate + payload
are additive-conditional). C-backend tests prove the engagement attach server-side.

## Deploy posture
PRODUCTION-IMPACTING (brand-web → Vercel) but additive. No backend/OTA. Surfaced
for explicit go.
