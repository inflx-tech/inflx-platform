# Impact analysis — enforce-cycle-gates

## What changes

- `qa/scripts/governance-check.mjs` — adds three new rule blocks
  (Rule 3 mockup_locked, Rule 4 06-diff/notes.md, Rule 5
  maestro_green) layered onto the existing Rule 1+2. Adds two new
  regex constants (`UI_GOVERNED`, `MOBILE_GOVERNED`) defining the
  scope of the new rules.
- `qa/scripts/governance-check.test.mjs` (NEW) — in-process unit
  tests covering 7 scenarios. Dep-free; uses fs/path + temp dirs +
  child_process to invoke the validator against constructed state.
- Root `package.json` — adds `qa:gov:test` script.
- `GOVERNANCE.md` — three section updates:
  - §4a Mockup-lock: [RECOMMENDED] → [ENFORCED] for
    `Packages/*/(src|app|components|lib|screens|services)/**`.
  - §4b Before/after-diff: [RECOMMENDED] → [ENFORCED] for the
    same UI-governed paths.
  - §10 Regression: Maestro lane [RECOMMENDED] → [ENFORCED] for
    `Packages/Mobile/src/**` releases (released=true + maestro_green
    must be non-false).
- `CLAUDE.md` — small wording change in the three callout blocks
  from "advisory" to "enforced for UI/Mobile commits".

## Blast radius

- **Production:** zero. No governed source touched.
- **CI:** zero. The `qa/qa.yml` `governance` job invokes the same
  script; the new rules apply transparently.
- **Future UI/Mobile commits:** the new rules MUST be satisfied
  for push to succeed. Friction added for UI/Mobile changes:
  authors must `mockup_locked: true` + author `06-diff/notes.md` +
  (for Mobile) `maestro_green: true`. This is the founder-stated
  cycle, now machine-enforced.
- **Backend-only commits:** zero impact. Same rule-1+2 treatment
  as before. Founders + future agents can still ship backend
  fixes without writing mockups.
- **Override path:** unchanged. `GOVERNANCE_OVERRIDE="reason"` is
  loud, recorded, never silent.
- **Past commits:** immutable; not re-validated.

## Reversibility / rollback

`git revert <commit>` removes the new rules + restores the
prior advisory state. No data risk. Future UI/Mobile commits
would lose the enforcement gates but the conventions still exist;
they'd be advisory again.

## Test plan (live, this turn)

1. **`pnpm qa:gov:test`** — runs the new in-process test scenarios.
   Expect 7/7 PASSED. Specifically:
   - Scenario 1: deploy-inert changeset → OK
   - Scenario 2: backend-only governed + approved contract → OK
   - Scenario 3: UI-governed + mockup_locked + notes.md → OK
   - Scenario 4: UI-governed + mockup_locked=false → FAIL Rule 3
   - Scenario 5: UI-governed + locked, missing notes.md → FAIL Rule 4
   - Scenario 6: Mobile + released=true + no maestro_green → FAIL Rule 5
   - Scenario 7: override env var set → OK (loud, recorded)
2. **`pnpm qa:gov`** against the current working tree (this
   sub-contract's changeset). Expect exit 0 (no UI/Mobile files
   touched; rule-1+2+3+4+5 all satisfied trivially since 3/4/5
   only fire on UI_GOVERNED/MOBILE_GOVERNED triggers).
3. **`pnpm qa`** — 66/C1/gate 0 unchanged (no Playwright spec
   touched).
4. **`pnpm qa:db`** — 382/382 unchanged (no backend touched).
5. **Manual sanity:** read `governance-check.mjs` and confirm:
   - Rules 1+2 unchanged in semantics.
   - Rule 3+4+5 only fire on the new regex matches.
   - Override still bypasses all rules with loud notice.

## Regression risk

- **Main pnpm qa / pnpm qa:db:** ZERO overlap.
- **gov-check itself:** the new rules are layered ADDITIVELY onto
  the existing exit-0 path. Rules 1+2 logic is preserved verbatim.
  Rules 3+4+5 are pure additions that fire only on new conditions.
- **The pre-push hook:** unchanged file, unchanged invocation —
  picks up new rules transparently.
- **CI workflow:** unchanged file.

## Affected systems checklist

- [x] Backend runtime (Render): unaffected
- [x] DB (Supabase): unaffected
- [x] Brand-web / admin-web (Vercel): unaffected
- [x] Mobile (OTA): unaffected
- [x] qa:db lane: unaffected
- [x] main pnpm qa: unaffected
- [x] qa:maestro: unaffected (still advisory at the script level;
      gov-check just adds the maestro_green release-evidence rule)
- [x] dev:doctor / db:dev:* / preview:* / diff:*: unaffected
- [x] gov-check: EXTENDED (the entire point of this sub-contract)
- [x] Existing contracts: validate unchanged (sub-contracts 1-3
      didn't touch UI_GOVERNED; sub-contract 4 satisfied all new
      rules at release time — mockup_locked=true, 06-diff/notes.md
      present, maestro green by manual proof)
