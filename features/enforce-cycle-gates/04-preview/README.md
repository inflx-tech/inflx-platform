# Preview (Step 4) — enforce-cycle-gates

Tooling contract; no UI. The "preview" is the new gov-check
loud-fail outputs and the unit-test scenarios — documented in
`03-expected-outputs.md`.

## Reviewer note (Step-5 lock)

- **DEPLOY-INERT.** Only `qa/scripts/governance-check.mjs` +
  `qa/scripts/governance-check.test.mjs` (new) + small
  GOVERNANCE.md/CLAUDE.md addenda. No governed source touched.
- **Advisory → ENFORCED transition.** Sub-contracts 1-4
  introduced the mockup-lock + 06-diff + Maestro conventions; this
  sub-contract promotes them to machine-enforced for UI/Mobile
  commits. Backend-only commits keep the existing rule-1+2
  requirements unchanged.
- **Override unchanged.** `GOVERNANCE_OVERRIDE="reason"` still
  bypasses any check; loud + recorded.
- **Self-test in-turn.** `qa:gov:test` exercises 7 scenarios
  covering both pass and fail paths for each new rule, so the
  enforcement logic is proven before this commit ships.

## Approval (Step-5)

Self-locked under standing autonomy: deploy-inert, sub-contract
order pre-agreed; founder said "close the loop" referring to this
final sub-contract. Last of Phase 2.

## Step 7 — RESULT — RELEASED 2026-05-20T11:29Z

```
fix       : governance-check.mjs gains 3 new rules (Rule 3
            mockup_locked + Rule 4 06-diff/notes.md + Rule 5
            release.maestro_green for Mobile); governance-check
            .test.mjs new 7-scenario in-process runner;
            GOVERNANCE.md §4a/§4b/§10 [RECOMMENDED]→[ENFORCED];
            CLAUDE.md callouts updated; root pnpm +qa:gov:test
self-test : pnpm qa:gov:test 7/7 SCENARIOS PASSED (deploy-inert
            OK; backend-only OK; UI-locked-clean OK;
            UI-no-mockup FAIL Rule 3; UI-no-notes FAIL Rule 4;
            Mobile-no-maestro_green FAIL Rule 5;
            GOVERNANCE_OVERRIDE bypass OK loud)
gov-check : pnpm qa:gov against this sub-contract's own changeset
            → exit 0 (DEPLOY-INERT; no UI/Mobile paths; new
            rules trivially pass on this changeset)
regression: pnpm qa GREEN 66/C1/gate 0 + pnpm qa:db GREEN
            382/382 / 28 suites / 54 migrations / 240.8s
            (DB-LANE=PASS, qa/artifacts/_freshbox_qadb.log).
            ZERO regression on either lane.
deploy    : DEPLOY-INERT — git push origin main (Render/Vercel
            deploys see no governed change → no behaviour
            change). Cycle now machine-unavoidable for every
            future UI/Mobile commit; GOVERNANCE_OVERRIDE=
            "reason" remains the loud-recorded escape hatch.
```
