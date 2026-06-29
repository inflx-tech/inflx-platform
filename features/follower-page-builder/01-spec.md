# follower-page-builder — tap→destination chooser (D) + admin-created pages (E)

> Closes the last two "make the follower app fully built" gaps in the founder's
> architecture model: the app is pages → sections → (tap → one of 3 destinations).
> Today the destination is hardcoded by section *type* and only 2 of the 3 exist.
> This contract makes the destination **admin-chosen** and adds the missing 3rd
> destination — **a page the admin creates**.

## Problem (verified 2026-06-28)

- **D — no destination chooser.** `SectionRenderer.js:225` derives a section's
  tap target from its `type`: data shelves → `SectionResults` (product grid),
  category shelves → `CategoryBrowser`. The admin cannot choose. There is no
  `destination` field on `section_config` (migrations 083/119) or in `config_json`.
- **E — no custom pages.** A "page" today is only one of 6 fixed scopes baked
  into the `section_config.screen` CHECK. No `follower_pages` table, no "create
  page" admin UI, no mobile screen that renders an arbitrary page by id. So
  destination ③ ("tap → another page") is impossible.

## Locked decisions (founder, 2026-06-28)

1. **A custom page = a GLOBAL themed page.** One named section-stack (e.g.
   "Summer Sale", "New Arrivals") that lives once and can be the tap-destination
   of any section on any page/world. No per-world scoping in v1.
2. **Reach in v1 = via a section tap only.** No home tile, no share/deep link
   yet (those lean on the APK round — deferred).
3. **Destination unset → keep today's type-based routing** (zero regression).
4. **Maximise reuse:** a custom page is a new **scope** (`screen='page'`,
   `scope_value=<page key>`) in the *existing* `section_config` + section engine
   + `/admin/sections` App Builder. No parallel page-section machinery.

## The model

- **Section-level tap** (the section's "See all" / a Frame banner tap) resolves a
  destination. Individual **cards** keep their natural detail nav (product→PDP,
  brand→store) — unchanged.
- Three destinations, now admin-selectable per section:
  - ① **Product grid** — the section's rule, run full, in `SectionResultsScreen`. *(exists)*
  - ② **Category browser** — left-rail + grid + filters, `CategoryBrowserScreen`. *(exists)*
  - ③ **A page** — a custom page's own section stack, rendered by a new generic
    `FollowerPageScreen`. *(new)*

## Scope

### D — tap-destination chooser
- Store on the section as `config_json.tap_destination`:
  `{ type: 'default'|'grid'|'category'|'page', node_id?, vertical?, page_key? }`.
  `default`/absent = current type-based routing.
- Admin: a **"On tap, go to…"** control in the section config editor
  (`/admin/sections`), with conditional sub-pickers (category node for `category`,
  page dropdown for `page`). Reuses the existing category-picker + dropdown patterns.
- Mobile: `SectionRenderer` reads `section.config.tap_destination` in the `seeAll`
  / banner-tap path and routes accordingly *before* the hardcoded fallback.

### E — admin-created pages
- New table **`follower_pages`** (id, key UNIQUE, label, title, subtitle, enabled,
  timestamps) — page **registry/metadata** only; its sections live in
  `section_config` under `screen='page', scope_value=<key>`.
- Migration also relaxes the `section_config.screen` CHECK to add `'page'`.
- Admin CRUD: `POST/GET/PATCH/DELETE /v1/admin/pages` (capability `sections`).
- Admin UI: new **`/admin/custom-pages`** manager (list · create · rename · enable ·
  delete) + a **"Custom page"** scope tab added to the App Builder `/admin/sections`
  (pick a page → compose its stack via the existing composer — full reuse).
- Follower read: `GET /v1/follower/page/:key/sections` →
  `sectionEngine.buildSections({ screen:'page', scopeType:'global', scopeValue:key, … })`.
- Mobile: new `FollowerPageScreen` (route `FollowerPage`, params `{ pageKey, title }`)
  → `followerApi.getPageSections(pageKey)` → header + `<SectionRenderer>`.

## Out of scope (v1)
- World-scoped custom pages (locked global-only).
- Home tile / share-link entry to a custom page (deferred to APK round).
- Pagination on `SectionResults` (pre-existing cap, unchanged).
- Per-card destination override (cards keep natural nav).

## Non-regression guarantees
- Sections with no `tap_destination` behave exactly as today.
- `screen` CHECK change is additive (`'page'` only); existing 6 scopes untouched.
- New table + endpoints are additive; `pnpm qa` GREEN 79 must hold.
