# Mock UI / Screen Preview (Step 4) — Admin navigation sweep

No UI built or changed. This contract verifies that existing admin
pages mount; there is nothing to mock and no visual baseline to set.

Reviewer confirms at the Step-5 lock:
- The 18 routes listed in 01-spec are the intended sweep set.
- "Loads" = no redirect + admin shell visible + no uncaught error
  (per 02-workflow) is the accepted success bar for a breadth net.
- No per-route screenshots by design (failure-only Playwright
  evidence) is acceptable for this contract.
