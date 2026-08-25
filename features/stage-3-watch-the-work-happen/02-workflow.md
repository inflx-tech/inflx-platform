# Stage 3 — workflow

The flow this stage must execute end to end. Success is **this walk completing on two
handsets**, not "it compiled".

---

## W0 · Starting state

Production as surveyed 2026-08-26: 2 campaigns, 3 sets, 6 collaborations at
`invited · contracted · active · active · active · completed`, 1 submitted deliverable,
3 shop posts. Kanchi Silks' tree totals **8** — five inside campaigns, three conversations.

---

## W1 · The brand sees a number, and it means something

Open the brand app.

**Expected:** the Campaigns tab carries a badge. It equals what the server says, and it is
the sum of every campaign row's badge plus the Creators tab's own.

**Must not:** be computed in the app. If the phone adds it up itself, the two apps will
eventually disagree about the same collaboration, which is the failure this stage exists to
prevent.

---

## W2 · Level 1 — Campaigns

**Expected:** each running campaign shows its own badge. `Festive Season` shows **3**,
`Monsoon Cottons` shows **2**. Ended campaigns keep their row, greyed, and carry **no badge**
— nothing owed on a finished campaign should pull attention from live work.

---

## W3 · Level 2 — a campaign, and its sets

Tap `Festive Season`.

**Expected:**
* anything owed **at campaign level** listed **above** the sets, because it belongs to no
  creator
* the sets: `Sarees` **3**, `Reels` **1**
* each set row carries six mini-bars — the six steps — showing how far along the set is
  without opening it
* the numbers reconcile in view: 0 own + 3 beneath = the 3 on the row above

**Must not:** show a campaign badge whose parts cannot be found on this screen.

---

## W4 · Level 3 — a set, and its creators

Tap `Sarees`.

**Expected:**
* anything owed **at set level** above the roster — today that is *"2 creators have nothing
  to sell"*, which is true and is the number the badge is made of
* each creator: photo, agreed terms in a line, **which of the six steps she is on**, and
  **whose turn it is**
* `Asha M.` step 3 · nobody · `Meera S.` step 4 · her turn

**Must not:** invent a step. Every step number on this screen came from the server.

---

## W5 · Level 4 — a creator, and the six steps

Tap `Asha M.`

**Expected:** the spine. Agree · Sign · Shoot · Shop posts · Go live · Complete. The current
step expanded and carrying the action. Each step badged with whose it is.

**Step 4 carries no button and says why** — *"not yours to review"*. Hiding it would make the
collaboration look stalled; showing it greyed says work is happening and it is not theirs.

---

## W6 · Level 5 — inside a step

Tap the current step.

**Expected:** the thing itself — the contract, the negotiation, the review queue, the diary
— whichever that step owns. Where Stage 4 or 5 has not built the screen yet, the step opens
its **history** and says plainly that the rest arrives in a later stage.

**Must not:** a tap that goes nowhere. Every step is either a screen or an honest note.

---

## W7 · The creator's side, same numbers

Open the creator app as `Asha M.`

**Expected:**
* her Collabs badge equals the server's `total` for her
* opening the collaboration shows **the same six steps** with **the same current step** the
  brand just saw — step 3
* the old Invite / Nego / Sign / Active / Track / Done spine is **gone**

**This is the assertion the whole stage is for.** Brand and creator, two phones, one number.

---

## W8 · The reconciliation walk

Pick the tab badge and walk it down without leaving the app:

```
tab badge 8
  = Creators tab 3
  + Festive Season 3   = Sarees 2 (set's own) + Reels 1 (Nisha's own)
  + Monsoon Cottons 2  = Cottons 2 (set's own)
```

**Expected:** every number on that path is on a screen, and the last one is a button.

**Must not:** any level whose parts do not add up to it.

---

## W9 · The negative cases

| # | Set up | Expected |
|---|---|---|
| W9-a | A campaign with nothing owed | no badge at all — not a zero |
| W9-b | An ended campaign that technically still has an owed item | greyed, no badge, still openable all the way down |
| W9-c | A creator whose collaboration is complete (`Sneha R.`, step 6) | all six steps done, no button anywhere |
| W9-d | A step that is the creator's turn (`Meera S.`, step 4) | the brand sees its state and no button |
| W9-e | The server is unreachable | the ladder says so. It must never render a badge of 0 that means "we could not ask" |

---

## W10 · Regression boundary

* The brand's existing campaign detail, sets list and roster still work
* Stage 2's wizard is untouched
* The creator's Collabs six stages (Stage 1) still group correctly — the **stage** she is
  filed under and the **step** she is on are the same fact shown twice, and they must agree
* `pnpm qa` certified **no-regression** against the documented baseline, never green
* Both mobile suites green
* Duplicate-route check clean across every stack in **both** apps
* **The founder walks W1–W9 on both handsets before any deploy go.** THE_PLAN names this
  stage as the one where the device check *"stops being skipped"* — it adds screens to both
  apps' navigation.
