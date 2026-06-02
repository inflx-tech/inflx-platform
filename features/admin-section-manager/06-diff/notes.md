# 06-diff — Admin Section Manager (Phase B)

## What shipped
- **Backend** (admin-only, `requireAnyAdminRole`):
  `GET /v1/admin/sections/:screen?scope_type=&scope_value=`,
  `PUT /v1/admin/sections/:screen` (transactional upsert + engine cache-bust),
  `DELETE /v1/admin/sections/:id` — over Phase A's `section_config`. No migration.
- **admin-web** `/dashboard/sections`: screen tabs (Home / Category / Offers /
  Creator Store / Creator's Category) · scope selector (global) · per-shelf
  toggle (enabled) · count (− N +) · up/down reorder · category + item-type
  dropdowns on "Top in" rails · Publish (saves via PUT). `sectionApi` added to
  `lib/api.js`.

## Matches the locked design
The page implements the controls shown in the `home-comprehensive.html` admin
panel (reorder · show/hide · count · per-rail category + item-type · publish).
Drag-to-reorder is rendered as up/down controls in v1 (functionally equivalent —
same `position` write); a drag polish pass can follow.

## Honest divergences
- Reorder = up/down buttons, not HTML5 drag (v1).
- No add-arbitrary-shelf wizard yet — v1 edits the seeded shelf set + DELETE.
- Cross-instance cache convergence ≤ TTL (≤60s), not cluster-instant.

## Verification
`pnpm qa` GREEN (backend additive, zero regression) · admin API tests (auth gate,
get, upsert toggle/count/reorder/type, delete, validation) · `next build` on the
new page · manual GET→edit→PUT→re-GET round-trip and follower `/home` reflects.
