# Mock UI / Screen Preview (Step 4) — Admin role-gate matrix

No UI is being built or changed — this contract pins the **behaviour**
of an existing security gate. There is nothing to mock.

Baseline the reviewer confirms at the Step-5 lock:
- Blocked cases land on the existing `/login` page (brand-web).
- The single valid case (M4) shows the existing "Approval Queue"
  screen (same baseline as A1's `admin-approvals__queue.png`).

Evidence captured at Step 9:
- `screenshots/after/admin-role-gate__m2-redirected.png` (blocked → /login)
- `screenshots/after/admin-role-gate__m4-allowed.png` (valid admin)
