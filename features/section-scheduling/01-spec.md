# Feature Spec — Section scheduling + config validation (Cleanup P1)

> Step 2 of the contract-driven workflow. Written and agreed BEFORE any code.
> Program: Section System Cleanup (Docs/SECTION_SYSTEM_SPEC.md, LOCKED 2026-07-03).

## Problem / goal
Admin (founder) composes follower-app pages from sections, but sections cannot
be time-boxed: a sale section must be manually published and manually removed,
and the countdown timer (`config_json.timer`) is cosmetic — it hits zero and
the section stays. Separately, `config_json` is persisted with NO shape
validation, so a typo'd style / malformed timer / bad tap_destination saves
fine and fails silently on the follower's device.

Goal: (a) sections gain `starts_at` / `ends_at` and the engine honours them —
expired sections disappear automatically, no "sale over" state (founder
decision #4); (b) `PUT /admin/sections/:screen` rejects malformed `config_json`
with a field-level message.

## Scope
- In scope:
  - Migration 124: `section_config.starts_at` + `ends_at` (timestamptz NULL).
  - `sectionEngine.loadConfig()` schedule-window filter (both global + override
    query legs).
  - Admin save/list: accept, validate, persist and return the two new fields.
  - `config_json` shape validation (tolerant: validates KNOWN keys, passes
    unknown keys through — the raw-JSON editor in the admin UI must keep
    working).
  - Honest-timer assist: when a shelf has `ends_at` and admin enabled a timer
    without a time (`config_json.timer` object with no `ends_at`), the engine
    fills the timer from the row's `ends_at`. Payload also carries
    `starts_at`/`ends_at` per section.
- Explicitly out of scope:
  - Admin UI date-pickers (contract `app-builder-wizard`, P2).
  - New designs / renderer changes (P3). NO `Packages/Mobile` or
    `Packages/brand-web` code in this contract.
  - `design` catalog ids in config_json (P2).
  - City-scope UI, analytics (P5).

## Surfaces touched
- App(s): backend only (`backend/migrations`, `backend/src`).
- Roles involved: admin (save path), follower (engine read path).

## Data / contracts
- New columns: `section_config.starts_at timestamptz NULL`,
  `section_config.ends_at timestamptz NULL`. NULL = live immediately / never
  expires → **all existing rows behave exactly as today**.
- Changed endpoints (shape-additive, backward compatible):
  - `GET /v1/admin/sections/:screen` — rows include `starts_at`, `ends_at`.
  - `PUT /v1/admin/sections/:screen` — shelves may carry `starts_at`,
    `ends_at` (ISO 8601 or null). New validation errors (422
    VALIDATION_ERROR + field): bad timestamp, `ends_at` ≤ `starts_at`,
    malformed `config_json` (see 03-expected-outputs for the matrix).
  - Follower section endpoints — each section gains `starts_at`/`ends_at`
    (additive; mobile ignores unknown fields).
- Money/units/attribution: none affected.

## config_json validation matrix (KNOWN keys only; unknown keys pass)
- `config_json` present → must be a plain object, serialized ≤ 20 KB.
- `style` → one of carousel|featured|grid|banner|mosaic|themed_rail.
- `tiles` → array of objects; per tile: `image_url`/`label`/`badge`/
  `library_section_id` strings when present; `size` large|small when present;
  per-tile `tap_destination` validated as below.
- `timer` → object; `timer.ends_at` must parse as a date when present;
  `timer.label` string when present.
- `tap_destination` → object; `type` grid|category|page; type=category
  requires `category_node_id`; type=page requires `page_key`.
- `presentation_type` → banner|hero_tiles when present.
- `nodes` → array of objects when present.

## Non-functional
- Auth/role gates: unchanged (`requireAnyAdminRole` on admin routes).
- Failure modes: legacy rows with configs that would now fail validation are
  NOT touched (validation runs on WRITE only; read path never rejects).
  Override-merge semantics: a scheduled-out override row no longer suppresses
  its global row (base section returns while the override is outside its
  window) — accepted and documented.
- Release class: **production-impacting** (backend/src + migration). Deploy
  requires explicit founder go; behavior-inert for existing data until admin
  sets dates (P2 UI).
