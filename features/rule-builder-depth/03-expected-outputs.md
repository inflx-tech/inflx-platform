# Expected Outputs — Rule builder depth

| Step | Observable output | How verified |
|---|---|---|
| 1 | 3 new controls render in wizard My-rule builder | Playwright e2e |
| 2 | preview count brand-filtered; saved rule_json.brand present | API + DB re-read |
| 3 | exclude_tags honored in count + round-trip | API |
| 4 | follower items = picked ids in picked ORDER | API deep-equal on id sequence |
| 5 | preview 200 for new keys; 422 for bad shapes (>50 ids, non-array) | API |
| 6 | library page save of legacy rule = byte-identical rule_json | API GET-after-PATCH |
| 7 | pnpm qa 79/79; existing placements' items unchanged | QA report + API compare |

## Data assertions
- validateRule output: brand string trimmed; exclude_tags deduped/lowercased;
  product_ids deduped order-preserving, length ≤ 50.
- product-search endpoint: only approved-brand + pushed_to_store products;
  respects business_type members; limit 20; requires `libraries` capability
  (401/403 unauth).

## Visual evidence
- before: 04-preview/mockups/00-rule-depth.html · after: 06-diff/after/
  (wizard builder with the three controls populated).
