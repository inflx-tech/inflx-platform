# 01 — Spec · App Builder Phase 5 (wire Creator Store to the engine)
Final phase. InfluencerStoreScreen renders the admin-composed creator_store
section stack (followerApi.getCreatorSections), making the Creator Store a
section stack scoped to the creator — "same engine, three scopes." Hybrid:
profile hero spine kept; composed sections render after it; legacy picks/collabs
remain the fallback when uncomposed (no regression). Mobile OTA only; backend
endpoint already exists.
