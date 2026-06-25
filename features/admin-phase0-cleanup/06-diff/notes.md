# 06 — Before/After · Admin Phase 0 cleanup
Before: tiles/category-rail/restaurant-list presets were REJECTED on publish
(SHELF_TYPES allow-list) → those sections never saved/appeared; product sections
defaulted to a dead rule (top_by_sales → empty); a whole dead Collections system
(page + backend + engine) duplicated Section Library and cluttered admin.

After: those section types save; product default is products_in_category; dead
top_by_sales aliased so any legacy row renders; Collections fully removed
(admin + backend + engine), engine degrades gracefully on stray rows.

Verify: backend modules load; pnpm qa GREEN(79); brand-web next build exit 0.
No mobile/OTA. Car rentals hidden via Home Builder toggle (founder).
