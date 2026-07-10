# Before / After — Experience Templates (Phase 5)

**Before:** no template layer. Mockups (`04-preview/mockups/templates-list.html`,
`template-builder.html`) are the intent.

**After:** real screens at `/admin/experience-templates` (list + builder), proven by
`qa/web/admin/experience-templates.spec.ts` (3/3 green) + full suite (95/95 green).

## What matches the mockups
- Templates grid: name, type tag, theme + design + section-style chips, Draft/Placed pill.
- Builder: Type → Theme (live) → Design (live) → Section Style → Name → Placement → Store rule → Creator-store rule; Save + Place + Unplace.

## Intentional differences from the mockup
- v1 **Place** writes ONE section_config row on the world home (screen=category, scope=vertical/world). Other placement surfaces (creator store, business) are stored on the template for a later phase — noted in the builder.
- Location priority shown as the fixed city→state→country→global default (edit deferred).

## The live-engine safety proof (the key obligation)
The one engine touch is a NEW isolated rule `experience_template` → returns `[]` in Phase 5. Verified locally:
- `runRule('experience_template', {})` → `[]`.
- create + place → a section row with `rule=experience_template`, `template_id` set, `enabled=true`.
- **fashion-home NON-template rows: before == after** (existing home untouched).
- unplace → the template's section row is removed (0 rows), template back to draft.
- Full `pnpm qa` 95/95 green — every existing follower/section/admin spec passes unchanged.

**Net: a placed template is honest-hidden on the follower home (empty → dropped) until creators publish experiences (Phase 6). The live home does not change today.**

## Not captured here
- Live "after" against production — post-deploy, on founder go (with a prod check that the live home is unchanged).
- Creator experiences filling the rule (Phase 6); the mobile render (P4b, pushed not-OTA'd).
