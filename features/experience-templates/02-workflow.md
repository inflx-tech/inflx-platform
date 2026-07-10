# Workflow — Experience Templates + placement (Phase 5)

## Actors & entry
Admin (capability `sections`) → brand-web → **Fashion World → Experience Templates**.

## Happy path — assemble + place a template (end state to prove)
1. Admin lands on `/admin/experience-templates` → grid of templates (empty first run) + **Create Template**.
2. Builder opens:
   - **Type**: Creator / Automatic / Mixed (pick Creator).
   - **Theme**: pick from live themes (Street Style).
   - **Design**: pick from live layouts (Hero Banner) — shows its contract.
   - **Section Style**: pick from the vocabulary (Hero).
   - Name auto-suggests "Street Style Hero" (editable).
   - **Placement**: which screen/scope (Fashion Home; optionally audience/creator-store/business).
   - **Store rule**: always / if-products / manual.
   - **Creator-store rule**: always / if-creator-has-experience / hidden.
   - **Location priority**: city → state → country → global.
3. **Save** (`POST /experience-templates`) → draft template.
4. **Place** (`POST /:id/place`) → upserts a `section_config` row (screen+scope from placement, `rule='experience_template'`, `template_id` set, enabled).
5. **End state:** the template appears "Placed"; a `section_config` row exists. The follower home is **unchanged** — the `experience_template` rule returns empty (no experiences yet), so hide-empty drops the section until Phase 6.

## Data flow
`experience_templates` (theme_key + design_layout_key + section_style + placement) → place → `section_config` row (template_id, rule='experience_template') → the existing section engine → returns empty for now.

## Failure / edge states
- Create without theme/layout/style → 422 inline.
- Place with an invalid screen → 422.
- The `experience_template` rule on a template with no experiences → returns `[]` (section hidden), never throws.
- Unplace → the section row is disabled/removed; no orphan.

## Proof of success
- Create returns a draft with theme/layout/style; place writes exactly one `section_config` row with the right template_id + rule.
- The section engine still returns the current home unchanged (new rule yields empty; existing shelves identical) — proven by a DB/engine check + the existing follower QA staying green.
- `pnpm qa` green (new web spec: create + place + validation + auth-gate); zero regression.
