# THE FINISH LINE — how INFLX development ends

**Written 2026-09-02, after the founder said: "i am frustrating with this type of
development even with detailed screenshots... what we do to avoid this back and forth."**

This document is the **operating agreement** between the founder and Claude. It is not
a product plan — the product design already exists and is locked (see Rule 1). This is
about *how we work* so that the loop of claim → check → wrong → fix → new bug stops.

It supersedes the process parts of every other planning document in `Docs/`. Where a
product decision is needed, the Screen Atlas wins. Where a process question is needed,
this file wins.

---

## Part 0 — What changed today

**Claude can now see the apps.**

For the entire project up to 2026-09-02, Claude verified mobile work by reading code and
running tests. It had no way to look at a screen. Every bug the founder found on his
phone was invisible to 668 passing tests and obvious in one glance.

That is now fixed. An Android emulator (Pixel_6) runs locally, all four INFLX apps
install on it, and Claude can launch a screen and take a real screenshot of it. The very
first screenshot immediately revealed something no test had: the installed app was still
running August's JavaScript, and its login screen showed a `dev · OTP 000000` badge that
does not exist in current source.

This single change removes the largest cause of the back-and-forth.

---

## Part 1 — Why the back-and-forth kept happening

Three causes. Naming them precisely matters, because each has a different fix.

### Cause 1 — Claude verified code; the founder verified screens

A test can prove a function returns the right value. It cannot notice that a screen still
renders a list belonging to a flow that was deleted, or that a sentence on that screen
asserts a rule the app no longer enforces.

*Example, 2026-09-02:* the brand's set wizard had its old "Ask" buttons removed and new
search/group buttons added. The pre-agreement **picker itself** — a heading, a list of
agreements, and a note reading *"You cannot add someone who has not agreed"* — was left
rendering directly below the new buttons that had just made that sentence false. 668
tests passed.

**Fix:** Rule 4 below. Claude no longer says "done" on the strength of tests.

### Cause 2 — The map and the territory drifted apart

The repo currently holds:

| Artefact | Count |
|---|---|
| Locked design of record (Screen Atlas: 47 actions, 109 screens) | **1** |
| Planning documents in `Docs/` | **53** |
| Feature contracts in `features/` | **482** |
| Actual mobile screens (45 brand + 29 influencer + 46 follower) | **120** |

Claude has been building from whichever slice was most recent, not checking against the
one locked design. Earlier on 2026-09-02 Claude quoted a stale plan document to the
founder and had to retract it — a "big risky migration" the document described had in
fact existed in the schema since day one.

**Fix:** Rules 1 and 2 below.

### Cause 3 — An architecture change was done half-way

The founder retired brand-initiated pre-agreed collaborations. Claude added the new way
in and closed the old entry buttons, but left the old flow's on-screen content alive.

This is *not* the founder changing his mind too often. Changing your mind about your own
product is normal and allowed. The failure was Claude executing half a removal.

**Fix:** Rule 3 below.

---

## Part 2 — The rules from here

### Rule 1 — The Screen Atlas is the only design of record

`features/screen-atlas/` holds 109 screens, each drawn once, each with a permanent
address (`SB-01`…`SB-62` brand, `SC-01`…`SC-42` creator, `SA-01`…`SA-05` admin). Actions
are in `Docs/ACTION_MAP.md`.

- If a question is "what should this screen look like / do", the answer comes from the
  Atlas. Not from a `Docs/*.md` file, not from a contract, not from memory.
- The follower app is **not** covered by the Atlas and needs its own equivalent single
  source. Establishing that is a Phase 2 task.
- Every other planning document is either **superseded** or **historical**. Part of the
  audit is stamping each one.

### Rule 2 — The design changes before the code does

When the founder changes his mind — which is expected — the sequence is:

1. Founder states the change.
2. Claude updates the **Atlas** (and says exactly which screens it touches).
3. Founder confirms the updated Atlas.
4. *Only then* code changes.

Never code first. A code change that outruns the design is how the map and territory
drift apart, and it is how half-removals happen.

### Rule 3 — A removal is not done until what it *rendered* is gone

Retiring a flow means removing, in this order:

1. Its entry points (buttons, links, menu items) — *this is the part that gets done*
2. **Its on-screen content** — headings, lists, empty-states, chips, counts
3. **Its explainer and lock copy** — the most dangerous leftover, because it does not
   merely look stale, it actively asserts a rule that is now false and the user believes it
