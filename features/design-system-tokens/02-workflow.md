# Workflow — Design System & Tokens (Phase 1)

## Actors & entry
Admin (capability-gated) opens brand-web → **Fashion World → Design System**.

## Happy path (end state to prove)
1. Admin navigates to `/admin/design-system` (optionally `?world=fashion`).
2. Screen calls `GET /v1/admin/design-system/tokens?world_key=fashion` and `GET /v1/admin/design-system/presets?world_key=fashion`.
3. Screen renders 5 groups: **Moods · Palettes · Typography · Backgrounds · Presets**.
   - Palettes render as swatch rows (primary/secondary/accent/bg/text).
   - Typography renders as sample text in the resolved style.
   - Backgrounds render as tiles with the seeded `avg_color` + label (asset files come later).
   - Presets render as bundle cards naming their mood/palette/typography/background.
4. Admin can filter by world (global tokens always shown alongside world tokens).
5. **End state:** admin sees the full seeded Fashion catalog and understands the vocabulary the Theme wizard (Phase 2) will offer. Read-only — no create/edit in v1.

## Data flow
`design_tokens` + `design_presets` (seeded) → read services → admin controller → brand-web page. No writes, no mobile, no follower, no engine.

## Failure / edge states
- Empty catalog (before seed) → groups render an empty-state ("Nothing seeded for this world yet"), HTTP 200.
- Unknown `world_key` → returns global tokens only, 200.
- Non-admin / missing capability → 403 FORBIDDEN (standard envelope).

## Proof of success
- API returns the seeded counts (moods 8, palettes 6, typography 6, backgrounds 16, presets 8) at `world_key=fashion` (+ global).
- `pnpm qa` green (new read endpoints covered; zero regression on existing lanes).
- Admin screen renders all five groups with correct swatches/labels.
