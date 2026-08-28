# Before / after

**Three blocks on the Review screen. Two should not have been there, and both were mine.**

---

## 1 · The offer stopped blocking

`NO_SHOPPER_OFFER` was a refusal on both the phone and the server. It is now a warning on both.

That was **incomplete follow-through, not a new decision.** Batch A changed the wizard to save a
set without an offer, on the founder's instruction. I never touched the rule that refuses to
publish without one — so the app told him it was optional and then refused.

⚠️ Batch B made it unsatisfiable. The check read `sd.offer`, the **set-level** offer, after the
offer had moved to the creator. A brand who gave one creator an offer on her row could not clear
it at all: the only control that could satisfy it was one that should no longer exist.

It now reads `sd.creators.some(c => c.offer) || !!sd.offer` — per creator, with the old
set-level field still honoured for a draft saved before the change.

The server's check was already per creator. **Only its severity was wrong.**

## 2 · The server stopped describing a draft it has never been sent

Creators live in the phone's draft and are **only sent at Publish**. So before publishing, the
server sees a set with nobody in it and says so — which appeared directly under a header reading
**Creators 1**.

The old code filtered `EMPTY_SET` out of the server's **blockers** and let it through as a
**warning**. Both `EMPTY_SET` and `NO_SHOPPER_OFFER` are now dropped from the server's list
until the campaign is published.

⚠️ **Only those two, and only until publish.** The wallet and any already-invited creator still
come through. Suppressing the whole server list would have been the lazy fix and would have
hidden a real refusal.

## 3 · Two offer controls became one

Batch B added *"Give her an offer"* per creator and **left the set-level picker in place.** Two
controls doing one job — the fault this programme has already cleaned up four times, introduced
by me the day before the founder found it.

Removed: the picker, `onChooseOffer`, `onBuildOffer`, `chosenOffer`, `builderOpen`, the `offers`
state, the `getOffers()` call on every wizard entry, and the wizard's own `OfferBuilderSheet`
mount.

What remains under section 2 is one sentence saying the offer is given per creator — because
deleting it outright would leave a brand who used the old wizard hunting for a control that
moved.

## 4 · "See what a shopper pays" kept, and improved by moving

It lived inside the deleted section. It moves to **her sheet**.

At set level it could only guess whose basket it was pricing. On her sheet it is a real offer
against a real creator's commission — which is what the Batch B board said its better home would
be, before this made it necessary.

---

## What deliberately did not change

* **The expiring-agreement warning.** It was the one of the three that was right.
* **The four real blockers** — no allocation, empty allocation, missing agreement, dead
  agreement. This relaxes **one** rule. A check walks the other four and asserts each is still a
  refusal, and a mutation that demotes `NO_ALLOCATION` alongside it is caught.

## Verification

| What | How |
|---|---|
| The four fixes | **19 checks** in `publishGateConsistency.test.js` |
| Are they real? | **Mutation-tested. 7 deliberate breakages, 7 caught** |
| Regression | Full mobile suite: **42 suites, 455 tests** |

⚠️ **Two mutations were not caught first time**, and both were my checks being weak:

* the preview-button check matched **its own comment**, which quotes the button's label — the
  same trap as Batch A's card check and Stage 4's shot-list check. Comments are now stripped.
* one mutation regex did not apply at all, so it proved nothing until rewritten.

Also rewritten, not deleted: a Batch A assertion that the set-level picker and the preview live
on the wizard. Both moved, so it now asserts they are on **her sheet** and that the wizard has
exactly one way in.

Certified **no-regression**. **Never claimed green.**

## What to check

⚠️ **W5 is the one that matters.** Leave a creator with nothing to sell and confirm Publish is
still refused. Relaxing one rule next to four others is exactly how a fifth goes quiet.
