# Expected outputs — enforce-cycle-gates

## Files modified

```
qa/scripts/governance-check.mjs    +UI_GOVERNED + MOBILE_GOVERNED
                                    regex + 3 new rule blocks
                                    (mockup_locked, 06-diff/notes.md,
                                    maestro_green). Existing rules
                                    1+2 unchanged.
GOVERNANCE.md                       §4a (mockup-lock) [RECOMMENDED]
                                    → [ENFORCED]; §4b (06-diff)
                                    [RECOMMENDED] → [ENFORCED];
                                    §10 (Maestro lane)
                                    [RECOMMENDED for UI-touching
                                    mobile] → [ENFORCED for any
                                    Packages/Mobile/src/].
CLAUDE.md                           lifecycle callout blocks updated
                                    from "(advisory)" to "(enforced
                                    for UI/Mobile commits)".
```

## Files created

```
qa/scripts/governance-check.test.mjs    in-process unit tests for
                                         the new + existing rules
                                         (dep-free; uses fs/path
                                         + temp dirs)
package.json (root)                      +qa:gov:test script
features/enforce-cycle-gates/            standard 6-file contract
                                         + 06-diff/notes.md
                                         (this sub-contract is
                                         deploy-inert and has no
                                         UI; notes.md is a brief
                                         narrative on what shipped)
```

## Files NOT modified

- Any `backend/`, `Packages/`, or other governed source. This
  sub-contract is purely about the validator script and docs.
- `qa/hooks/pre-push` — already invokes
  `governance-check.mjs`; no change needed.
- `.github/workflows/qa.yml` — same; CI flows transparently.

## Visible runtime behaviour

### `pnpm qa:gov` (the gov-check itself)

Against this sub-contract's own changeset (no UI files):
```
[gov-check] mode=local root=inflx-platform
[gov-check] scanning N changed path(s) vs <base>
[gov-check] no governed paths changed (deploy-inert changeset) ✓
[gov-check]   release evidence for features/enforce-cycle-gates/lock.json present + self-consistent ✓
[gov-check] OK — 0 governed change(s), all contract-backed; release evidence valid. exit 0
```

Against a hypothetical future UI commit WITH all gates satisfied:
```
[gov-check] mode=local root=inflx-platform
[gov-check] scanning N changed path(s) vs <base>
[gov-check]   ↳ governed change backed by approved contract(s): <slug> ✓
[gov-check]   ↳ <slug> mockup_locked=true (by <who>, at <date>) ✓
[gov-check]   ↳ features/<slug>/06-diff/notes.md present (N bytes) ✓
[gov-check]   ↳ <slug> release.maestro_green=true ✓     (only if MOBILE files touched)
[gov-check]   release evidence for features/<slug>/lock.json present + self-consistent ✓
[gov-check] OK — N governed change(s), all gates passed; release evidence valid. exit 0
```

Against a hypothetical future UI commit MISSING mockup_locked:
```
[gov-check] ✗ UI-governed path touched without an approved+complete
            contract carrying mockup_locked: true
              touched: Packages/Mobile/src/screens/Feed.js
              contract: features/some-slug/lock.json
              missing: mockup_locked === true (currently: false)
            fix: pnpm preview:open some-slug, review, set mockup_locked.
            GOVERNANCE.md §4a.
exit 1
```

### `pnpm qa:gov:test` (NEW unit tests)

```
[gov-check-test] scenario 1: deploy-inert (no governed) → expect OK ... ✓
[gov-check-test] scenario 2: backend-only governed + approved contract → expect OK ... ✓
[gov-check-test] scenario 3: UI-governed + approved + mockup_locked=true + notes.md → expect OK ... ✓
[gov-check-test] scenario 4: UI-governed + approved + mockup_locked=false → expect FAIL on Rule 3 ... ✓
[gov-check-test] scenario 5: UI-governed + approved + mockup_locked=true + missing notes.md → expect FAIL on Rule 4 ... ✓
[gov-check-test] scenario 6: MOBILE-governed + released=true + no maestro_green → expect FAIL on Rule 5 ... ✓
[gov-check-test] scenario 7: GOVERNANCE_OVERRIDE set → expect OK (loud) ... ✓
[gov-check-test] === 7/7 scenarios PASSED ===
exit 0
```

## Loud-fail outputs (each rule)

(See `02-workflow.md` failure-paths section for the exact text;
each rule names the touched file, the contract, the specific
missing field, and the fix command.)

## What this shipping means

After this commit lands, **the founder's stated cycle is
machine-unavoidable for UI/Mobile changes**:

- Cannot ship a UI change without seeing the mockup first (Rule 3).
- Cannot ship a UI change without a before/after diff narrative
  (Rule 4).
- Cannot ship a Mobile change without Maestro green (Rule 5).
- Backend changes keep their existing approval requirement (Rule 1)
  + release evidence (Rule 2) without new friction.
- Emergencies have an explicit, loud, recorded override path.
