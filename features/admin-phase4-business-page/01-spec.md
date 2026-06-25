# 01 — Spec · App Builder Phase 4 (food business page as sections)
The food business page = a fixed header spine + an admin-composed section stack
(Business→Food). The Menu is a FOOD-specific core section (collapsible dishes);
banner/creator/offers are shared sections placed around it. Context-aware:
brandId flows into the stack so creator/offers auto-scope to the brand. Section
templates are vertical-aware (Menu offered only on Business→Food; fashion gets
its own catalogue section later). Default = Menu-only (no regression).
Backend endpoint + admin preset/filter + mobile screen render. No migration.
