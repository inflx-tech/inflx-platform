# Item 8 — workflow prediction

Written before the code, against the locked mockups T1–T14. What a person will
actually see, step by step, and what the screen must refuse.

---

## Creator — Priya, who wants to work with Urban Threads

**T1 · Finding them.** Her brand list shows Urban Threads as **Accepting**, with the
Aims and modes they take. Two other brands read **You don't match** and **Not accepting**
and cannot be tapped through to a pitch. A brand she was rejected by reads **On cooldown**
with the date it lifts — a pause, not a refusal. A brand whose minimum she fails only
because nobody has measured her yet reads **Being measured**, and the sentence under it
says so in her words rather than telling her she does not match.

**T2 · The deal.** "Pitch Urban Threads." Only Pay for Sale and Hybrid are offered,
because that is what they take, and a line says so. She types 14%. Under the field:
"Your minimum for this brand is 12%." — a reminder, not a rule. She could type 9% and
the screen would let her.

**T3 · When and how.** A date at least seven days out, with "They'll build a set around
this. It can move when you talk." Store Visit or Remote, but only the ones they take. If
she picks a date six days out the screen refuses it before anything leaves the phone,
in the server's own sentence.

**T4 · Review and send.** Her terms read back as a card. A message box, 500 characters,
counting. Then three things said **before** the tap: they have 30 days to reply; if they
agree she'll be invited to a set and sign an agreement then, and nothing is committed
until both sign; and this is her 1st open pitch of 3 allowed.

**Prediction:** she should never meet a rule she could not have seen. If the server
refuses the send, it will be for something the form could not know (a cooldown started
a minute ago, a limit reached in another tab) — and the server's exact sentence appears
on the field it belongs to.

**T13 · Waiting.** Her Pitches tab, three groups. Urban Threads: "They have until 9 Oct ·
24 days left." Stride Kicks, agreed: a green line, "They'll send an invitation when they
build a set for 28 Oct." Tick Watches, rejected: their reason in quotes, then "You can
pitch Tick Watches again after 15 Oct."

**T14 · The endings.** No reply, withdrawn, date passed, limit reached — each a plain
sentence that answers whether she can try again, and when. Empty is an invitation to
start, not a blank.

**T10 · They countered.** Item 6's thread, unchanged: old beside new on every line, the
round stated, the last round announced before she taps. Her pitch sits at the bottom as
the opening turn.

**T12 · The invitation her pitch became.** An ordinary item 5 invitation with a green
line: "The ₹9,000 you agreed on 12 Sep, in a set for 28 Oct." She still accepts — the
**set** is new and she has never seen it.

---

## Brand — Urban Threads, reading what came in

**T5 · The list.** On the Creators tab, a Pitches segment. Two under **New**, one under
**Talking**. Each card leads with her numbers — Instagram, YouTube, engagement — because
that is the first thing a brand decides on. A creator nobody has measured shows a dash,
never a zero.

**T6 · One pitch.** Who she is, what she reaches, what she wants, why her, and how long
is left. Three buttons.

**T7 · Accepting.** A sheet: "Her ₹12,000 — Agreed. She goes to — Your pool · 28 Oct.
A collaboration — **Not yet**." Then the paragraph that explains where she will be and
what happens next.

**Prediction:** this is the screen most likely to be misread, so the three lines are
deliberately a contrast — two things that happen, one that does not.

**T8 · Rejecting.** An optional reason she will see, then the cooldown **with its date**
before the tap, then the note that blocking is a different answer and lives in Pitch
settings.

**T11 · The pool.** She sits under "Want 28 Oct" beside a creator who asked to be moved,
carrying a PITCH tag. Tick both, build one set, and nothing about set-building changes —
the pool never cares how somebody arrived in it.

---

## What we expect to be wrong at first

1. **The turn-zero round.** Her pitch is stored as a counter so both sides see old beside
   new. If it is counted as a round, a pitch gets one counter where an invitation gets
   two. *(It was. Fixed before the tests went green.)*
2. **The two vocabularies.** The engine says `influencer`; migration 152's column says
   `creator`. *(It did. Translated at the boundary.)*
3. **Dates off by one.** A pg `DATE` arrives as a local-midnight instant, so `toISOString`
   moves it a day. *(It did, in a test. Read with `calendarDay`.)*
4. **`undefined` vs `null` in the numbers.** JSON drops `undefined`, so the phone cannot
   tell "nobody measured her" from "we forgot to send it". *(It did. Coerced to null.)*
