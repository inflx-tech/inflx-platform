# Mock UI / Screen Preview (Step 4) — B2b

Substrate / harness work — no UI, nothing to mock.

Reviewer confirms at the Step-5 lock:
- Docker-daemon-running is a HARD precondition for Step 7+
  (verified blocker: daemon currently down). Lock approval implies
  Docker will be started before implementation.
- Separate gate/report lane is the chosen design — DB status never
  merges into main GREEN.
- Substrate success = Docker up + 53 migrations apply 0-error +
  jest runs + DB lane reports truth. Legacy jest failures are
  tracked findings, NOT a B2b blocker.
- A down/unrun DB lane must read "FAIL"/"NOT EXERCISED", never
  blank or implied-green (C1 governance extended to the new lane).
