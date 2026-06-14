# Expected Outputs — Product Tags + admin tag-vocabulary

> Step 3 (cont.). What the QA report asserts against. "Compiles" is NOT an output.

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| 1 | 3 vocab rows (Summer/Festive/Casual, scope fashion_walkin, active) | API: `GET /admin/tag-vocabulary?scope=fashion_walkin` returns 3; DB row assertion |
| 2 | 1 vocab row (Trending, scope ALL) appears in fashion options | `GET /brands/me/tag-options` (fashion brand) includes Trending |
| 3 | product saved with `tags = {summer, casual, beachwear}` | API response + DB `SELECT tags`; `beachwear` flagged free |
| 4 | product `tags = {summer, festive, beachwear}` after edit | DB `SELECT tags` post-PATCH |
| 5 | hiding "Casual" removes it from options; product still has prior `casual` if present | `GET /tag-options` lacks Casual; DB tags unchanged on a previously-tagged product |

## Data assertions (post-workflow)
- `tag_vocabulary`: `(scope, slug)` unique; statuses correct; `ALL`-scope visible to every business.
- `brand_products.tags`: array contents exactly match final selection; slugs normalized; free vs fixed distinguishable (fixed = matches active vocab slug for scope/ALL).
- No money / commission / attribution fields touched (assert unchanged).

## Visual evidence required
- before/after screenshots: admin Tag Vocabulary screen (empty → 4 tags); brand listing wizard tag step (options shown, selections + free tag).
- network: `POST /admin/tag-vocabulary`, `GET /brands/me/tag-options`, `POST|PATCH /brands/me/products` succeed with expected payloads.
