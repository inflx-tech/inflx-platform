# 01 — Spec · Admin Phase 0 cleanup
First phase of the App Builder program (Docs/ADMIN_SECTION_ENGINE.md): remove
admin confusion + fix the blocking section-type bug, before the bigger
consolidation. Backend + admin-web, no mobile, no migration.

Scope: (1) fix SHELF_TYPES so tiles/category_rail/restaurant_list save;
(2) kill dead top_by_sales (alias→products_in_category + fix admin default);
(3) delete Collections entirely (page, nav, preset, guard, editor, api helpers,
backend routes/controller/service, sectionEngine expansion). Car rentals = founder
toggles in Home Builder.
