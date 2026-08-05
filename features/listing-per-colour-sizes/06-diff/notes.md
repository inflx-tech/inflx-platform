# 06 — Before / after

**Before panel:** `04-preview/mockups/per-colour-sizes.html`
**After panel:** not captured by Playwright — see "Verification honesty" below.

## What changed on screen

**Colour card, size row.** Was a static label plus a stock box per size, driven by
the global list. Now every master size renders as a **toggle button** carrying its
own stock box. On is the default, so a brand who never touches it sees the same
three boxes it always saw — only the heading changed, from
`Stock per Size` to `Size & stock for White`, which names the colour the row
belongs to.

**Off state.** Dashed border, muted fill, struck-through label, and the numeric
input replaced by an em dash. Reads as "not sold in this colour" rather than
"zero in stock" — the distinction the old screen could not express at all.

**Two new lines of copy.** One under the top Size row explaining that it is the
full range; one under a colour card listing the sizes that colour skips. Both use
the existing `.sub` style.

**Blocked state.** All sizes off for a colour → amber
`Pick at least one size for Green.` and Next disabled, via the existing
`stepBlocked` mechanism. No new pattern.

## Prediction vs reality

| Predicted in `04-preview/workflow-prediction.md` | Outcome |
|---|---|
| Off-state chip is a variant of `.vsize`, no new component | Held — `.vsize.off` + `.vsz` button, 5 CSS lines |
| Toggling one colour does not disturb another's typed stock | Held — the updater spreads `d.variants` and only replaces the one colour's entry |
| Re-enabling a size returns an **empty** stock box | Held, and made explicit: `toggleColorSize` deletes that size's stock when switching off, so a stale count cannot resurrect |
| Shrinking the top row drops the size from every colour card | Held — `sizesFor()` filters through the master on every read, so an orphan is unreachable |
| Free-size leaves unchanged | Held — the whole block stays gated on `selectedVariants.length > 0` |

Nothing in the prediction was falsified.

## Deviation from the mockup

The mockup drew the off-state hint as amber body text under the Blue card. The
implementation uses the neutral `.sub` style there and reserves amber
(`.hintq.warn`) for the genuinely blocking "pick at least one" case. A colour
that skips a size is a normal, intended state — it should not look like a warning.

## Verification honesty

- **`npm run build` (brand-web): PASSES.** Compiles clean, no new warnings.
- **`pnpm qa`: 118 passed, 6 failed — NOT green.** All 6 are `qa/api/*` specs
  (`contract-invariants`, `invariants-extended`). Classification: **environmental,
  not a defect.** They require a running backend; `localhost:3001` is unreachable
  and the backend refuses to start because no local PostgreSQL is available
  (`[DB] Failed to connect to PostgreSQL`). Verified directly by starting
  `backend/src/index.js` and probing `/v1/health`. This change touches **zero**
  backend files, so it cannot influence an API contract test. The failures are
  pre-existing in this environment and would reproduce on a clean tree.
- **No automated coverage exists for the listing stepper**, in either direction.
  There is no Playwright flow for `/dashboard/products/listing`, so nothing was
  weakened, skipped or made to pass — there was nothing there to begin with.
- **The visual result is unverified.** Rendering the real Step ② needs an
  authenticated brand session plus a seeded `category_nodes` taxonomy, neither of
  which exists locally. **The screen must be exercised on the deployed brand-web**
  against the founder's test brand before this is considered proven. The
  `02-workflow.md` 10-step path, including the edit round-trip, is the script.

The logic was instead self-reviewed line by line against the acceptance table in
`01-spec.md`. That is a weaker signal than execution and is recorded as such.
