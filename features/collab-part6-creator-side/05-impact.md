# Part 6 — impact

**Chat verdict (one line):** two things the creator already owns but could not see become
visible, and brand search gains two filters — additive reads only, no write path touched,
no migration.

---

## Blast radius

| Area | Change | Risk |
|---|---|---|
| Creator collaboration detail | Returns `agreement_id`, the settled terms, and an allocation summary | **Low** — additive fields on an existing read |
| Brand discovery | Two optional filters on an existing query | **Low** — narrows only; the eligibility conditions are untouched |
| Creator app screens | Terms split into settled / new; allocation line; two filter controls | Low |
| Write paths | **None.** No status changes, no money, no notifications, no new records | None |
| Migration | **None** — `agreement_id` (Part 2) and `alloc_*` (Part 4) already exist | None |

## Why this is unusually low-risk for a creator-facing change

Every value shown is already stored and already authoritative. Nothing is recalculated and
nothing new is decided. The contract's whole content is: **stop withholding facts the
creator's own collaboration already contains.**

The one place that could go wrong is the allocation *summary* disagreeing with the
allocated *product list* — a summary saying "whole store" while the list shows twelve
items would be worse than saying nothing. B5 asserts the two agree, rather than asserting
each in isolation.

## Deliberate non-changes

1. **Cold invites are untouched**, including the full negotiate flow. The settled/new split
   only appears when an agreement actually backs the collaboration; otherwise the screen is
   exactly today's.
2. **The unreachable application flow is left in place**, with a test pinning its absence.
   Deleting the brand-side half would throw away the correct receiving side of a real future
   feature; leaving it undocumented would let it decay into something people assume works.
3. **`publishOpenGroup`'s notification copy is left alone.** It says *"Apply now!"* and
   deep-links to `open_offers`, a screen that exists in neither app — but it has never fired
   (zero open-group sets in production) and correcting it belongs with 6.3, where the
   feature it advertises would actually be built. Recorded, not silently tolerated.

## Regression posture

No existing behaviour is modified — only added to. R1–R3 assert the suite stays green, the
cold-invite negotiate path is unchanged, and no migration was needed.
