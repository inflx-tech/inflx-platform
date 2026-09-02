# Workflow — pass 2, untangling food from fashion

## The workflow this protects

**A shopper browsing a fashion category.** That is the only journey this pass can break,
which is why the pass is done alone.

Before and after, it must be identical: open a category, see the shelves an admin
composed, tap a product, reach the product page.

## What changes for a shopper

Nothing they can see, on any surface they can still reach. The food controls removed here
sat behind a flag that could only be true for a food world, and food worlds were removed
in pass 1.

## What changes underneath

| | Before | After |
|---|---|---|
| Fashion product payload | carried `veg_flag` on every item | does not |
| "Not yet reviewed" list | restaurants only — could only return nothing | any completed purchase |
| Category browser | 750 lines, ~270 of them food | 483 lines |

## The end state

- A fashion category browses exactly as it did.
- Reviews still work, and their "what have I not reviewed" list can now actually return
  something.
- No screen in the app contains logic for a business INFLX does not serve.

## Where it can go wrong

| Risk | How it is handled |
|---|---|
| Cutting a shared helper that fashion also uses | Every cut anchored on food-only names; `foodFilteredSections` was found to be CONSUMED by the renderer and was repointed at the unfiltered list rather than deleted |
| Removing the reviews join, mistaking it for food | Checked first: reviews are the kept feature, badly named. Not touched |
| A broken edit shipping | Every scripted edit re-parses the file, and the destructive ones ran against a backup with automatic revert — which fired twice and saved the file both times |
| Backend change breaking a live read | Both backend edits are removals from a SELECT and a WHERE; no new query, no migration, no schema change |
