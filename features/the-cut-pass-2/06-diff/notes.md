# Before / after — pass 2, untangling food from fashion

**Screens:** the shopper's category browser · the fashion product grid (server) · the
"not yet reviewed" list (server).

## Screenshots

**Not captured, and not faked.** There is nothing to show: the removed controls only ever
rendered inside a food world, and food worlds were removed in pass 1. A before/after of a
fashion category would be two identical pictures — which is the point of the pass, but
not evidence of it.

## What was implemented

| | Before | After |
|---|---|---|
| Fashion product payload | every item carried `veg_flag` | does not |
| "Not yet reviewed" | hard-filtered to restaurants, so always empty | any completed purchase |
| Category browser | craving rail, Veg / ₹99 / delivery-under-30 chips, restaurant result card, dining card with "₹X for two" | none of it |
| That file | 750 lines | **483** |

## The honest finding

**Less was actively wrong than the audit implied**, because pass 1 already made most of it
unreachable — all of the food UI sat behind one flag that can no longer be true. It was
dead code, not misbehaving code.

Worth doing anyway (food logic inside a fashion screen is how the next person gets
confused), but it was not the dangerous operation it was billed as, and saying so is more
useful than claiming a bigger win.

## What was NOT cut, deliberately

`restaurant_reviews` looks like bleed and is not. It is the **reviews feature the founder
kept** — named after the era it was built in, now serving every shop type, and joined on
every product card on purpose to show a brand's rating.

Catching that before deleting it is the entire reason this pass was done slowly and alone.

## Two mistakes I made, and what caught them

1. **A cut removed a value the renderer still used.** `foodFilteredSections` looked
   food-only; it was being passed to the section renderer. The file failed to parse, an
   automatic revert restored it, and the fix was to repoint that one use at the unfiltered
   list.
2. **A regex meant for food styles was too greedy** and deleted a style's opening line
   while leaving its body. Same failure, same catch — except I had skipped the backup that
   time, so it was repaired by hand rather than reverted.

Both are recorded because the lesson is the process, not the bug: every destructive
scripted edit should re-parse afterwards, and should run against a backup.

## What to check — the device walk

1. **Open a fashion category and browse it.** Shelves, products, tapping through to a
   product page — all unchanged. This is the only journey the pass could have broken.
2. **Buy something, then look for the review prompt.** It should now be able to appear;
   before, it could not.

## Known, and not fixed here

Food-era fields still exist elsewhere in the server (`veg_flag` on the products table,
`master_dish_id`, the meals service). Those are writes and storage, not the fashion read
path — pass 3 and pass 4.
