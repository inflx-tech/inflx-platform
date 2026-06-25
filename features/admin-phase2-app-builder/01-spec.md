# 01 — Spec · App Builder (Phase 2)

ONE admin tool replacing App Sections + Home Builder. Founder's locked model.

Flow: pick SCOPE (Home / Creator Store / Business page / Offers) → pick WORLD
(food/fashion/furniture/beauty; car_rental hideable) → arrange SECTIONS top to
bottom, each = a TEMPLATE (layout) + a RULE (fill), with reorder / sticky / edit
→ Publish. Rules are context-aware (Phase 1) so the same section adapts by
scope/world/business/viewer.

Absorb Home Builder: a "Manage worlds" panel under Home scope owns the worlds
list (add/reorder/enable-disable/tile image+label) — retire the separate
Home Builder + legacy follower-categories pages. Account icon + search = fixed
chrome, not admin-editable.

admin-web only (Vercel); no mobile, no migration (Phase 1 added 'business'
scope + widened CHECKs). OPEN: Offers as a 4th scope (default keep).
