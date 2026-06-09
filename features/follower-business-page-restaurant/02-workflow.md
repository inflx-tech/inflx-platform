# Workflow — Business Page (restaurant) focused pass

## Flow
1. Follower opens a restaurant (from creator store / category / search) → RestaurantDetailScreen
   with the loaded store { brand, products, influencers, creator, creator_picks }.
2. Header renders, then NEW: action bar (Follow toggle + Directions→maps), then NEW:
   "{Business} × Creators" circle row (store.influencers → InfluencerStore) + trust line.
3. Existing hero, creator-picks strip, sub-tabs, menu, and schema-driven sticky CTA unchanged.

## Expected end state
Restaurant Business Page matches business-comprehensive.html (restaurant variant) incl. the
creators row + trust line; checkout untouched.

## Verification
- Babel transform clean. Founder verifies visuals on device after OTA.
