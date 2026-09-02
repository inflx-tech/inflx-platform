# Pass 2 — untangle the food code threaded through fashion

**Third pass of the cleaning plan in `Docs/THE_CUT.md`.**

Pass 1 removed whole screens. This pass removes food logic that was **woven into code
fashion depends on** — so it is surgery, done alone, rather than deletion.

## What was actually found

Less active bleed than the audit implied, and the reason matters: **removing the food
worlds in pass 1 already made most of it unreachable.** The food UI inside the category
browser all sat behind one flag (`isDining`) that can no longer be true. It was dead
code rather than misbehaving code.

Reported honestly rather than overstated — the pass is still worth doing (dead food logic
inside a fashion screen is exactly how the next person gets confused), but it was not the
dangerous operation it was billed as.

## The three cuts

1. **The fashion product grid stopped shipping a food attribute.** Every product in every
   category browse carried `veg_flag`. Removed from the query and the response shape.

2. **A kept feature stopped being scoped to a business that no longer exists.** The
   "places you haven't reviewed yet" list was hard-filtered to restaurants. Reviews
   SURVIVE the cut (founder kept them); restaurants do not — so that list could only ever
   return nothing. Widened to any completed purchase.

3. **The food UI inside the category browser.** The craving rail, the three food filter
   chips (Veg · ₹99 & under · delivery under 30 mins), the restaurant result card, the
   dining store card with its "₹X for two", and all their state, effects and styles.
   267 lines.

## An important thing that was NOT cut

`restaurant_reviews` **looks** like bleed and is not. It is the reviews feature the
founder kept — the table is simply named after the era it was built in, and it now
serves every kind of shop. It is joined on every product card deliberately, to show a
brand's rating. Renaming it is a data change, which is pass 4 at the earliest.

Catching this before deleting it is the whole reason this pass is done slowly.
