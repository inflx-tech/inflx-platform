# Workflow

## What happens now

1. Kanchi Silks opens the Hybrid agreement with Asha — ₹4,000 fixed plus 10% commission, no content
   named. She types her name, ticks both boxes, taps **Sign and lock ₹4,000**.
2. It signs. ₹4,000 is locked (no campaign fee on a Hybrid fixed amount, v1.21 §9), **₹1,000 — the
   first 25% — is released to Asha**, and the collaboration goes active.
3. The sheet closes.

## When a signature is refused

Whatever the reason — a short balance, a Pay for Content set with no content named, an agreement
already signed — the sentence appears **inside the sheet**, under the tick boxes, and the sheet
stays open. She can read it, fix it, and try again. It is never announced from behind the modal.

## Which Aims must name their content

| Aim | Must name content? | Why |
|---|---|---|
| Pay for Content | **yes** | the money is buying content; it has to say what content |
| Hybrid | no | fixed money plus the Pay-for-Sale shoppable workflow (v1.21 §7) |
| Pay for Sale | no | commission only |

A Hybrid set that names content anyway still gets those deliverables.

## Order of build

1. `deliverables.model` — split "must name content" from "may carry content".
2. Both sign sheets take a `serverError`; both screens put the refusal there instead of a toast.
3. Tests: the rule at the model, the signature end to end, and the sheet keeping its refusal visible.
