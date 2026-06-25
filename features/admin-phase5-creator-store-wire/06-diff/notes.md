# 06 — Before/After · Creator Store wired to the engine
Before: InfluencerStoreScreen used only the legacy resolveStore (offers
flattening); getCreatorSections had NO mobile consumer — the creator_store
section scope was unreachable in the app.

After: the screen fetches getCreatorSections(handle) and renders the
admin-composed creator stack (SectionItem) after the profile hero; legacy
picks/collabs remain as fallback when nothing is composed. The Creator Store is
now a real section-engine consumer — "one engine, three scopes" complete.

Verify: metro bundle compiles; mobile jest 20/20. Mobile OTA, no backend/migration.
