# Workflow Definition — Admin approvals: reject with a reason

> Step 3. Each step → a Playwright assertion. Real user behaviour.

## Actor
Authenticated admin on brand-web (seeded, same as A1).

## Preconditions (test-seeded, deterministic)
- Cookie `inflx_token=qa-admin` (passes middleware) + localStorage
  `inflx_user{role:'admin'}` / `inflx_token` (passes layout gate).
- Stubs: `/auth/refresh`, `/admin/stats`, `/admin/queue/brands`
  (one pending brand `br_1` "QA Diner"), `/admin/queue/influencers`
  (empty), `PATCH /admin/brands/br_1/status` → success.

## Workflow A — reject with a predefined reason
1. Admin opens `/admin/approvals`; pending "QA Diner" row visible.
2. Admin clicks **Reject** → the reason panel appears with reason chips.
3. Admin clicks the chip **"Duplicate account"**.
4. Admin clicks **Confirm Reject** → `PATCH /admin/brands/br_1/status`
   fires with body `{ status:'rejected', rejection_reason:'Duplicate account' }`.
5. Toast **"Brand rejected successfully"** appears.

## Workflow B — "Other" custom reason
1–2. As above; click **Reject**.
3. Click the **"Other"** chip → a textarea appears.
4. Confirm Reject is **disabled** until text is entered.
5. Type "Spam signup" → click Confirm Reject → PATCH body
   `{ status:'rejected', rejection_reason:'Spam signup' }`.

## Workflow C — guard (no reason selected)
1–2. Click **Reject** (panel open, no chip selected).
3. **Confirm Reject is disabled**; attempting it fires **no** PATCH.

## Success definition
SUCCESSFUL only if: A → PATCH carried the exact predefined reason +
success toast; B → PATCH carried the typed custom reason; C → no
PATCH issued while no reason is chosen. Rendering the panel is not
success.

## Failure / edge
- (Covered by A1 already) PATCH failure → error toast. Not repeated
  here to avoid redundant coverage.
