# Before / after

**Two refusals became the app doing the obvious thing.**

---

## 1 · A lapsed creator leaves on her own

**Before:** she stayed in the set. You reached Review, got a red block, and had to work out
which creator to remove and go back for her.

**After:** she is removed **when you open the set**, and you are told who and why.

She could never have been briefed — `listReadyToBrief` returns only
`status = 'ready' AND expires_at > now()`, and the invite endpoint refuses anything else. There
was no judgement for a brand to make, so asking them to make it was the app handing over its own
homework.

### ⚠️ Two guards, and why they matter more than the feature

**It cannot run before the live list has arrived.** The check compares against `agreements`,
which starts as `[]`. Without `agreementsLoaded`, opening a set would clear **every** creator,
every time — and to a brand that is indistinguishable from the app losing their work.

**It never happens silently.** She is named, with the reason and what to do:

> *"Divya T. is no longer available to brief — the agreement has lapsed, or has been used in
> another set. Agree with her again from the Creators tab to include her."*

A creator who simply vanishes reads as a mis-tap, or goes unnoticed until the campaign is live
without her.

## 2 · A draft opens where the work stopped

**Before:** tapping any campaign opened `CampaignDetail`. On a draft that is a dashboard reading
**0% progress · no deliverables · no budget** — nothing you did not already know, and none of the
half-built set you came back for.

**After:** a `draft` or `pending_wallet` campaign opens the **builder** — its sets and what each
still needs. Anything published opens the dashboard, unchanged.

It deliberately does **not** jump into a particular set. With two half-built sets there is no way
to know which was meant, and guessing wrong costs more than one tap.

---

## 3 · The measurement that changed my mind

I had defended the dead-agreement publish blocker with a story: pick a creator Monday, publish
Thursday, her agreement lapses in between.

**Read from production before agreeing to anything:** `agreement_expiry_days` is **90**.

So that story does not hold. An agreement lapsing mid-build needs a campaign left open for most
of three months. And the founder's own screen — *"Divya's agreement expires in 3 days"* — meant
the agreement was made **87 days ago**, not that he was slow.

⚠️ **The blockers still stay**, because the auto-drop only covers the set a brand is *looking
at*. Anything already invited is out of its reach, and the gate is the only cover there.

## 4 · ⚠️ What "resume" cannot do

Creators pencilled into a set live **in memory only** — no storage, no server rows. Deliberate,
per ledger #77: an agreement is consumed on publish, so abandoning the wizard must not burn it.

**So resume returns you to the right screen but does not restore ticks from a previous app
session.** Within one session everything survives; across a restart the picks are gone.

That is a design decision, not a bug, and it is put to the founder rather than changed quietly.

---

## Verification

| What | How |
|---|---|
| Both changes | **18 checks** in `draftResume.test.js` |
| Are they real? | **Mutation-tested. 6 deliberate breakages, 6 caught** |
| Regression | Full mobile suite: **44 suites, 492 tests** |

The six included the two that would hurt most: removing the loaded-guard (which clears every
creator on entry) and dropping silently.

**One check found a real bug rather than confirming one.** `resumeRouteFor` threw on a null
campaign. Fixed **in the code**, not softened in the test — a list that has just refreshed can
hand it an undefined row for a frame, and a crash there is a blank Campaigns tab.

Certified **no-regression**. **Never claimed green.**

## What to check

⚠️ **W3 is the one that matters.** Open a set with live creators several times and confirm
**nobody disappears.** The drop runs against a list that arrives asynchronously; a guard that
fails would clear your work in front of you.

---

## 5 · Adjacent fix — the builder's empty state

**Founder, 2026-08-28:** *"this is wrong if that campaign has never created, never added
sets... means ask to add your first set."*

He created a campaign and landed on the screen this contract made the destination. **Three
things were wrong on it, not one.**

| | Before | After |
|---|---|---|
| The button | *"+ Add another set"* — on a campaign with none | *"Add your first set"* |
| Its emphasis | An **outline** button, beneath a **black** "Review and publish" that was greyed out and unusable | Primary while the campaign is empty |
| The note | *"A campaign can hold a sales set and a content set together"* — shown to someone with zero | Held back until there is one |

⚠️ **The second was the worst of the three.** The one thing he could do looked secondary to the
one thing he could not. A disabled black button outranked the live outline one directly above
it.

The note is not wrong, it is **early**. It answers a question nobody with an empty campaign has
reached, and pushes the only action further down the screen.

**Untouched:** the empty state itself already read correctly — *"No sets yet. A set is one aim,
one group of creators, one offer. Add the first one."* The words were right; the button under
them disagreed.

**Why here rather than its own contract:** this contract made the builder the screen a draft
campaign opens to. He reached it because of that change, and it was wrong. Splitting one screen
across two contracts would make both harder to read.

**Verified:** 5 more checks (23 in the file), 4 deliberate breakages, 4 caught.

---

## 6 · The open question, answered

> **Should creators you have ticked survive closing the app?**
> **Founder, 2026-08-28: "Not surviving."**

**Option A. No code change.** Ledger #77 stands: an agreement is consumed on publish, so
abandoning the wizard must not burn one — and nothing held locally should imply a commitment
the server has never been told about.

**What a brand actually sees**, checked rather than assumed:

The **set persists** on the server — its name, dates, aim and channels are all still there. Only
the ticks were in memory. On reopening after a restart, `hydrate()` finds zero creators and
lands him on **step 2 (Basics)** with everything he typed intact. He walks forward to Creators
and picks again.

Nothing on the screen claims to hold something it does not. And no explanatory message is
possible: *"a saved set nobody was picked into"* and *"a saved set whose picks were lost"* are
the same state, because they are the same thing.
