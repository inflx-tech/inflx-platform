# Diff notes — Food dictionary expansion

Backend-only data migration; no UI surface. Notes present to satisfy gov-check
Rule 4 if this push bundles with any parallel UI commit (meals-schema precedent).

Applied to prod 2026-06-21: `master_dishes` 129 → 360, 0 duplicates, idempotent.
13 cuisines: North Indian (54), South Indian (44), Chinese (38), Desserts (34),
Fast Food (29), Italian (28), Andhra (26), Beverages (23), Continental (22),
Hyderabadi (18), Biryani (17), Bowls & Meals (14), Eggs & Breakfast (13).
Source: backend/seeds/food_dictionary.draft.csv (locked). Validated on a clean
129 baseline (run twice = 360, 0 exact + 0 near dupes).
