# Impact — category-browser-counts-search

**Verdict: additive polish; no behavior change to existing flows.**

- Backend: getNodeChildren gains a per-child subtree count (recursive CTE per
  child; catalogs small → fine). No other endpoint affected.
- Mobile: rail shows counts; header search opens Find. Removed a dead share
  button.
- Production-impacting: Render (backend) + mobile OTA.
- Rollback: revert one commit.
