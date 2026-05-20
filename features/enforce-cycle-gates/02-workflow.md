# Workflow — enforce-cycle-gates

## How a future UI/Mobile commit flows after this sub-contract

1. **Develop:** founder + agent work through spec → mockup-lock →
   impact → implement → before/after diff → all tests green.
2. **Push:** `git push origin main` triggers
   `qa/hooks/pre-push` → `governance-check.mjs`:
   - **Rule 1** (existing) — governed path requires approved contract.
   - **Rule 2** (existing) — released=true requires evidence block.
   - **Rule 3 (NEW)** — if any changed file matches UI_GOVERNED
     (`Packages/*/(src|app|components|lib|screens|services)/`),
     ANY approved+complete contract in the changeset MUST have
     `mockup_locked: true` with `_by` + `_at` set. Loud-fail names
     the file + the contract + the missing field.
   - **Rule 4 (NEW)** — if Rule 3 fires, that contract MUST also
     have `features/<slug>/06-diff/notes.md` present and
     non-empty. Loud-fail says where to create it + worked example
     pointer.
   - **Rule 5 (NEW)** — if changeset touches MOBILE_GOVERNED
     (`Packages/Mobile/src/`) AND a lock.json flips
     `released=true`, the release block MUST have
     `maestro_green !== false`. Loud-fail says to set
     `release.maestro_green: true` after running
     `pnpm qa:maestro` green.
3. **On all rules pass** → exit 0 → push proceeds → Render/Vercel/
   OTA fires as configured.
4. **On any rule fail** → exit 1 → push blocked → founder either
   fixes the contract (preferred) or invokes
   `GOVERNANCE_OVERRIDE="reason for emergency"` (loud, recorded,
   never silent).

## How THIS sub-contract is verified in this turn

1. **Modify `governance-check.mjs`** with the three new rules.
   Read carefully; the logic is small but security-relevant.
2. **Self-test 1 — sub-contract 5's own changeset.** Run
   `pnpm qa:gov` against the current commit state. Expected:
   exit 0 (this sub-contract's only modified files are
   governance-check.mjs + GOVERNANCE.md + CLAUDE.md, none of which
   match UI_GOVERNED or MOBILE_GOVERNED).
3. **Self-test 2 — constructed UI scenario without mockup_locked.**
   Build a small in-process test that:
   - Calls the governance-check logic with a synthetic changeset
     containing a UI_GOVERNED file
   - Confirms exit 1 with the expected error message about
     missing `mockup_locked`
   - Confirms exit 1 with the expected error about missing
     `06-diff/notes.md` when that's the gap
   - Confirms exit 1 with the expected error about
     `maestro_green` for a mobile commit with released=true and
     no maestro_green field
   - These tests live in `qa/scripts/governance-check.test.mjs`
     (small, dep-free) — runnable via `pnpm qa:gov:test` (new
     pnpm script).
4. **Regression:** `pnpm qa` 66/C1/gate 0 + `pnpm qa:db`
   382/382 — verify the new gov-check changes don't regress
   either main lane.
5. **Step-14 release:** commit + push. The push runs the **new**
   gov-check against THIS sub-contract's changeset (no UI files,
   no mobile files) → exit 0.

## Failure paths (loud, never silent — same design philosophy)

- UI commit without `mockup_locked`:
  ```
  [gov-check] ✗ UI-governed path touched without an approved+complete
              contract carrying mockup_locked: true
                touched: Packages/brand-web/app/feed/page.js
                contract: features/<slug>/lock.json
                missing: mockup_locked === true (currently: false)
              fix: run `pnpm preview:open <slug>`, review the mockups,
                   set "mockup_locked": true with "_by" + "_at" in lock.json
              See features/_demo-preview/ for a worked example.
              GOVERNANCE.md §4a.
  exit 1
  ```
- UI commit without `06-diff/notes.md`:
  ```
  [gov-check] ✗ UI-governed path touched without 06-diff/notes.md
                touched: Packages/Mobile/src/screens/Feed.js
                contract: features/<slug>/lock.json
                missing: features/<slug>/06-diff/notes.md (or empty)
              fix: capture the after PNGs (pnpm diff:after <slug>),
                   author 06-diff/notes.md narrative.
              See features/_demo-preview/06-diff/notes.md for an example.
              GOVERNANCE.md §4b.
  exit 1
  ```
- Mobile commit released=true without `maestro_green`:
  ```
  [gov-check] ✗ Mobile-governed path released without release.maestro_green
                touched: Packages/Mobile/src/config/api.js
                contract: features/<slug>/lock.json released=true
                release.maestro_green is false or unset
              fix: run `pnpm qa:maestro` green, then set
                   "release.maestro_green": true in the lock.json.
              GOVERNANCE.md §10.
  exit 1
  ```
- `GOVERNANCE_OVERRIDE="reason"`: same as today — loud, recorded,
  exit 0.

## Commands

```bash
pnpm qa:gov         # run the governance check against the current changeset
pnpm qa:gov:test    # NEW — run the unit tests for governance-check rules
```
