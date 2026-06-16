# 02 — Workflow: Category screen rebuild

1. Follower taps a category tile on Home → `CategoryListScreen` for that vertical.
2. Screen renders: appbar (back · title · search) → sub-category circles (from the
   listing tree, via the section engine) → admin-placed section shelves
   (creators / stores / products / on-sale), each with "View all" → Results.
3. Sub-category circles: cream fill, gold ring + gold label when active; tapping one
   filters the shelves client-side.

No backend/API/migration change — visual refinement of a shared component only.
