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

`cancelInfluencer` writes an invalid `contract_status`. Confirmed live, will
throw. Carried — nothing in this stage calls it.
