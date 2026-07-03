# Feature Spec — Section analytics + city scope (Cleanup P5)

> Program: Section System Cleanup (SECTION_SYSTEM_SPEC §8 P5). Final phase.

## Problem / goal
(a) Admin composes pages blind — no per-section engagement numbers exist
anywhere (backend-first rule: we do NOT surface phantom metrics; today there
is literally no section-keyed event data, so we must capture it first).
(b) The engine has a `city` scope in schema but (verify-twice) `loadConfig`
merges only ONE override layer per call — follower endpoints pass
scopeType='vertical', so city rows can NEVER merge today; and admin has no
city UI.

## Scope
### P5a — City overrides (engine + admin)
1. `sectionEngine.loadConfig(screen, scopeType, scopeValue, city)` → 3-layer
   merge: global < vertical < **city** (city rows: scope_type='city',
   scope_value=lowercased city). Identity per (shelf_key, category_key,
   item_type) as today. `buildSections` passes its ctx city.
   v1 semantics: a city row applies to that screen for followers in that city
   across worlds (category_key can narrow later — documented).
2. App Builder: "City override" input beside the scope row → when set,
   compose the city stack (scope_type='city'); chips show it; wizard Display
   step shows the city context. (SCOPE_TYPES already allow 'city' end-to-end.)

### P5b — Section analytics (capture → surface)
3. Migration 125: `section_events` (section_key, screen, scope_value, city,
   event CHECK tap|see_all, entity_type, entity_id, follower_id NULL,
   created_at; indexes on created_at + section_key).
4. `POST /v1/follower/section-event` — optional-auth, fire-and-forget
   (never blocks UX; invalid → 204 silently). Rate-sane: single-row insert.
5. Mobile `SectionRenderer`: emit on item tap + see-all (fire-and-forget,
   failure-silent). **Mobile-governed → rides tonight's OTA precedent.**
6. `GET /v1/admin/section-analytics?days=7&screen=&scope_value=` — taps /
   see-alls / unique followers per section_key, honest zeros.
7. App Builder: collapsible "📊 Last 7 days" panel above the shelf list for
   the current scope (per-shelf taps + see-alls; "no data yet" state).
- Out of scope: impressions (volume/noise — revisit), historical backfill
  (impossible — no data existed), A/B, dashboards.

## Data / contracts
- New table (125) + 2 new endpoints (public event write, admin read). No
  changes to existing endpoint shapes; section payload untouched.

## Non-functional
- Event write is optional-auth + fail-open (app never blocks on it).
- Release class: **production-impacting** — Render + Vercel + **OTA** (emit).
  Founder pre-authorized P4+P5 completion incl. deploys; OTA under the same
  recorded override pattern as P3 (no device for Maestro).
