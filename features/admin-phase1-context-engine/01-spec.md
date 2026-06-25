# 01 — Spec · App Builder Phase 1 (context-aware engine + business scope)
Backend foundation for the App Builder program. (1) Migration 119 widens
section_config CHECKs: screen += 'business'; shelf_type += tiles/category_rail/
restaurant_list (completes the section-save fix begun in Phase 0's controller).
(2) Every rule's ctx carries placement context — scope, vertical, brandId,
viewer location + follows — so the same section self-filters by where it sits.
(3) adminSections SCREENS += 'business'. Backend only; no UI (Phase 2), no mobile.
