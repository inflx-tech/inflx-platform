# Workflow — Theme Library + Configuration wizard (Phase 2)

## Actors & entry
Admin (capability `sections`) opens brand-web → **Fashion World → Theme Library**.

## Happy path A — create a theme from a blueprint (end state to prove)
1. Admin lands on `/admin/themes` → sees the grid of authored themes (empty on first run) + a **Create Theme** button.
2. Clicks **Create Theme** → a **Blueprint picker** lists the ~20 seeded blueprints grouped by purpose (Lifestyle / Occasion / Travel / Budget / Category / Trend).
3. Picks **Street Style** → wizard opens **pre-filled** from the blueprint:
   - Identity: name "Street Style", subtitle, icon 👟, audience.
   - Purpose: Lifestyle.
   - Visual: preset **Urban Fashion** (from Phase 1).
   - Supported categories: Jeans, Sneakers, Caps… (pre-checked).
   - Product count: min 4 / max 20.
   - Media rules: featured required, video optional, portrait preferred.
   - Supported offers: discount, bundle, bogo, free_gift.
   - Default copy: title / subtitle / CTA.
4. Admin edits only the delta (e.g. tweaks subtitle) → **Save draft** (`POST /admin/themes` with `from_blueprint_key`).
5. Admin clicks **Publish** → server validates required fields → status `published`.
6. **End state:** "Street Style" appears in the Theme Library grid as Published, ready for the Experience Studio (Phase 6).

## Happy path B — duplicate to make a sibling
1. On an existing theme (or blueprint), **Duplicate** → wizard opens copied.
2. Change purpose→Travel, categories→Travel Bags/Sneakers/Joggers, background(preset)→travel_lifestyle, subtitle→"Travel-ready fashion…" → Save → Publish. "Airport Looks" created in minutes.

## Data flow
`experience_themes` (+ blueprint seed rows) → theme service → admin controller → brand-web wizard. Wizard reads presets (Phase 1), world categories, offer-type list. No mobile/follower/engine.

## Failure / edge states
- Publish with missing required field → 422, inline field error, stays draft.
- min > max products → 422.
- Unknown blueprint key → 422.
- Empty library (pre-auth of any theme) → grid empty-state ("No themes yet — start from a blueprint").
- Non-admin / missing capability → 403.

## Proof of success
- Create-from-blueprint returns a draft with the blueprint's fields; publish flips to published only when valid.
- `pnpm qa` green (new web spec: create-from-blueprint + publish-validation + empty-state + auth-gate); zero regression.
- Theme appears in the grid; blueprint list returns the ~20 seeds.
