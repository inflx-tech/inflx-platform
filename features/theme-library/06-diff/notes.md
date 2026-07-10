# Before / After — Theme Library (Phase 2)

**Before:** no Theme Library. Mockups (`04-preview/mockups/themes-list.html`,
`theme-wizard.html`) + the interactive prototype are the authored intent.

**After:** real screens at `/admin/themes` (brand-web), proven by
`qa/web/admin/theme-library.spec.ts` (3/3 green) and the full suite (85/85 green).

## What matches the mockups
- Theme Library grid: theme cards (icon, name, subtitle, purpose + preset chips, status pill, product range).
- **Create Theme → blueprint picker** grouped by purpose (Lifestyle / Occasion / Travel / Budget / Category / Trend), 21 seeded blueprints.
- **Configuration wizard**: Identity, Purpose, Visual (preset select), Supported categories (add/remove chips), Product count, Media rules, Supported offers, Default copy — pre-filled from the chosen blueprint.
- **Save draft** + **Publish**; publish is validated server-side.

## Intentional differences from the mockup
- Supported categories are editable label chips (add/remove) rather than a fixed checkbox list — the deeper category-node picker is deferred to when the creator Studio consumes it (Phase 6). Noted in 05-impact.
- Preset is a `<select>` of live Phase-1 presets (not a static card).

## Verification
- Web spec: 3/3 green (create-from-blueprint → pre-filled wizard · publish-validation rejection · auth-gate).
- Full `pnpm qa`: 85/85 green, STATE=GREEN — zero regression.
- Local DB: migrations 129+130 applied clean (21 blueprints, groups correct). Service exercised: create-from-blueprint clones fields; publish rejects empty categories (field `supported_categories`); duplicate create yields unique key `street_style_2`.
- Fixed during verify: Postgres `text[]`/`jsonb` COALESCE cast bug in `theme.service` INSERT/UPDATE (caught by the local run).

## Not captured here
- Live "after" against production — post-deploy (prod migration + brand-web deploy), on the founder's explicit go.
