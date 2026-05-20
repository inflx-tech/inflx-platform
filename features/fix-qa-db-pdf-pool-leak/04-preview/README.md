# Preview (Step 4) — fix qa:db PDF pool leak

Tooling-driven backend fix; **no UI**. The "preview" is the
diff between the qa:db log signatures before and after the fix.

## Reviewer note (Step-5 lock)

- **PRODUCTION-IMPACTING per gov-check** (changes
  `backend/src/controllers/contract.controller.js`), but the
  change is gated by `env.NODE_ENV === 'test'`. Production
  brand-approve behaviour is byte-identical to today.
- Founder GO 2026-05-20 on record: "Go with your recommendation"
  (option 3 of the 4 surfaced — NODE_ENV-gated await).
- Three-line surgical change. No new dependencies, no new
  module imports.

## Approval (Step-5)

Self-locked under standing autonomy + founder explicit go on the
production-impacting decision. Same governance posture as
`fix-open-group-publish-mode` (precedent 2026-05-19).

## Step 7 — RESULT — <pending implementation + qa:db × 2 + main qa>

```
fix       : contract.controller.js:1153 wrap+await under NODE_ENV='test'
qa:db r#1 : <pending — expect 382/382>
qa:db r#2 : <pending — expect 382/382 deterministic>
main qa   : <pending — expect 66/C1/gate 0>
gov-check : <pending — expect exit 0; rule 1+2; 3/4/5 don't fire>
deploy    : PRODUCTION-IMPACTING per path; runtime prod effect ZERO
```
