# The same creator, in more than one set of a campaign

**Found:** founder, 2026-09-17, at Review and send —
*"1 creator can't be invited · Asha M. (practice) is already in another set of this campaign."*
*"as per my knowledge in our business rules this is not present."*

**She was right.**

---

## 1. What the rules say

v1.21, twice, unambiguously:

> **§148** — "The same Creator may belong to multiple Sets within the same Campaign, for example
> for different Aims or different negotiated arrangements."

> **§268** — "A Creator who is live in **this Set** cannot be chosen again. A Creator whose earlier
> invitation ended — declined, rejected, expired, withdrawn, removed, or moved to another date —
> may be invited again, **to this Set or to another Set of the same Campaign**, while there is
> still time."

The blocked case was exactly the one §148 names as allowed: Asha on a **Pay for Content** set,
being added to a **Pay for Sale** set of the same campaign. Different Aims, which is the example
the rule itself gives.

## 2. Where the rule came from

Not from the rules. `invitationSend.service.js` carried a second check after the same-set one,
refusing her anywhere else in the campaign. It predates item 4; item 4's approval **Q6** only
*narrowed* it —

> "Yes, fix the cross-set bug here. Exclude the dead statuses… This unblocks moving a creator who
> asked for a different date."

— so a deferred creator could be moved. The block itself was never questioned, and never approved.
It was also mirrored in the open-group broadcast, which excluded anyone live anywhere in the
campaign.

And a test asserted it: `item4-campaigns-sets.test.js` check 22 required a **409** for a creator
live in Set A being invited to Set B. A test can hold a wrong rule in place as firmly as code.

## 3. What changes

**One rule survives: one live row per set.**

| Situation | Before | After |
|---|---|---|
| Live in **this** set, invited again | refused | **refused** (§268) |
| Live in **another** set of the campaign | refused | **allowed** (§148) |
| Ended in another set (declined, expired, deferred, withdrawn, removed) | allowed | allowed |
| Open-group broadcast | skipped anyone live anywhere in the campaign | skips only those live **in this set** |

Two enforcement points, both corrected: `services/invitationSend.service.js` and the broadcast
query in `controllers/campaign.controller.js`.

## 4. What does not change

Her own settings still decide. A creator whose invitation settings rule the set out is still
refused, with her own reason — that is item 2's door, and it is untouched. This contract removes
one rule the platform invented; it removes nothing a creator chose.

## 5. Classification

**Production-impacting** — backend only. One push. No migration, no OTA: the phone never enforced
this, it only displayed the server's refusal.
