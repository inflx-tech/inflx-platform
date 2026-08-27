# Stage 4 — workflow prediction

What the boards predict happens when the founder walks `02-workflow.md` on two handsets.
Written **before** implementation so `06-diff/` has something to be measured against.

```bash
pnpm preview:open stage-4-the-shoot
```

---

## Predicted

| Step | Panel | Prediction | What I predict goes wrong first |
|---|---|---|---|
| W1 the door | ① | step 3 opens the shoot on both phones | — |
| W1-4 the list | ② | four shoots, needs-you first | **The list may be the surprise.** Four shoots is small; on a real brand with twenty it is the most useful screen in the stage, and on the practice world it may look thin |
| W2 the window | ③ | the range shows, with the reason | **The reason line is the risk.** *"post-by minus two days"* is a rule the brand never set. If it reads as arbitrary, it needs the sentence, not the maths |
| W2-6 the cap | ③ | third counter refused | **Never been exercised.** The counter is enforced and has never run — expect this to be where a real bug appears |
| W3 the parcel | ④ | the Stage 2 picker opens, grouped, with pictures | — |
| W4 per item | ⑤ | three ticks, one flag | **The likeliest wording failure.** If *"you don't have to chase it"* is not believed, she will message the brand anyway and the screen has failed |
| W5 shortfall | ⑥ | resend or drop, both offered | — |
| W6 finishing | — | receipt no longer completes the shoot | **The highest-risk change.** Watch step 3 on BOTH phones after the parcel lands and before she marks it done |
| W7 the diary | — | every action, oldest first | **It will be nearly empty** on existing shoots — the log has 0 entries because the practice world was seeded, not driven. Only actions taken during the walk will appear |

---

## The three predictions most likely to be wrong

1. **That the eight endpoints work.** They are tested and have **never been driven by a
   person** — no visit has a slot, and the log is empty. "Live" here means it exists, not that
   it has been used. Expect the first real exercise to find something.
2. **That splitting receipt from completion is invisible.** It changes the field Stage 3's step
   number reads. If step 3 does not stay current after a parcel lands, that is the bug this
   stage most deserves to be judged on.
3. **That a shortfall reads as the brand's problem.** Everything about the design says it is.
   Whether a creator *believes* it is a wording question, and only a person can answer it.

---

## What the boards deliberately do not predict

* Whether the goods actually arrive — that is a courier, not software
* What she shoots — her craft, and the one thing this stage must never touch
* Anything after the shoot — Stage 5

---

## How this is checked afterwards

`06-diff/notes.md` records, per panel: promised, built, **diverged**, and what to check.
Divergence is expected. Silent divergence is not.
