# Workflow — Design Library (Phase 3)

## Actors & entry
Admin (capability `sections`) opens brand-web → **Fashion World → Design Library**.

## Happy path (end state to prove)
1. Admin navigates to `/admin/design-library`.
2. Screen calls `GET /v1/admin/design-layouts?world_key=fashion` and `GET /v1/admin/section-styles`.
3. Renders two panels:
   - **Layouts** — the 10 layout cards, each showing label, aspect (16:9 / 1:1 / 9:16 / 4:5 / flex), kind (banner/card/frame/structure), and its **Layout Contract**: required slots (green), optional slots (grey), hidden slots (struck-through).
   - **Section Styles** — the vocabulary chips (carousel / grid / masonry / collage / story-rail / tabs / bento / split / hero / magazine) with a one-line "how N cards arrange".
4. **End state:** admin sees the full visual grammar — what each layout guarantees and drops — that the Adaptive Renderer (Phase 4) will honor and the Experience Template (Phase 5) will bind. Read-only.

## Data flow
`design_layouts` (seeded) → read service → admin controller → brand-web page. Section styles are a static vocabulary. No writes, no mobile, no follower, no engine change.

## Failure / edge states
- Empty catalog (pre-seed) → empty-state ("No layouts seeded yet"), HTTP 200.
- Non-admin / missing capability → 403.

## Proof of success
- API returns 10 layouts with valid contracts (each has ≥1 required slot).
- `pnpm qa` green (new web spec: renders layouts + contracts + section styles + auth-gate); zero regression.
- Screen shows all 10 layouts with their required/optional/hidden slots.
