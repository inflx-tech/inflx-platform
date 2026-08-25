# Stage 3 — workflow prediction

What the boards predict will happen when the founder walks `02-workflow.md` on two handsets.
Written **before** implementation so the diff in `06-diff/` has something to be measured
against.

```bash
pnpm preview:open stage-3-watch-the-work-happen
```

---

## Predicted, level by level

| Step | Panel | What I predict | What I predict goes wrong first |
|---|---|---|---|
| W1 tab badge | ② | reads **8** and it is right | Nothing technically. But **8 is a big first number** for a brand who has never seen one — the risk is that it reads as eight problems rather than eight things to look at |
| W2 campaigns | ② | 3 and 2, ended campaign bare | — |
| W3 sets | ③ | campaign-level section says *nothing owed*; sets show 2 and 1 | **The empty campaign-level section is the risk.** A heading with nothing under it may read as a loading failure. It may need to disappear entirely rather than say "0" |
| W4 creators | ④ | the set's 2 explained as *"2 creators have nothing to sell"*, steps 3 and 4 on the rows | This is where the ladder either convinces or does not. If the brand cannot see that 2 + 0 = 2, the level-own section is in the wrong place |
| W5 spine | ⑤ | six steps, step 3 current, step 4 with no button | **The most likely wording failure.** "Not yours to review" has to read as reassurance, not as a refusal |
| W6 inside a step | ⑥ | step 3 opens its history and says Stage 4 brings the rest | A brand may tap expecting to *do* the shoot. If the note is missed, this reads as broken |
| W7 creator | ⑤ right | the same step 3, and the old grey spine gone | **Her screen is the one that changes most.** If the new spine ever fails to load and renders blank, she is worse off than today |
| W8 reconciliation | ⑦ | every number on the path is on a screen | — |

---

## The three predictions most likely to be wrong

1. **That a badge of 8 is welcome.** It may need a gentler first impression — a cap, a
   "things to look at" framing, or no tab badge until the brand has opened the ladder once.
   This is the founder's open question in the spec, and the walk is what answers it.
2. **That "own" and "beneath" read as one number on a phone.** The reconciliation is obvious
   on a wide board and may not be on a 300px screen. If it is not, the fix is to *label* the
   level-own section with its count, not to hide it.
3. **That the creator wants a spine at all.** She is filed under a stage in her Collabs tab
   already. If the six steps duplicate what her list header says, the honest answer may be to
   show the step **number** without the whole rail.

---

## What the boards deliberately do not predict

* Whether the shoot works — Stage 4
* Whether content goes live in order — Stage 5
* Whether the new campaign-level items fire sensibly against real volume. The
  **thirty-days-no-sales** item is the one most likely to be annoying on day one; `05-impact`
  §4 proposes a narrower rule and the walk is where it gets judged

---

## How this is checked afterwards

`06-diff/notes.md` records, per panel: promised, built, **diverged**, and what to check.
Divergence is expected and is not failure — silent divergence is.
