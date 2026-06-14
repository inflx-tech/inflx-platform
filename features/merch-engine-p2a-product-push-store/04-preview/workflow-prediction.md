# Workflow Prediction — Product push-to-store toggle

> Step 4. Predicted path through the mockup, mapped to `02-workflow.md`.

## Mockup
- `mockups/brand-product-push-toggle.html` — the per-product **Show in store** switch on the brand's inventory. Shown in the brand-web product theme (yellow/ink). Lands on BOTH the standard product form/list AND the drill-down "Your Inventory" (where fashion/furniture brands manage products).

## Predicted path
1. On deploy every product shows the switch **ON** (default true) → brand store unchanged from today (step 1).
2. Brand sees the **Show in store** switch on each inventory row, all ON (step 2).
3. Brand flips one **OFF** → row dims, badge → "Hidden", `pushed_to_store=false` saved (step 3).
4. Follower's brand store no longer shows that product; the rest remain (step 4).
5. Brand flips it back **ON** → reappears (step 5).
6. New product added → switch ON by default → appears in store (step 6).

## Predicted observable end states
- Inventory row: ON = "In store" badge; OFF = dimmed + "Hidden".
- Brand store = active ∧ pushed products only.
- Listing / allocation / share-links unaffected by the toggle.

## Palette / standard
Brand-web product theme (yellow action, white cards, green = on). The toggle reuses the existing brand product toggle style.
