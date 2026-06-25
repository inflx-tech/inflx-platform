# 02 — Workflow
1. Build sectionRules.creatorsSmart using the Phase-1 ctx (scope/vertical/brandId/
   lat-lng/followedIds) + existing helpers (haversineKm, categoryFilter,
   mapCreatorItem). Sources: influencer_product_notes (picks) + campaign_influencers
   (collabs). 2. Register RULES.creators_smart. 3. Admin preset 'Creator carousel (smart)'.
4. Verify: runRule executes on DB (world + business scope), pnpm qa GREEN, brand-web build.
5. Ship: commit (paths) → push (Render + Vercel). End state: a placeable smart creator
   section that re-filters by where it sits.
