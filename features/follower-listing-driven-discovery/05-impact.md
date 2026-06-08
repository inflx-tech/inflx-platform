# Impact — Listing-driven discovery

## Terse verdict
**Architecture correction, backend only.** Discovery (Category screen) becomes
listing-driven: approved businesses + their products + creators-who-picked show by category
**with no offer**. Offers stay as the "Best deals" overlay. This is the "what you list is
what you see" foundation — applies to every vertical, not just restaurant. No schema change,
no app change.

## Mechanics / blast radius
- 3 additive rules (offer-independent SELECTs over brands/brand_products/influencer_product_notes,
  filtered by category + users.status='approved'). Existing offer rules untouched.
- Migration 088 = UPDATE on `section_config` data (re-points 4 Category shelves). Reversible
  by pointing the rules back. `runRule` returns [] for any unknown key → never 500s.
- Smart-fallback (`hasEngineContent`) means if a shelf is empty the old screen stands.

## Risk / rollback
- The Category screen now shows approved listings broadly (all categories with listings).
  That's the intent. Low risk: read-only rules, no writes, no money path, no attribution
  change (listing items carry `tracking:null` — they become attributable only when reached
  via a creator's offer link).
- Rollback: revert 088 (re-point shelves) + revert the code commit.

## Follow-ups (separate, noted)
- Home-screen listing shelves (so Home shows businesses, not just tiles).
- The offer-source mismatch (campaign_offers empty even when an offer is configured at set level).
- 4-ID attribution still flows via the creator-offer path (unchanged).
