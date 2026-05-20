# Diff notes — enforce-cycle-gates

Tooling change, no UI. The "diff" for this sub-contract is the
behaviour of `pnpm qa:gov` before and after.

## What was implemented

`qa/scripts/governance-check.mjs` gained three new rule blocks
layered onto the existing Rule 1 (governed-path needs approved
contract) and Rule 2 (released=true needs evidence):

- **Rule 3** — UI_GOVERNED changes require `mockup_locked: true`
  on the backing approved+complete contract.
- **Rule 4** — UI_GOVERNED changes require non-empty
  `features/<slug>/06-diff/notes.md` on the backing contract.
- **Rule 5** — MOBILE_GOVERNED changes that flip
  `release.released = true` require `release.maestro_green !==
  false`.

A new in-process test runner `qa/scripts/governance-check.test.mjs`
exercises 7 scenarios covering both pass and fail paths for each
new rule plus the existing override mechanism.

GOVERNANCE.md §4a, §4b, and §10 had their tags changed from
**[RECOMMENDED]** to **[ENFORCED]** for the UI/Mobile scope.
CLAUDE.md's mockup-lock / before-after-diff / mobile-verify
callouts had "advisory" updated to "enforced for UI/Mobile commits".

## What matches the (non-existent) mockup

n/a — tooling contract, no UI to mockup. The visual artefact is
the gov-check console output, both pass and fail paths,
documented in `03-expected-outputs.md`.

## What diverged from spec

Nothing — the implementation matches the spec's three rules
exactly. The `qa:gov:test` runner is a slight enhancement over
the spec's "self-test in this turn" language, providing a durable
test artefact rather than one-shot agent-run verification.

## Things the founder should check

- Run `pnpm qa:gov:test` whenever in doubt that the enforcement
  works — it covers each rule in isolation.
- After this commit lands, the FIRST genuine UI/Mobile feature
  contract that goes through the cycle will hit the new gates at
  push time. If a gate fires unexpectedly, the loud-fail names
  the file + contract + missing field + fix command.
- The `GOVERNANCE_OVERRIDE="reason"` escape hatch is intentional
  for emergencies. Use it sparingly; every override is logged
  visibly in the push output.

## Out-of-band changes

None. This sub-contract is narrowly scoped to gov-check
enforcement + the supporting test runner + doc updates.