4. Its static copy elsewhere that describes the old behaviour
5. Its dead code, endpoints, and tests (tests get **rewritten with the reasoning
   recorded**, never silently deleted)

A removal reports as complete only when all five are done.

### Rule 4 — "Done" means a screenshot, not a passing test

For anything the user can see, Claude does not say "done" until it has **looked at the
screen** — a real screenshot from the emulator — and can describe it top to bottom, every
block in order, as a thumb sees it.

If Claude cannot produce that screenshot or that description, the honest status is *"code
written, not verified"* — and it will be reported that way.

The founder's job stops being *finding bugs* and becomes *confirming the screen matches
what he wanted*. That is a ten-second job on a picture, not a hunt.

### Rule 5 — One list, burned down, no new scope until it is empty

Founder decision, 2026-09-02: full audit first, one list, then fix in a single pass. No
interleaving new features with the burn-down. The list only shrinks.

### Rule 6 — Claude states uncertainty as uncertainty

Where something cannot be verified, it is reported as **not verified** rather than
assumed. "I checked and could not reproduce this" is a valid, useful answer and will be
given instead of a fabricated fix. (Applied 2026-09-02 to the "search shows nobody"
report, which could not be reproduced against live data.)

---

## Part 3 — The plan, in four phases

### Phase 1 — AUDIT (running now)

Every screen in all three apps, judged against the locked design and the current
architecture. Three parallel audits: brand (45 screens), influencer (29), follower (46).
Backend, admin and brand-web follow.

Each finding carries: what a user would **see** wrong, in plain language; where it is;
and a severity —

| Severity | Meaning |
|---|---|
| `BLOCKS_USE` | You cannot complete the job |
| `MISLEADS_USER` | The screen tells you something untrue |
| `COSMETIC` | Looks wrong, works fine |
| `DEAD_CODE` | Unreachable; costs nothing but confusion |

**Output:** one table the founder reads. Not code.

### Phase 2 — THE CUT

The founder sees the whole problem at once and decides **what is in v1 and what is
parked**. This is the step that actually ends development: not by building everything,
but by defining *enough*.

Recommended shape: **one complete spine** — a single journey that works end to end across
all three apps (brand creates campaign → invites creator → creator negotiates → both sign
→ shopper buys → money settles). Everything not on that spine is parked, explicitly, in
writing.

Also decided here: the follower app's single source of truth, and which of the 53 `Docs/`
files survive.

### Phase 3 — BURN DOWN

Fix the in-scope list in one pass. The list only shrinks. Every fix that touches a screen
is verified by screenshot (Rule 4) before it is reported.

Progress is a number the founder can watch: *"X of Y findings closed."*

### Phase 4 — THE WALK

One complete end-to-end walkthrough on a real phone, once, when the spine is whole —
matching the founder's own stated goal: *"my goal is till signing of contract need to
do, then it is meaningful for us to test one complete flow."*

Anything found here is a genuine finding, not a leftover.

---

## Part 4 — What is expected of each side

### From the founder — three things, and they are small

1. **Confirm the Atlas is still the target**, with the campaign/set-first change folded
   in. Not a re-statement of the vision — it is already written. Just: is this still it?
2. **Make the cut** in Phase 2. Only the founder can decide what v1 does not need.
3. **Confirm screens against screenshots**, not by hunting bugs on a phone.

What is explicitly *not* expected any more: finding Claude's mistakes in production.

### From Claude

1. Verify by looking, and say plainly when something is unverified.
2. Update the design before the code, every time.
3. Finish removals completely (all five layers).
4. Keep one list and shrink it.
5. Report in plain functional language, organised by what the founder actually sees.

---

## Part 5 — What "done" looks like

Development on the current programme is finished when:

- [ ] Every audit finding is either **fixed** or **explicitly parked** in writing
- [ ] The spine works end to end on a real phone, walked once by the founder
- [ ] Every in-scope screen matches the Atlas, verified by screenshot
- [ ] `Docs/` contains only documents that are true today
- [ ] There is a written parked list, so "what about X" has an answer that is not "we forgot"

Everything after that is new work, entered through Rule 2 — design first.

---

## Appendix — status

| Item | State |
|---|---|
| Screenshot harness | **Working** as of 2026-09-02 (Pixel_6 emulator, all 4 apps install, screenshots confirmed) |
| Audit — brand / influencer / follower | Running |
| Audit — backend / admin / brand-web | Queued |
| The cut (Phase 2) | Awaiting Phase 1 |
| Founder device walk | Deferred to Phase 4, by the founder's own decision |
