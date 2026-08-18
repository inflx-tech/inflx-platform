# Phase 0 — how we will know it works

Written as things to try, not test names. Each one either happens or it doesn't.

---

## The diary

**T1 · A negotiation keeps every offer.**
Play it through: brand asks 15% by 24 Aug → creator counters 22% by 2 Sep → brand counters 18%
by 28 Aug → creator accepts. Read the history back.

All four moves are there, each showing what changed and who changed it. **Today the 15% and the
22% are both gone** — only 18% survives.

**T2 · Both sides read the same history.**
The brand's copy and the creator's copy of that conversation are identical, entry for entry.

**T3 · A post rejected twice keeps both reasons.**
Send a post back for a shaky video, let it be resubmitted, send it back for a bad crop. The
history shows two rejections with two different faults. Today only the crop survives.

**T4 · A reel that went two rounds keeps both requests.**
Same shape as T3, on the social side.

**T5 · The shoot's existing record still works and now also appears in the diary.**
Nothing that already records is lost. A shoot that was dispatched, received short and resolved
shows all three in one place.

**T6 · A step with nothing yet shows an empty history, not an error.**
Open the history of a step that hasn't started.

---

## The step number

**T7 · One collaboration, one step number, both apps.**
Ask the server for the same collaboration from a brand account and a creator account. The step
number and whose-turn are the same in both answers.

**T8 · The step matches reality at each point.**
A signed contract with no shoot booked reads step 3. Shoot done, no posts made, reads step 4.
One shop post live and a reel approved reads step 5.

**T9 · A content collaboration numbers differently and correctly.**
No shop-posts step. Its step 4 is deliverables with the brand, not posts with the review team.

**T10 · An ended or archived collaboration doesn't claim a live step.**

---

## The needs-you count

**T11 · A parent equals its children plus its own.**
Build a campaign with two sets. Put one owed item on a creator, one on the other creator, one on
the set, one on the campaign. The campaign's count is 4. Its sets show 3 and 0. The difference
is the campaign's own item, and it is listed, not hidden.

**T12 · Nothing is counted twice.**
An item owed by a creator appears in exactly one creator's count, one set's, one campaign's —
never twice at the same level.

**T13 · Ended campaigns count zero**, even if something technically remains outstanding.

**T14 · The two halves add up.**
The number on the brand's tab bar equals the campaigns total plus the creators-tab total.

---

## The creator can counter back

**T15 · She can counter a brand's counter on her own pitch.**
Pitch ₹20,000 → brand counters ₹8,000 → **she counters ₹14,000**. It sends. Today this is
impossible; her only options are accept or decline.

**T16 · The brand is told, and sees what moved.**
The brand's copy shows ₹8,000 → ₹14,000 as a change, not as a fresh proposal.

**T17 · She runs out of counters.**
After her allowed rounds are used, countering is refused with the real reason, not a generic
error.

**T18 · A must-have cannot be countered.**
A term either side marked as required is refused if a counter tries to change it — refused by
the server, not merely hidden on a screen.

---

## The three corrections

Each of these must **fail before the fix and pass after**. A correction whose check was written
after the fix proves only that the code does what it does.

**T19 · Brand acceptance settles the latest terms.**
Pitch ₹20,000 → brand counters ₹8,000 → creator counters ₹14,000 → **brand accepts**.
The agreement says **₹14,000**. Under today's code it says ₹20,000.

**T20 · The brand runs out of counters too.**
A brand countering a pitch beyond the allowed rounds is refused. Today it can counter
indefinitely.

**T21 · A creator cannot accept her own counter.**
After she counters, accepting is refused. Today the check only looks at whether the conversation
is "countered", which is also true when she was the one who countered.

---

## Nothing broke

**T22 · An un-updated phone behaves exactly as before.**
Every screen that works today still works, unchanged, against the new backend. Nothing reads the
diary or the new columns yet.

**T23 · The two live brand requests in production are untouched.**
Their state, their terms and their timestamps are the same after the migration as before.

**T24 · Existing pitch behaviour is unchanged where it should be.**
A brand accepting a pitch that was never countered still settles the original terms — because
those are also the latest.

**T25 · The full check suite passes**, against a baseline of 386, with no check weakened,
skipped or deleted to get there. Any failure gets classified — stale fixture, rule change, real
defect, or bad assertion — never re-run until green.

---

## What proves the phase is done

All 25 above, plus one statement we can make honestly:

> A negotiation that happened last month can be read back in full, by both parties, showing
> every offer that was ever on the table — and a creator can name her own price on her own
> pitch.

Neither of those sentences is true today.
