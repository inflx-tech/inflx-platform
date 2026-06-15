# Impact — Section rule-builder UI (Phase 3b)

**Terse verdict:** Net-new admin screen + admin-only endpoints on top of the 3a engine.
No migration, no follower surface, no mobile. Authoring tool only — sections created here
do nothing follower-visible until placed (3c). Reuses existing tree + tag-vocab endpoints.

## Blast radius
- New admin page + nav link (brand-web) → Vercel. New admin controller/routes + api.js calls →
  Render. The preview endpoint calls the 3a evaluator read-only.
- No change to any follower endpoint or existing admin screen.

## What could break + mitigation
- *Preview cost*: a broad rule could match many products — capped sample + count query; debounced.
- *Tree only for fashion/furniture*: builder hides sub-category for businesses without a tree
  (honest); evaluator already treats absent sub-category as no-filter.
- *Bad input*: service validation → 422; UI shows the message.
- *Auth*: requireAnyAdminRole on all endpoints.

## Reversibility
- Pure additive; revert files. Sections authored are inert until 3c.

## Deploy classification
**Production-impacting** (brand-web admin + backend routes) → explicit founder go.
UI-governed → mockup-lock + 06-diff. released=false until founder verifies. No Maestro (not Mobile).
