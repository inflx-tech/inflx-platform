# Workflow Prediction — Design Library (Phase 3)

Predicted click-path the mockup demonstrates (confirmed against the real screen in the 06-diff step).

1. Admin lands on `/admin/design-library`, world = Fashion.
2. Header "Design Library — Fashion World" + "Read-only · v1" chip + a one-line: "the visual grammar the renderer obeys."
3. **Layouts** panel — a grid of 10 cards. Each card:
   - a tiny wireframe thumbnail suggesting the layout (hero, tile, story, magazine…),
   - label + aspect badge (16:9 / 1:1 / 9:16 / 4:5 / flex) + kind (banner/card/frame/structure),
   - the **Layout Contract** as slot chips: green = required, grey = optional, struck-through = hidden.
4. **Section Styles** panel — vocabulary chips (carousel / grid / masonry / collage / story-rail / tabs / bento / split / hero / magazine), each with a one-line "how N cards arrange".
5. Read-only: a muted note explains contracts are edited in a later phase; this screen is the reference the renderer (Phase 4) and templates (Phase 5) build on.

Expected empty-state: before seeding, "No layouts seeded yet."

This maps the founder's "10 Popular Section Layout Types" reference onto our data: each tile there = one layout row here, with its contract made explicit.
