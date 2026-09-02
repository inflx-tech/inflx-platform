# Before / after — Stage A, the Basics step

**Mockup:** `features/screen-atlas/04-preview/mockups/atlas-brand.html` → **SB-26**
(`pnpm preview:open screen-atlas`)
**Screen:** `BrandSetWizardScreen` · step 2 of 4

## Screenshots

**Not captured, and not faked.** The "after" for this screen is a React Native
wizard step reachable only by signing in as a brand, creating a campaign and
opening the set wizard — Playwright cannot reach it, and no Maestro flow drives
it yet. Pasting a mockup render into both panels would satisfy the gate and prove
nothing.

What is captured instead is the **founder's device walk**, listed under *What to
check* below. That is the honest artefact for this screen, and it is the one the
contract is gated on.

## What was implemented

| | Before | After |
|---|---|---|
| Dates | **content set:** two boxes, "Posting window from" + "To"<br>**sales set:** one box, "Starts" | **every aim:** one box, **"Everyone goes live on"** |
| Shoot | not asked at all | **"How they shoot"** — two cards, Store visit / We send the products |
| Invitations | not asked | **"Invitations close"**, proposing three days before the launch |
| Continue | enabled always | greyed until name + day + mode are all present |

## What matches the locked mockup

- One launch day, asked identically for all three aims
- The line underneath it: *"Every creator in this set posts on social media that
  day. Shop posts on INFLX can go up any time before it."*
- Two shoot modes as cards with a sub-line each, not a dropdown
- Invitations closing before the launch, with the reason stated

## What diverged from the mockup, and why

**The mockup shows the second mode as "Remote". It stores `shipment`.**

The code has carried three modes since migration 024 — `visit`, `shipment`,
`remote` — and the atlas drew two, calling the second one "remote". But
everything Book 3 describes under that name (her address, tracking, "everything
arrived") is `shipment`. `remote` means *nothing is sent at all*.

Founder's decision, 2026-09-01: the wizard offers two, and the second stores
`shipment`, so the no-parcel path cannot be reached from a set by accident.
`SHOOT_MODES_OFFERED` is the one list, mirrored on both sides and pinned by a
test that reads both files.

**The invitations-close date proposes itself.** The mockup shows it as a plain
field. Choosing a launch day now fills it with three days earlier — never in the
past — because it is a date the brand should not have to think about. They can
still change it.

## What to check — the device walk

1. **A campaign is two fields.** Name and an optional note. Nothing else.
2. **Set 1** — pay per sale, a launch day, store visit.
3. **The picker greys out anything sooner than five days from today.** Try to
   pick tomorrow; it should not be selectable.
4. **Set 2** — pay for content, a *different* launch day, we-send-the-products.
   The date question must look **identical** to set 1's.
5. **Continue is greyed** until all three are filled.
6. **Choosing a launch day fills in "Invitations close"** three days earlier.
7. **Open an OLD set** (one of the 11 already in production). It must still open,
   its name and aim intact, with the launch day **blank** — not invented.
8. **Save a content set.** This is the one that would have been blocked by the
   stale guard; it must save.

Step 7 is the one worth doing carefully. Nine of the eleven live sets have no
`window_end` to fall back on, and migration 165 deliberately did not invent a
launch day for them.

## Known, and not fixed here

`cancelInfluencer` writes an invalid `campaign_influencer_status`. Confirmed live, will
throw. Carried — nothing in this stage calls it.

---

# Before / after — Stage A, her terms

**Mockup:** `features/screen-atlas/04-preview/mockups/atlas-brand.html` → **SB-29, SB-30**
**Screens:** `BrandSetWizardScreen` step 4 of 4 (`StepTerms`) · new `CreatorTermsScreen.js`

## Screenshots

Not captured, for the same reason as SB-26 above — reachable only inside the wizard, on a
real device. The device walk below is the artefact this half of the stage is gated on.

## What was implemented

| | Before | After |
|---|---|---|
| Where she posts / what she makes | Asked once, in Basics (step 2), for the whole set | Not asked in Basics at all. Asked per creator, in a new screen (SB-30) reached from her card in Terms (step 4) |
| Her card in Terms | Money, allocation, offer | Same, plus a "Where she posts / What she makes" summary and a button into SB-30 |
| Finish gate | Blocked only if unallocated (selling set) | Also blocked if any creator on a buying-content set has no format chosen |

## What matches the locked mockup

- SB-30 is one screen per creator, reachable from her row, showing money/allocation/offer
  read-back plus the two new fields — nothing summarised away before she agrees to it
- Channels stays guidance, never a gate; formats is compulsory exactly where the set is
  buying content, never on a commission-only creator

## What diverged from the mockup, and why

**SB-29's "set the defaults once, list who's different" layout was not rebuilt.** The
locked mockup shows one shared default plus per-creator exceptions. What shipped keeps the
existing per-creator-card list (every creator's terms always visible) and adds the new
fields + button onto it, so the working allocation and offer flows did not have to be
touched to ship this. Functionally complete; visually not pixel-matched. If this matters
enough to redo properly, say so and it's a follow-up slice, not a rewrite of this one.

**Channels/formats moved out of Basics entirely, not just relocated.** Founder, 2026-09-01,
asked directly because it touches the budget and what a content contract can sign without:
chose per-creator-only over "ask once, override the exception" — the harder of the two, on
purpose, so no set-level default stands in for a creator nobody has actually been asked.

## What to check — the device walk

1. **Open Basics (step 2) on a new set.** No channels, no formats question anywhere on it.
2. **Pick creators, reach Terms (step 4).** Each creator's card shows "Where she posts" /
   "What she makes" as **Not set / Not set yet**, in red on a content or hybrid set.
3. **Tap into one creator's terms (SB-30).** Money and post-by read as already agreed.
   "Change what she can sell" and "Change/Give her an offer" still work exactly as before.
4. **Pick a channel, give her a format, Save.** Back on Terms, that creator's card updates
   immediately — no need to leave and re-enter the step.
5. **On a content or hybrid set, try to finish Terms with one creator's formats still
   unset.** The button stays greyed, with a reason.
6. **Pick an offer for a creator, then immediately open her SB-30 without saving the set.**
   The offer must still be there when you come back — this is the one the offer-persistence
   fix in this slice exists to prevent regressing.
7. **Open an existing (pre-today) set that already had channels/formats at set level.**
   It must still open without error — nothing here was meant to touch or clear that.

## Known, and not fixed here

Same `cancelInfluencer` bug as above, still carried.

The backend half of this slice (the `invite`/`updateInfluencer`/`duplicateSet` wiring, and
the read-side resolvers in `deliverables.model.js` / `campaignChannels.js`) could not be
run against a live database in this session — verified by hand instead (see the contract's
`lock.json → slice_2_terms.backend.not_run`). `pnpm qa:db` against production is the real
check, still owed before this is called done on the server side.
