# Impact Analysis — App Builder 4-step wizard

> Step 6. One-line verdict: **admin-web only — zero follower-app or backend
> behavior change; the wizard emits the same payloads the current builder
> does, plus fields the P1 backend already accepts.**

## Affected files (read or change)
- web (brand-web ADMIN): `Packages/brand-web/app/admin/sections/page.js`
  (wizard replaces the preset picker + editor entry), new components under the
  same route (catalog grid, kind tabs, inline rule builder, schedule fields,
  action picker), possible copy tweak in `app/admin/section-library/page.js`
  ("rules are also creatable inline from the App Builder").
- backend: none. mobile: none. migrations: none.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| PUT | /v1/admin/sections/:screen | none (client now sends starts_at/ends_at + config_json.design) | this UI only |
| POST/PATCH | /v1/admin/section-library(+/preview) | none (called from the inline builder) | this UI only |

## Risk notes
- Alias map is one-directional and additive: old rows READ through it; writes
  keep emitting legacy fields so the mobile renderer (unchanged until P3)
  keeps working byte-for-byte.
- Retirements are picker-level; `verify-twice` items before coding:
  (a) Collections surface existence + zero live rows, (b) follower-categories
  page vs Home Builder table overlap — findings recorded here post-check.
- Rollback: single admin route; reverting the commit restores the old builder
  with no data cleanup (new fields are ignored by the old UI).

## Release classification
**production-impacting** (brand-web runtime → Vercel on push). Sequence:
mockup-lock (founder) → implement → before/after diff (06-diff) → pnpm qa
green → explicit founder go → push. No migration, no OTA.
