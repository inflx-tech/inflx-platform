# Before / after

**One strip removed, and the vocabulary behind it deleted rather than orphaned.**

---

## What went

| | |
|---|---|
| The six-stage strip | `Fund · Roster · Contracts · Production · Review · Payout` |
| `StageRail` | its only caller was that strip |
| `CAMPAIGN_STAGES`, `stageIndex`, `stageTrack` | the competing six, in words |
| `stageKey` from the helper's return | nothing read it once the rail was gone |

**Renamed**, because a module called `campaignStages` containing no stages is a trap for
whoever opens it next:

* `utils/campaignStages.js` → `utils/campaignPrime.js`
* `deriveCampaignStage()` → `campaignPrimeAction()`
* `components/brand/CampaignStageRail.js` → `components/brand/CampaignPrimeBar.js`

## What stayed, and why it was the risky part

**The primary action.** *"Fund wallet & publish"*, *"Review 3 applications"*, *"Confirm 1 live
URL"*.

The stage half and the action half lived in **one function**. Taking the wrong half would have
left a draft campaign with no publish button — the single thing this screen gained on mobile.
So R-5 walks every campaign status and asserts a usable label comes back, and a mutation that
empties one is caught.

The ordering rule survived intact and is now written down where it lives: **a pending live-URL
confirmation outranks a queue of deliverables, because it releases Tranche 2.** Money that is
owed moves before work that is being checked.

## Why it went at all

Stage 3 agreed a different six — **Agree · Sign · Shoot · Shop posts · Go live · Complete** —
decided on the server and shown per creator.

Two six-step vocabularies in one app, with half the words colliding: `Contracts`/`Sign`,
`Production`/`Shoot`, `Review`/`Shop posts`. And they were not measuring the same thing at all:
one was the campaign, one is a single collaboration.

The founder spotted it in a screenshot. `git log` confirms Stage 3 never touched this screen —
its last three commits are a recolour, a Part-5 date change and a restyle.

## Two tests rewritten, neither deleted

* `campaignStages.test.js` → `campaignPrime.test.js`. The prime-action half moved across intact.
  The `stageTrack` block tested something that no longer exists, so it was **replaced by checks
  that the vocabulary is gone** — the old module absent from disk, no `stageKey` in the return,
  no import anywhere still pointing at the old names.
* `brandCommandCenter.smoke.test.js` asserted `StageRail` is exported. That is now false, so it
  asserts the opposite fact rather than the coverage quietly evaporating.

## One of my own checks was wrong

R-9 walks every file looking for imports of the old names — and flagged **itself**, because the
test file contains the strings it searches for, inside the pattern. A check that flags itself
proves nothing and hides everything after it. It now skips its own file, and says why.

## Verification

| What | How |
|---|---|
| The removal | **15 checks** in `campaignPrime.test.js` |
| Are they real? | **Mutation-tested. 5 deliberate breakages, 5 caught** — including the vocabulary creeping back, a `stageKey` returning again, and the draft campaign losing its publish button |
| Regression | Full mobile suite: **42 suites, 455 tests** |

Certified **no-regression**. **Never claimed green.**

## Not in here

**Rebuilding this screen around Stage 3's six.** The founder first chose that as its own stage,
then asked for the strip gone now. This removes the wrong thing; it does not build the right
one. The screen keeps its progress figures, its tiles and its prime action.
