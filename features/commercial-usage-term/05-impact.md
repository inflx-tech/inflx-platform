# Impact

**Verdict: one optional term on the agreement model. No migration, no endpoint change.**

| Target | What lands | Risk |
|---|---|---|
| Migration | **none** — terms live in `terms_json` | **Nil** |
| Render (`backend/src`) | one term, one validator, one describer | **Low** |
| OTA | **nothing yet** | **Nil** |

## Why no migration

Agreement terms are stored as `collab_agreements.terms_json`. A new term is a new key in JSON —
nothing to alter, nothing to backfill, and every existing agreement stays valid because the term
is **optional**.

## What is NOT built yet

⚠️ **No screen asks for it.** A brand cannot yet state commercial usage from the app, and she
cannot yet see or counter it. The model accepts it; the surfaces do not offer it.

That is deliberate — the model is the piece the four surfaces must agree on, and getting it
wrong there would mean fixing it four times. But **until the screens land, this changes nothing
a user can see.**

## Rollback

Revert `backend/src`. Any agreement carrying a usage term keeps it in its JSON, harmlessly
ignored.

## Test-suite position

Executing checks via `scripts/run-test-file.js`. Certified **no-regression**. **Never claimed
green.**
