# Before/after — listing-add-intent-nav

## Before
Store page "Add {item}" (tab strip / empty-state / folder-browse buttons, all
via `gotoProductWizard()`) opened `/dashboard/products/listing` bare → page
defaulted to **My listings** — the brand had to click "Add products" again.

## After
Same buttons open `/dashboard/products/listing?tab=add` → page lands directly
on the **Add products** drill grid. Listings nav (bare URL) still lands on
My listings; `?edit` / `?tab=offers` unchanged. No visual change to any
screen — only the active tab on arrival.

## Capture
Mockup `04-preview/mockups/add-intent.html` shows the arrival state. After
verification = founder's next walkthrough (click Add item → drill grid).
next build ✓ compiled; pnpm qa GREEN (79).
