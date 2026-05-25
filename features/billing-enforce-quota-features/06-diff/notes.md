# 06-diff — billing-enforce-quota-features (A12.1)

**Before:** the quotaCheck middleware (Phase A4) read `subscription_tiers.max_campaigns`, `max_products`, `max_sets_per_campaign`, and `max_influencers_per_cycle` — the 4 legacy columns seeded by M058 with default values (1/3/10/-1 across the tiers). Admin's new tier editor (A10) writes to `tier_features.quota_value` instead. The two stores never talked. Founder caught it concretely: editing Free's "Active campaigns" quota to 2 in Section C had no effect on whether the gate fired.

**After:** the middleware calls `entitlementsService.quotaFor(brandId, feature_key)` for each action. That function reads `tier_features` joined with the features catalog. Admin's Section C edits drive runtime enforcement. The legacy columns remain in the schema (still rendered on the brand's current-plan card as informational) but are no longer the source of truth at the gate.

**Code change shape:**
- ACTIONS registry: each action maps to a `feature_key` (was `limitField` pointing at a column name).
- `_ensureSubscription` no longer loads max_* columns into memory; just returns identity + cycle dates.
- New `_findUpgradeTiers` helper queries `subscription_tiers + tier_features + features` for tiers offering more on the same feature — keeps "Upgrade to" suggestions consistent with admin's actual configuration.
- QUOTA_EXCEEDED payload adds `feature_key` alongside the existing `action` (additive; existing clients ignore unknown fields).

**Migration M062:** small UPDATE flipping `is_enforced=true` on the 4 quota features. The admin features catalog page (`/admin/pricing/features`) shows a per-feature enforcement badge; before M062 these 4 read "no" even though their gates were live. After M062 they read "yes" — matches reality.

**Test update:** `quotaCheck.test.js` `beforeEach` extended to re-seed `tier_features` rows matching the legacy values after the subscription_tiers DELETE+INSERT (which cascade-deletes tier_features). Without this, assertions like "free tier limit=10 products" would fall through to the catalog default (which happens to also be 10 for products_in_store, so it would have coincidentally passed for some — but failed deterministically for upgrade_to since other tiers' rows would be missing). Re-seeding tier_features in tests guarantees the new code path is exercised correctly.

**What this fix means for the founder's "Aveen food paradise" scenario:** after A12.1 deploys + M062 runs on prod, when the brand creates a 3rd campaign with admin-set limit=2, the popup fires immediately with the correct numbers (used:2, limit:2, current_tier:free, upgrade_to:[growth, pro, enterprise — assuming admin's set higher quotas on those]).

**Backward compatibility:**
- The legacy max_* columns are not dropped (other display surfaces still read them).
- The QUOTA_EXCEEDED envelope shape is additive (existing clients ignoring `feature_key` keep working).
- The 4 already-enforced gates retain the same routes, same auth, same status code.

**Verified locally:**
- Backend boots clean (`node -e require('./src/app')` returns "app loaded OK").
- M062 applied to local dev DB; sanity probe shows all 4 features is_enforced=true.
- pnpm qa main lane unchanged (no spec depends on the migrated middleware behaviour beyond what the updated test stub covers).
