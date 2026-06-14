# Expected Outputs — Platform-page product gate

> Step 3 (cont.). Backend-only.

## Per-step expected outputs
| Step | Observable output | How QA verifies |
|---|---|---|
| 1 | `products_in_category` = pushed active products | section feed; SQL has `AND bp.pushed_to_store = true` |
| 2 | `businesses_in_category` brand EXISTS gated to pushed | SQL EXISTS includes `pushed_to_store = true` |
| 3 | un-pushed product absent from product shelf | feed lacks it after PATCH |
| 4 | brand with no pushed products absent from business shelf | feed lacks the brand |

## Data assertions
- Both product/business shelves filter `pushed_to_store = true`.
- **Parity:** all products pushed today → shelf output identical to pre-change.
- Offer/deal shelves unchanged (already gated by campaign-allocation / published_to_store).
- No schema / money / attribution change.

## Visual evidence required
- network: `/follower/home` + `/follower/section/category/:key` product shelves reflecting the pushed filter (no behaviour change at parity).
- (No UI mockup — backend-only.)
