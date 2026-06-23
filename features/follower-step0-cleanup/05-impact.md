# 05 — Impact · Follower Step 0

Verdict: **deletions + bugfix, zero new functional surface.** Removes only
unreachable screens (verified no callers) + a broken route; the one user-visible
change is the veg mark on unmarked dishes turning neutral grey instead of false
red. Mobile-only OTA. No backend, no migration, no schema change.

Risk: low. Bundle compiles post-deletion; 20/20 jest pass; the deleted
RestaurantCart test removes a pre-existing baseline failure (no green faked).
