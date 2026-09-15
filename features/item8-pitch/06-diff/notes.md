# Item 8 — before and after, in plain words

What actually changed on a screen, and why. One entry per screen the mockups cover.

---

## T1 · Her brand list — `FindBrandsScreen` / `BrandOverviewScreen`

**Before.** Three statuses: Accepting, Not accepting, You don't match. The "Pitch this
brand" button showed a toast: *"Pitching brands is coming soon."*

**After.** The button opens the form. Two statuses join the three, and both are things
that end rather than refusals:

- **On cooldown**, with the date it lifts — because a rejection is "not now", not "never".
- **Being measured**, because a creator whose numbers nobody has taken yet was reading
  "You don't match", which said something untrue about her.

Both are coloured as *waiting*, not as *declined*. The coming-soon toast and its copy
string are deleted, not hidden.

---

## T2, T3, T4 · The pitch form — `PitchFormScreen` (new)

**Before.** Nothing.

**After.** Three steps. The screen asks the server what this brand takes before drawing
anything, so an Aim or mode that would be refused is never offered. Her own minimums
appear beside the money fields as a reminder; she may pitch under them and the screen
lets her. The review step says the deadline, the next step and the limit before the
Send button, so she never meets a rule she could not see.

When the server refuses, its sentence is shown on its own field. The screen never
rewrites it.

---

## T5, T6 · The brand's pitches — `BrandPitchesScreen`, `BrandPitchScreen` (new)

**Before.** The Creators tab had a Pitches segment showing *"Pitches are coming soon —
Creators will be able to pitch you here."*

**After.** The real inbox, grouped New / Talking exactly as every other list in the
product. Her numbers lead each card. **A number nobody has measured shows an em dash, not
a zero** — "0 followers" and "we haven't looked yet" are different facts and only one of
them is a reason to say no.

---

## T7 · Accepting — `AcceptPitchSheet8` (new)

The most important sentence in item 8, and it is on the button's own sheet:

> Her ₹12,000 — **Agreed**
> She goes to — **Your pool · 28 Oct**
> A collaboration — **Not yet**

Three lines, deliberately a contrast: two things that happen and one that does not.
Below them, where she will be and what the brand does next. Tapping Accept takes the
brand to the pool, because that is where she now is.

---

## T8 · Rejecting — `RejectPitchSheet8` (new)

The cooldown date is **on the sheet before the tap**, not discovered afterwards. Under it,
the note that blocking is a different answer and lives in Pitch settings — because "not
now" and "never" should not share a button.

---

## T9, T10 · The thread — `PitchThreadScreen` (new, shared)

**Before.** Item 6's thread could only hang off an invitation.

**After.** The same screen, the same turn cards, the same change lines, the same round
pill. Two differences, both because a pitch differs:

- Her pitch **is** the opening turn, so there is no separate "their invitation" card
  underneath. Rendering one would show her pitch twice.
- There is no locked card, because there is no set yet — an empty locked card would be
  worse than none.

One component serves both sides; the brand's route passes `side="brand"`.

---

## T11 · The pool — `PoolRow6` (one line added)

A creator who pitched now carries a **PITCH** tag beside a creator who asked to be moved.
Nothing else about the pool or set-building changes. The pool never cares how somebody
arrived in it — but the brand should be able to tell at a glance which one came knocking.

---

## T12 · The invitation her pitch became — `invitationRows.service`

Her ordinary item 5 invitation gains one green line: *"The ₹9,000 you agreed on 12 Sep,
in a set for 28 Oct."* She still accepts it, because the **set** is new and she has never
seen it. Nothing about the invitation screen itself changes.

---

## T13, T14 · Her pitches — `MyPitchesScreen`, `MyPitchScreen` (new)

**Before.** The Pitches segment of her Collabs tab held only a card pointing at the brand
directory.

**After.** That card stays at the top — it is still the way in — with her own list below
it, grouped waiting / agreed / ended. Every sentence on every card is written by the
server and rendered as given: the deadline, the ending, the cooldown. A screen that
composed its own would eventually disagree with the server about the two things she most
needs to trust.

Withdrawing lives on the detail screen rather than the list, because taking something
back should take one deliberate step more than looking at it. Its sheet says there is no
cooldown, so she is not afraid to use it.

---

## What was taken away

- `brand-web` and the phone: nothing. Item 8 removes no screen.
- The API: seven write endpoints on the old pitch path are **gone**, not disabled —
  send, withdraw, respond-to-counter, counter (both sides), accept and reject. Their
  reads stay until the app stops calling them.
- Two "coming soon" placeholders and their copy strings, deleted rather than hidden.
