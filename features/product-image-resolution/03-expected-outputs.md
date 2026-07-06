# Expected outputs — product image resolution

- NEW `backend/tests/productImage.test.js` — 8/8 GREEN (fallback order,
  jsonb-as-string, malformed tolerance, object-shaped entries, null cases).
- Follower read paths unchanged for image-set products; section-engine suite =
  the same 3 ledgered pre-existing failures only (no new).
- `pnpm qa` GREEN gate 0.
- Backfill dry-run runs clean against prod (read-only): reports fixable vs
  image-less. Prod today = 72 empty / 0 fixable (all photo-less seeds) — the
  fix is preventive + covers staging/new uploads; no prod row to repair now.
- node --check on all edited backend files.
