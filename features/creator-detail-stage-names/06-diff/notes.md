# Before / after

**Two pure functions were speaking a language the rest of the app stopped using.**

---

## What she saw

Ravi K. tapped a live invitation and got:

> **Closed — This collab is closed.**

No buttons. She could not accept it, counter it, or pass on it.

## Why

`heroFor` and `sectionsFor` decided what to show by matching the stage name:

| They matched on | `deriveStage` returns |
|---|---|
| invites · applied · negotiating · **to_sign** · active · tracking · completed · archive | invitations · pitches · **to_sign** · shoot · content · done |

⚠️ **Overlap: one word.** Everything else fell to the default, which said "closed".

## It was wider than reported

He found it on an invitation. `shoot`, `content` and `done` hit the same default — **a creator
with a parcel on the way was told her collaboration was over.**

And `sectionsFor` had the identical fault, so from the moment she signed she could no longer
reach her **contract**, her **deliverables**, her **performance** or her **earnings**. Only
"Terms & brief" survived.

---

## The part that stings

`collabDetailModel.js` carries a comment explaining that `spineFor` was **deleted** by Stage 3
for this exact fault:

> *"spineFor matched on stage names that Stage 1 renamed, and the two lists overlapped in
> exactly ONE value…"*

**`heroFor` sits directly above that comment with the identical defect.** Its neighbour was
diagnosed, removed and written up, and nobody looked up.

## And the tests passed the whole time

`collabDetailModel.test.js` covered every branch — **by feeding `heroFor` the old names.**

Its own closing comment says so, about `spineFor`:

> *"The tests passed because they passed it the OLD names. That is the strongest argument in
> this repo for testing what the screen actually does rather than what a helper can do when fed
> ideal input."*

That paragraph was written about the function two lines below it and was **equally true of the
one above it**. The file diagnosed itself and was not read.

Every case is now built from `COLLAB_STAGES` itself, and the first check walks all six and
asserts none reaches the default.

---

## ⚠️ My own diagnosis was wrong once, and I am recording it

I first reported that the endpoint returned **no row** for her assignment, and said the blank
page came from the server.

**That was my query, not the code.** It takes `[ciId, influencerId]`; I passed the id twice.
Re-run correctly it returns her campaign perfectly — the failure was entirely in the phone.

Recorded because a confident wrong diagnosis costs more than no diagnosis.

---

## What changed

* Both functions switch on the six stages that actually exist
* `shoot` gains a case — Stage 4 built that screen and this had never been told about it
* `done` distinguishes **finished** (earnings) from **cancelled** (closed)
* ⚠️ **The default no longer says "closed."** An unknown stage reads as *in progress* — telling
  a creator her live work is over is the precise failure this file exists to record
* A guard compares the two lists, so a rename cannot split them again
* A second guard walks every action a hero can emit and asserts the screen handles it — a
  button nothing handles fails the same way as no button at all

---

## Verification

| What | How |
|---|---|
| The fix | **24 checks**, rewritten to the real six |
| Are they real? | **Mutation-tested. 7 deliberate breakages, 7 caught** |
| Regression | Full mobile suite: **44 suites, 507 tests** |

⚠️ **One mutation was missed first time.** Putting "closed" back in the *default* went
undetected, because my guards only walked the six real stages and never the fallback. Closing
that gap is what makes the fallback assertion above exist at all — and the fallback is exactly
where the original bug lived.

Certified **no-regression**. **Never claimed green.**

---

## What to check

⚠️ **W3.** The sections restored past signing — contract, logistics, deliverables, performance,
earnings — have not rendered for a creator since Stage 1 renamed the stages. The screens behind
them may have drifted while nothing was reaching them. **Nothing proves a destination is healthy
except opening it.**
