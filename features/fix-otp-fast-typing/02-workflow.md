# Workflow — fix-otp-fast-typing

## Actor
Brand user signing in via `/login`.

## Preconditions
- User already submitted phone number, mock OTP sent (`000000`).
- Page is on STEP 2 (OTP entry).

## Workflow steps — fast keyboard typing (the regression path)
1. User clicks box 0, holds a digit key, releases — focus jumps boxes
   1 → 2 → 3 → 4 → 5 as fast as keystrokes arrive.
2. Each keystroke triggers `onChange` with the latest single digit.
3. The functional-update `setOtp(prev => …)` guarantees each handler
   reads the freshest committed state, so digits aren't lost.
4. After the 6th keystroke, `otp.length === 6`, the "Verify & continue"
   button activates.

## Workflow steps — paste / SMS autofill (the new path)
1. User long-presses box 0 → paste menu → paste `123456`.
2. `e.target.value = "123456"`; `raw.length > 1` branch fires.
3. All 6 boxes fill from box 0; focus jumps to box 5.
4. "Verify & continue" activates.

## Workflow steps — backspace navigation (unchanged)
1. User presses Backspace in empty box `i`. Focus moves to box `i-1`.

## Success
- All 6 keystrokes register in order, never lost.
- Paste of 6-digit OTP fills all 6 boxes in one paste action.
- `pnpm qa` `auth.spec.ts` continues to pass (already does — that test
  triggers Send OTP only, no actual OTP entry; not a regression test
  for THIS fix but a guard that the page still loads).

## Failure modes
- User types a non-numeric character → regex strip leaves empty
  string → no box update → focus stays put. Unchanged behaviour.
- User pastes longer than 6 chars → `slice(0, 6)` truncates. Unchanged.
- Stale-closure recurrence in some future React upgrade → still
  protected by functional-update form.
