# Impact — offer-builder-ux

**Verdict: builder UX only — zero backend/payload change.**

- Single file: `Packages/brand-web/components/OfferBuilder.js`.
- Reorders Discount/Volume (applies-to first); gates the value toggle by scope
  (store/category coerce sub_type='pct' in the existing shape); swaps flat
  `<select>` pickers for a searchable finder; searchable category list; CTA hint.
- buildOfferConfig / draftFromOffer / previewLine payload shape unchanged —
  offerConfig.validator and the follower app read the same JSON.
- Coercion note: switching scope to store/category sets sub_type='pct' so a
  previously-typed flat value can't produce a meaningless store-wide ₹ off.
- Production-impacting: Vercel (brand-web) on push. No OTA, no backend.
- Rollback: revert one commit.
