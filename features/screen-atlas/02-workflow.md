# Workflow — how the design was arrived at, and how it gets used

## How it was built

1. **Reality audit** — what exists, what is wrong, what is partial, what is
   missing, per item, read from production rather than assumed.
   → `Docs/REALITY_AUDIT.md`
2. **Screen map** — every screen with a verdict. → `Docs/SCREEN_MAP.md`
3. **Seven tab mockup files** — 145 panels, drawn tab by tab, corrected across
   five rounds of founder review.
4. **Reorganisation** — the founder asked for all of it rearranged by **action**,
   with steps, variants, and both phones where two people are involved.
5. **This contract** — one address per screen, one description per screen, 47
   actions written out, and two checkers so the three documents cannot drift.

## How it gets used from here

**Every implementation slice carves its own contract.** It names the screen
addresses it implements (`SB-30`, `SC-16`, …) and the actions it completes
(`BR-10`, `CR-15`, …). It does **not** redraw the screens — it points here.

That is the whole reason the addresses exist. A slice that wants to change a
screen changes it *here*, re-runs the checkers, and the change becomes visible to
every other slice that touches the same screen.

## The expected end state

A reader can answer, without opening any code:

| Question | Where |
|---|---|
| what does this screen look like | one card, one address, in the atlas |
| who uses this screen | the grey line under its address |
| what happens when I press this | the action book, with every fork |
| what does the other person see right now | the BOTH PHONES table |
| what does this leave in the database | the LEAVES BEHIND block |
| what is known to be broken here | the CAN GO WRONG block |
