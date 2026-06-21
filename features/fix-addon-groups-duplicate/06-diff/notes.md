# Diff notes — Fix duplicate addon/variation groups

Founder walkthrough: "save customisation is saving multiple things." DB showed a
product with 24 groups (16× "Choose your toppings" + 8× "Customize Your Pizza")
— a powers-of-2 accumulation from client state carry-over.

What changed:
- Migration 116: collapsed existing duplicates (keep min id per product+name)
  and added a UNIQUE (product_id, name) index. Applied to prod: 24 → 2, 0 dups.
- Backend `replaceAddonGroups`: dedupes incoming groups by normalized name (a
  doubled payload now collapses to one; the bulk-replace delete+insert was
  already correct — verified by re-posting the same set 4× staying at 1).
- brand-web: `key` on CustomiseDishModal (fleet-edit + wizard) forces a fresh
  remount per dish, eliminating stale-state carry-over between edits.

Verified: food-addon-write 8/8 (new dedupe case + distinct-name saves still work
under the unique index). brand-web next build exit 0.
