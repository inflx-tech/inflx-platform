# Impact

**Verdict: a deletion. One strip, one component export, one vocabulary. Phone only.**

| Target | What lands | Risk |
|---|---|---|
| Migration | none | **Nil** |
| Render | **nothing** | **Nil** |
| Vercel | **nothing** | **Nil** |
| OTA (brand app) | the campaign screen, minus a strip | **Low** |

## What could bite

**Only the prime action.** It shares a helper with the rail, so the removal has to take the
stage half without taking the action half. If it went too, a draft campaign would lose its
*Fund wallet & publish* button — the one thing mobile gained on this screen.

R-5 covers every status for that reason.

## Rollback

OTA to the previous bundle. Nothing is stored and nothing is sent, so there is nothing to unwind.

## Test-suite position

Mobile jest only; unaffected by the backend database outage. Certified **no-regression**.
**Never claimed green.**
