# Impact

**Verdict: phone only. No server change, no migration.**

| Target | What lands | Risk |
|---|---|---|
| Migration | none | **Nil** |
| Render | **nothing** | **Nil** |
| OTA (brand app) | where a draft opens, and the auto-drop | **Medium** |

## Why medium and not low

**The auto-drop removes a brand's work.** That is the right behaviour when an agreement has
lapsed and the wrong behaviour in every other circumstance. Two guards stand between them:

* it only runs once the live list has actually arrived
* it only removes creators absent from that list

If either failed, a brand would open a set and watch their creators disappear. That is why W3
exists, and why a mutation removing the guard is checked.

## What does not change

* The publish gate — both dead-agreement blockers stay as the backstop
* The expiring-agreement warning
* Anything about how a campaign is published

## Rollback

OTA to the previous bundle. Nothing is stored and nothing is sent, so there is nothing to unwind.

## Test-suite position

Mobile jest only. Certified **no-regression**. **Never claimed green.**
