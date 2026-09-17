# Before / after

No mockup round: no screen is added, and the only visual change is an error line inside a sheet
that already reserves a place for errors.

## Before

| | |
|---|---|
| The brand taps **Sign and lock ₹4,000** | The server refuses with 422 |
| She sees | Nothing. The toast renders behind the modal |
| The sheet | Stays open, looking as though it reopened |
| The contract | `pending_brand`, as it had been all along |

## After

| | |
|---|---|
| The same tap on a Hybrid set with no content | Signs. ₹4,000 locked, ₹1,000 released to Asha, collaboration active |
| Any refusal | Appears under the tick boxes, in the sheet, which stays open |

## The rules decided a known divergence

`item7-agreement.test.js` already carried a note from build time: deliverables.model treats Hybrid
as content-buying "while rules v1.20 §21 says…". It was written down and left. v1.21 §7 is
explicit — Hybrid's negotiable terms are the fixed fee and the commission, with no deliverables —
so the model was wrong and is now right. `CONTENT_REQUIRED_GOALS` is engagement alone.

## Evidence

- **4 new model tests**: Pay for Content must name content; **Hybrid must not**; a Hybrid set that
  names content still gets it; Pay for Sale unaffected.
- **1 new end-to-end test**: a Hybrid set with no formats countersigns, locks ₹4,000 with **no**
  campaign fee (§9), and releases ₹1,000 into her wallet (§10).
- **1 new mobile test**: a refused signature shows the reason inside the sheet, and the sheet stays
  open.
- Backend **221 failed / 1096 passed** against **221 / 1091** before, diffed by test name:
  **0 newly broken**. Mobile **549 passed / 0 failed**.

## One thing found on the way

The first version of the error line was applied to three sheets by a careless replace, including
the decline sheet, which takes no such prop — the suite caught it immediately. The creator's sign
sheet, though, genuinely has the same defect, so it was wired properly rather than reverted: her
signature can be refused too, and she could not see why either.
