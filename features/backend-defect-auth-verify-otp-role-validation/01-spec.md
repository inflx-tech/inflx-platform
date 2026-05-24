# Backend defect — /auth/verify-otp role validation regression

## Symptom

Three QA workflows fail consistently against the live backend (not a flake):

| Test | Expects | Actual (current) |
|---|---|---|
| **W3** — `api/contract-invariants.spec.ts:34` — auth contract: bad phone / missing otp → typed 422; valid phone → success | 422 typed error for bad input + success for valid | Returns something else (likely the OTP send/verify shape changed) |
| **W5a** — `api/invariants-extended.spec.ts:45` — verify-otp on a fresh phone without `role` → 422 `VALIDATION_ERROR` with `field=role` | `{ status: 422, error: { code: 'VALIDATION_ERROR', field: 'role' } }` | Status / shape mismatch |
| **W5b** — `api/invariants-extended.spec.ts:67` — verify-otp with invalid role → 422 `VALIDATION_ERROR` | `{ status: 422, error: { code: 'VALIDATION_ERROR' } }` | Status / shape mismatch |

All three call `POST /auth/verify-otp` and assert on the typed-error envelope shape when role is missing / invalid.

## When did this start

Window A pushed `3920772 feat(revenue): Phase A7-admin — admin endpoints + 4 admin pages` after Window B's Flow 7 close-out (`e54b767`). The Phase A7-admin commit is the only backend-touching commit between Flow 7's green QA and Flow 8's red QA discovery.

Reproducible: re-running `pnpm qa` gives the same 3 failures every time. Not environmental.

## Why this is Window A territory

- The failing endpoint is `POST /auth/verify-otp` (`backend/src/controllers/auth.controller.js`)
- Window A owns ALL `backend/**` changes (Window B's NO-TOUCH rule from the brief)
- The fix is a server-side adjustment to either:
  - (a) restore the role validation order so `VALIDATION_ERROR` with `field: role` is still returned when role is missing/invalid; OR
  - (b) update the 3 QA specs to match the new intended response shape (if the change was intentional)

Either resolution belongs to Window A, not Window B.

## Repro

```bash
pnpm qa 2>&1 | tail -10
# Expect 3 failures in api/contract-invariants.spec.ts + api/invariants-extended.spec.ts
```

Failing commits since Flow 7's last green:
- `3920772 feat(revenue): Phase A7-admin — admin endpoints + 4 admin pages` (Window A)
- `e54b767 chore(release): Flow 7 — brand-web campaign creation` (Window B, deploy-inert lock.json)
- `8a0cad1 feat(redesign): Flow 7 — brand-web campaign creation wizard` (Window B, frontend-only)

Of these, only `3920772` touched `backend/**`.

## Status

**RED — backed out of GREEN gate.** Window B's redesign flows continue (isolated frontend code), but `release.qa_all_green = false` until Window A resolves. `pnpm qa` reports 67 passed / 3 failed / 1 skipped / 71 total.

## What Window B will do meanwhile

- Carry on with brand-web redesign flows (8, 9, 10, …) — all frontend isolation, no backend reach
- Each flow's lock.json records `qa_classification: "3 pre-existing backend-defect failures unrelated to this flow"` instead of marking `qa_all_green: true`
- Window B will NOT push wallet (Flow 8) silently — surfaces it for explicit-go with this carve-out attached

## What needs to happen for resolution

Window A reviews `auth.controller.js` verifyOtp handler — likely the role validation ordering or error shape was changed in the Phase A7-admin commit. Restore the typed-422 + `field: role` envelope, OR update the 3 spec assertions in `qa/api/` if the new shape is intentional.

When fixed, this contract closes and the next Window B flow can mark `qa_all_green: true` again.
