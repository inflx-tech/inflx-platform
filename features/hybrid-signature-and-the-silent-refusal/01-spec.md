# The signature that kept being refused, silently

**Found:** founder, 2026-09-17 — *"even after signing the agreement as a brand, still it is asking
again and again, popup is coming even after sign… frequently it is opening even after sign."*

---

## 1. It was never signed

Read from production first. `INFLX-2026-00003` — hybrid, ₹4,000, Asha and Kanchi Silks — was still
`pending_brand`, with her signature on it and the brand's missing. Every tap was being **refused by
the server**. Nothing was looping; nothing reopened by itself. The sheet never closed because the
signature never happened.

## 2. Two defects, and the second is why it looked mad

**a. A Hybrid collaboration with no content formats cannot be countersigned.**

`deliverables.model` counts Hybrid as content-buying (`CONTENT_BUYING_GOALS = ['engagement',
'hybrid']`), so with `formats_json: []` it returns an error, and `brandSignInTx` turns that into a
422. The set in question has no formats, so the signature was impossible.

**This is wrong against the rules.** v1.21 §7, what each side may counter:

| Aim | Negotiable terms |
|---|---|
| Pay for Content | fee, **deliverables (content types and counts)**, usage rights |
| **Hybrid** | **fixed fee and commission percentage** |
| Pay for Sale | commission percentage |

and the Hybrid definition: *"Sale/Shoppable workflow identical to Pay for Sale, while upfront fixed
money follows the Pay-for-Content-style 25%/25%/50% milestone payment."*

So Hybrid is Pay-for-Sale work plus fixed money. Its work requirement is shoppable posts, not
content formats. **A Hybrid collaboration with no content named is complete, not broken.**

> The divergence was already known: `item7-agreement.test.js` carries a note from build time
> saying deliverables.model treats Hybrid as content-buying "while rules v1.20 §21 says…". It was
> written down and never decided. This decides it, the rules winning.

**b. The refusal was invisible.** The screen announced it with a toast — which renders on the
screen, **behind the modal sheet**. So the server said no, in words, and the brand saw nothing at
all: the sheet just sat there. She typed her name again, ticked again, tapped again.

That is the whole of *"it keeps coming back"*. The sheet was never reopening. It had never closed.

## 3. What changes

**Backend** — `deliverables.model.js`: separate *may carry content* from **must name content**.
`CONTENT_REQUIRED_GOALS = ['engagement']`. A Hybrid set with no formats signs and creates no
deliverables; a Hybrid set that **does** name formats still gets them, because the brand asked.
Pay for Content is unchanged — content that is paid for must be named.

**Mobile** — the refusal appears **inside the sheet**, where she is looking, and the sheet stays
open so she can act on it. Applied to both signature sheets: the brand's, and the creator's, which
had the identical problem.

## 4. What does not change

The money. Locking, the 25%, the tranches, the campaign-fee rule — none of it is touched. A Hybrid
lock is the fixed money alone with no campaign fee (v1.21 §9), and the first 25% of the upfront
amount reaches her at the signature (§10). Both are asserted in the new end-to-end test rather than
assumed.

## 5. Classification

**Production-impacting.** Backend + brand app + creator app. One push, two OTAs. No migration.
