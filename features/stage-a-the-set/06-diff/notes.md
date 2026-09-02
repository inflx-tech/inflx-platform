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

---

# Before / after — Stage A, the campaign shell + publish + her invite

**Screens:** `BrandCampaignCreateScreen` (SB-23) · `BrandCampaignBuilderScreen` (SB-24) ·
`BrandCampaignReviewScreen` (SB-37) · `CollabDetailScreen` (SC-05)

## What was implemented

| | Before | After |
|---|---|---|
| New campaign | Name + a start date | Name + an optional note. No date — see below |
| Builder cards | Aim, creators, allocation/offer or deliverables/budget | Same, plus **Go live** and **Shoot** on every card |
| Publish screen | "Wallet needed: ₹X", refused with no breakdown | You have / You need / Short by, + **Add ₹X** button pre-filling the wallet screen |
| Her invite (SC-05) | Money, allocation, coupon, goal, deliverable count, brief | Same, plus **what she makes**, **where she posts**, a separated **"two things you cannot change"** block (launch day + shoot), and **how they may use it** |

## What matches the locked mockup

- SB-23 is genuinely two fields, plus the "what a set is" explainer card
- SB-24's cards read back the two things every set is defined by, not just creator counts
- SB-37 names the exact shortfall and offers a one-tap fix
- SC-05 separates what she agreed from what was fixed for the whole set, exactly as SB-30 produced it

## What diverged from the mockup, and why

**SB-37's "publish set 1 now, set 2 later" is not offered.** Checked against the actual
`publish()` function: it is campaign-wide — one short set blocks every set alongside it,
there is no per-set send. Written instead: go back, remove the short set, publish the rest,
bring it back once funded. A true sentence, not the locked one.

**SB-24's "Moved out" deferred-pool section was not built.** It needs migration 170
(`deferred_at`, `deferred_go_live_date`, `deferred_shoot_mode`) — Stage B, not built yet.
Documented in the screen's own header comment, not silently dropped.

## What to check — the device walk

1. **Start a new campaign.** Only a name field and an optional note. No date anywhere.
2. **Open the builder for a campaign with two sets on different days/shoot modes.** Each
   card shows its own Go live day and Shoot mode, correctly, not the other set's.
3. **Build a content set short on wallet funds, reach Review.** The shortfall card names
   the exact amount and an "Add ₹X" button appears.
4. **Tap that button.** Land on the Wallet tab with the amount already typed into the
   custom-amount field.
5. **From a creator's Collabs tab, open a fresh invitation** (one you built with SB-30 terms
   set — channels and at least one format). Confirm "Where you post", "You make", "Two
   things you cannot change" (launch day + shoot), and "How they may use it" all show, with
   real values, not placeholders.
6. **Open an invitation from BEFORE this work shipped** (an old cold invite, or one built
   without SB-30 terms). The four new blocks must simply not appear — no crash, no blanks.

## Known, and not fixed here

Same `cancelInfluencer` bug, still carried across every slice of this stage.

Same backend-verification limitation as the previous section: no live database this
session. The four resolver/describer functions this slice adds to `getMyCampaignDetail`
were chain-verified by hand with representative inputs. `pnpm qa:db` is still owed.

---

# Before / after — the deferred pool

**Screens:** new `CreatorDeferScreen.js` (off SC-05) · `CollabDetailScreen` (the button) ·
`BrandCampaignBuilderScreen` (SB-24, "Moved out")

Founder-scoped slice of what the atlas calls Stage B — not the whole of it. See the
contract's `lock.json → slice_5_deferred_pool` for the full reasoning, including why this
uses a new migration (167) rather than the one `Docs/IMPLEMENTATION_PLAN.md` originally
sketched (170 would have made a creator's row point at no set at all — checked and
rejected as unsafe against the actual codebase).

## What was implemented

| | Before | After |
|---|---|---|
| Her invite, the fixed day/shoot | Read-only, nothing to do about it | A button: "I have a different day or way of shooting in mind" → picks a preferred day and/or mode, optional note |
| What happens to her | — | Status moves to "deferred"; she keeps her row (and her settled money/allocation/offer), just no longer counted as active in that set |
| Campaign builder (SB-24) | Sets only | A "Moved out" section listing everyone deferred, with what they asked for, and "Build a set from these" |
| Building that new set | — | The wizard's Aim + Basics run normally; Creators is pre-filled with the deferred people (a new "Already included" list, separate from the usual agreement picker) |

## What to check — the device walk

1. **From an invited (not yet accepted) collab, tap the reservation button.** Pick only a
   shoot mode, no day — must still be allowed to send.
2. **Confirm she can no longer act on that invite** — it should read as settled/gone from
   her active list, not still sitting there asking her to accept.
3. **As the brand, open that campaign's builder.** "Moved out · 1" appears, with her name
   and what she asked for.
4. **Tap "Build a set from these."** Pick an aim and basics for the new set as normal.
5. **On the Creators step, confirm she's already there** under "Already included" —
   without opening the usual agreement picker at all.
6. **Reach Terms.** Her commission/allocation/offer should already be filled in, exactly
   as they were on her original invite — nothing to re-decide except what brought her here
   (which the new set's own day/mode already answers).
7. **Publish that set.** Confirm a fresh invite reaches her for the new set, and her
   original (deferred) row is untouched — this is the thing that proves her history
   wasn't overwritten, only added to.

## Known, and not fixed here

`cancelInfluencer`, still carried.

Migration 167 was dry-run AND applied against production this session (the one piece of
backend verification that didn't need to be done by hand) — see the contract for the
before/after row counts. The two new endpoints' request/response handling was still only
checked by hand, no live database, same limitation as every slice before this one.
