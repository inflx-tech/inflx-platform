# Impact — Dictionary parity + add-custom-item

## Terse verdict
**brand-web UI only, no backend.** Restaurant gets a discoverable "add your own item under
this category"; admin master-dishes becomes the same Cuisine → Category → Item drill-down the
restaurant uses (reusing existing data + the edit/upload modal). Consistent dictionary model
across admin + seller.

## Blast radius
- Restaurant: additive grid tile + a handler that reuses `onItemAdd` (same path as the search
  custom-add). No change to existing add/edit flows.
- Admin: the catalogue render changes from table → chips+grid; all data fetching, create/edit
  modal, upload, delete, pagination are unchanged. `openCreate` already pre-fills cuisine+
  section from the active filter.

## Risk / rollback
- Pure render/UX. Revert restores the table + search-only custom-add. No data risk.
