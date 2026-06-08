# Before / After — admin-section-manager-v2 (Part A)

> "Before" = the v1 admin page (order/toggle/count/type/delete only) + the admin
> mockup panels in the comprehensive HTMLs. "After" = the rebuilt
> `/admin/sections` page. Screenshot = manual/Playwright against the admin route
> (founder/admin auth).

## What shipped (1 file — `Packages/brand-web/app/admin/sections/page.js`)
- **Rename:** each shelf title is now an inline-editable input.
- **Config editor** (⚙ per row): caption (`sub`), chip/filter labels
  (comma-separated → `config.chips`/`config.filters`), nav-vertical labels+icons
  (`config.verticals`), and an **Advanced raw-JSON** editor (validated live; invalid
  JSON is flagged and not applied).
- **＋ Add Section:** preset picker (Businesses / Products / Offers / Creators /
  Controls) → adds a valid draft shelf (auto shelf_key, default count 8); Publish
  inserts it.
- **Scope selector:** Global / City (+name, "Load city") / Vertical (+select) →
  loads + publishes that scope's overrides.
- Existing reorder/toggle/count/category+item-type/delete retained; drafts can be
  removed before save; Publish sends `scope_type`+`scope_value`+`shelves`.

## Matches the (mockup) admin panel
- City selector, per-vertical scope, ＋ Add Section, and "edit ▾" config editing —
  the pieces the v1 page lacked are now present.

## Honest divergences / notes
- **No drag handle** — reorder is ▲▼ (functionally equivalent; drag is cosmetic).
- **Per-vertical "tabs"** are implemented as a scope dropdown (Vertical + select),
  not a tab strip — same capability.
- Backend already supported title/config/insert/scope; this is pure UI wiring.
- **Part B not in this change:** the greeting being admin-editable + admin-curated
  sub-cat chips need a migration + the app reading the config → shipped next
  (migration 091 + OTA).

## Verification
- JSX parse/transform OK (via babel). `pnpm qa`: **GREEN — 79 passed, C1 GREEN**
  (`qa/reports/2026-06-08T07-07-22-601Z/`). Admin nav-sweep + role-gate specs
  unaffected (they test reachability/auth, not this page's internals).

## Release
**production-impacting** (Vercel — brand-web admin), auto-deploys on push. No
migration, no OTA. Maestro Rule 5 not triggered (not Mobile/src).
