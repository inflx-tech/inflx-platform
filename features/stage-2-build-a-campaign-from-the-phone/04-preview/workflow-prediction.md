# Stage 2 — workflow prediction

What the mockups predict will happen when a real brand walks `02-workflow.md` on a handset.
Written **before** implementation so the diff in `06-diff/` has something to be measured
against.

Board: `04-preview/mockups/stage2-screens.html` — ten panels, extracted from FINAL 2
(`features/brand-mobile-spine/04-preview/mockups/final-2-campaign.html`) and action ledger
59–98. Open it with:

```bash
pnpm preview:open stage-2-build-a-campaign-from-the-phone
```

---

## Predicted, screen by screen

| Workflow step | Board panel | What I predict the brand does | What I predict goes wrong first |
|---|---|---|---|
| W1 land | ② | Taps **+ New** in the header without hunting | Nothing. The header control is where they already look |
| W2 shell | ③ | Types a name and a date, taps *Add the first set* | They look for the budget field. The lock note answers it in place |
| W3.1 aim | ④ | Reads the three cards, picks Sales | They may expect to change it later. The note says they cannot once creators are added |
| W3.2 basics | ⑤ | Sees Ends and Budget greyed and reads why | **Channels is the unfamiliar one.** It is new to this platform entirely, and its meaning must survive being read once. If a brand asks "does this stop anyone?", the guidance line is not doing its job |
| W3.3 agreements | ⑥ | Ticks two rows | **The aim filter is the risk.** A brand who expects to see all four agreements and sees three must be told the fourth was hidden as the wrong aim — hence the ghost chip. If that chip is missed, this reads as a bug |
| W3.4 allocation | ⑦ | Picks a category for one, hand-picks for the other | **The picker will look empty.** Every practice product is uncategorised right now, so everything lands in **Other**. The board draws that group deliberately; without it the first walk looks broken |
| W3.5 offer | ⑧ | Reuses the saved discount, then opens the preview | The preview's job is to remove a whole class of later confusion. If a brand does not open it, it has failed |
| W4 content set | ⑤ | Sees the budget calculated rather than typed | A brand used to typing a budget may look for the field. It is shown, greyed, with the sum |
| W5 blockers | ⑨ | Hits at least one refusal on the first real attempt | **Most likely: Meera with nothing to sell.** That is the whole reason the blocker exists |
| W6 publish | ⑨ | Publishes, invites go out | — |
| W7 abandon | — | Kills the app mid-wizard | Both agreements must still be in Ready to brief. If they are not, §5.1 of the spec was implemented wrongly |

---

## The three predictions most likely to be wrong

1. **That four steps is the right shape on a phone.** The board fits step 4 into one screen
   with two labelled sections. On a small handset with three creators in a set, section ①
   may scroll further than it reads well. If the walk says so, the fix is a per-creator
   drill-down, not a fifth step.
2. **That the aim filter is understood from a chip.** If a brand reads "Content · 1 — wrong
   aim" as an error rather than an explanation, the wording changes, not the rule.
3. **That the basket preview is opened at all.** It is the highest-value screen in the stage
   and it sits behind a button. If it is skipped, it may have to be shown inline instead of
   offered.

---

## What the board deliberately does not predict

* Whether the campaign then **runs** correctly — that is Stage 3
* Whether a shopper buys through it — Stage 6
* Anything about open groups, cold invites, or product listing — out of scope by §4 of the
  spec

---

## How this is checked afterwards

`06-diff/notes.md` records, for each panel: what was promised, what was built, **what
diverged**, and what to check on the handset. Divergence is expected and is not failure —
silent divergence is.
