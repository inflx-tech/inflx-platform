# Feature Spec — Mobile seller listing (DEFERRED / optional)

> Order: 7 (optional) · Depends on: #2 · Status: STUB (draft, not locked). Greenfield. Build only if mobile-seller listing is wanted.

## Problem / goal
The entire seller listing UI is **brand-web only** — `Packages/Mobile` has no product/menu authoring screen. If sellers should list from the phone, build RN screens mirroring the brand-web wizard. Role: **brand** (seller, mobile).

## Scope
- In scope: RN listing screens (drill-down browse + batch-add, dish/model search, photo capture, preview, publish) reusing the same backend APIs (#1/#2/#4); Maestro mobile-verify per governance.
- Explicitly out of scope: any new backend (reuses existing endpoints); admin authoring (web only).

## Surfaces touched
- App(s): mobile (brand role); backend (none new).
- Roles involved: brand approved.

## Data / contracts
- New/changed: none server-side; consumes #1/#2/#4 endpoints.
- Endpoints: reuse.

## Non-functional
- Auth/role gates: brand approved (mobile JWT).
- Failure modes: Mobile-governed release → `release.maestro_green` required; OTA-shipped; offline draft handling.
