# The publish gate stops arguing with the wizard

**Founder, 2026-08-28**, on the Review screen with Publish greyed out: *"Here it is given three
red things... it is asking publish and fix it back... what is this."*

Three blocks. **Two of them should not have been there.**

---

## 1. What he saw, and what each one was

| Block | Was | Verdict |
|---|---|---|
| 🔴 *"Test set" has no shopper offer* | **Blocker** — greyed Publish | ⚠️ Wrong. He had asked for offers to be optional |
| 🟠 *Divya's agreement expires in 3 days* | Warning | ✅ Correct. Untouched |
| 🟠 *"Test set" has no creators in it yet* | Warning | ⚠️ Wrong. His own header said **Creators 1** |

---

## 2. The offer blocker — my incomplete follow-through

Batch A made the wizard **save** a set without an offer, on his instruction: *"dont make this
mandatory... if brands want they give otherwise they dont."*

**I never touched the rule that refuses to publish without one.** So the app told him it was
optional and then refused. That is the app arguing with itself.

And it got worse in Batch B. The check reads `sd.offer` — the **set-level** offer — after the
offer moved to the creator. So a brand who gave one creator an offer on her own row **could not
clear it at all**; the only way to satisfy it was through a control that should no longer exist.

**Fixed on both sides:** a warning, not a blocker, and read per creator.

The server's own check was already per-creator (`members.some(ci => ci.offer_type ||
ci.brand_offer_id)`) — only its severity was wrong.

## 3. The empty-set warning — the server describing a draft it has never been sent

Creators are pencilled into the wizard's local draft and **only sent at Publish**
(`BrandCampaignReviewScreen` loops `inviteInfluencer` after the button). So before publishing,
the server looks at this campaign, sees a set with nobody in it, and says so.

The screen filtered that out of the server's **blockers** and let it straight through as a
**warning**. So it appeared, directly under a header reading *Creators 1*.

⚠️ **A screen that argues with its own header teaches a brand to stop reading it.**

Both `EMPTY_SET` and `NO_SHOPPER_OFFER` are now dropped from the server's list until the
campaign is published. Everything else the server says still gets through — the wallet, and any
creator already invited. Suppressing the whole list would have been the lazy fix and would have
hidden a real refusal.

## 4. Two offer controls — mine, from yesterday

Batch B added *"Give her an offer"* on each creator, as he asked. **I did not remove the
set-level picker.** Two controls doing one job — the fault this programme has already cleaned up
four times, introduced by me the day before he found it.

The set-level picker, its handlers, its state, its offers fetch and its own `OfferBuilderSheet`
mount are all gone. What remains under **② What their followers get** is one sentence saying the
offer is given per creator — because deleting the section outright would leave a brand who used
the old wizard hunting for a control that moved.

## 5. "See what a shopper pays" — kept, moved

He asked for this button on 2026-08-27, having first asked for it removed and then withdrawn
that once told it is the only route into `BrandBasketPreview`.

It lived inside the set-level section being deleted, so it moves to **her sheet** — which is a
better home anyway. At set level it could only guess whose basket it was pricing. On her sheet
it is a real offer against a real creator's commission.

## 6. Out of scope

* The expiring-agreement warning. It was right.
* The four real blockers — no allocation, empty allocation, missing agreement, dead agreement.
  This relaxes **one** rule, not all of them, and a check asserts the other four are still
  refusals.
* Anything about how offers are built. That was Batch B.
