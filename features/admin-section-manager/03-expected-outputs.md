# Expected Outputs — Admin Section Manager (Phase B)

## Backend
- `GET /v1/admin/sections/home` (admin JWT) → `{ success:true, data:{ shelves:[
  { id, screen, scope_type, scope_value, shelf_key, title, shelf_type, rule,
  item_type, category_key, item_limit, position, enabled, pinned_ref,
  config_json } ] } }` ordered by position.
- `GET` without an admin JWT → 401/403.
- `PUT /v1/admin/sections/home` with edited shelves → persists; a follow-up GET
  reflects the changes; the follower `GET /v1/follower/home` reflects them within
  the engine TTL (cache busted on the handling instance immediately).
- `DELETE /v1/admin/sections/:id` → removes the shelf; 404 on unknown id.
- Invalid screen → 404; invalid item_limit/shelf_type → 422 VALIDATION_ERROR.

## admin-web
- `/dashboard/sections` lists the shelves for the selected screen tab; each row
  shows toggle (enabled) · count (− N +) · up/down reorder · category + item-type
  dropdowns on "Top in" rails · the rule/type as read-only context.
- Publish saves via PUT and reloads the persisted state.
- Lives under the existing dashboard shell/auth (admin-only).

## Honest non-outputs
- No drag-and-drop (up/down in v1) · no add-arbitrary-shelf wizard (edit + delete
  the seeded set) · no migration · no mobile change.
- Multi-instance cache convergence is ≤ TTL, not instant cluster-wide (documented).
