# 02 — Workflow
1. InfluencerStoreScreen: fetch getCreatorSections(handle) + state.
2. Render the composed sections (SectionItem) after the hero/collabs; legacy
   picks remain fallback. 3. Verify: metro bundle compiles, mobile jest 20/20.
4. Ship: commit (path) → push → OTA. End state: admin can compose the Creator
   Store via App Builder → Creator Store; it renders on the live screen.
