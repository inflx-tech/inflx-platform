# offer-builder-v2 — workflow

Every step names who acts, what the server does, and what they see. "Today" is India's calendar day.

## W1 · Build and publish an offer (O2 → O7)
1. Brand opens Listings → Offers → **+ New offer** → picks a type → Next.
   Server: creates a draft (`engine 2`, name "Untitled offer"). The URL becomes the draft's.
2. Sub-type (skipped for BOGO) → name and both dates. Each change saves.
   Refused: end not after start ("The end date must be after the start date.").
3. Pool: adds lines (category all / tick / filters / search; for free gift also the gift pool with
   gift items). Server resolves each line against the brand's published products, skipping locked
   and duplicate products and saying how many; refuses a second category on a pick-any bundle.
4. Numbers: each change saves; the server returns the checks and, for bundles, the safe price.
5. Review → **Publish offer** with the products shown.
   Server, in one transaction (brand-level advisory lock): re-resolves the pool, re-runs every check,
   compares with what the brand saw, inserts the frozen pool with the locked days, sets `published`.
   Blocked → the reason, naming any product another offer took. Published → Scheduled or Live.
6. **Save as draft** at any step leaves it a draft. Nothing is locked.

## W2 · Delete a draft
Draft → Delete → gone. A published offer answers "A published offer can't be deleted. End it instead."

## W3 · Remove products from a live or scheduled offer (O10 → O11)
1. Brand opens the offer → **Remove products** → ticks products → sees the preview: how many creators
   have the offer (posts: none yet).
2. Confirm → items stamped removed (free at once); refused if it would break the deal (spec D8).
3. Each creator given the offer is told which products left it.

## W4 · End an offer now (O10 → O11)
Confirm → status `ended`, `ended_at` now, each item's locked days cut to end today (a Scheduled offer
frees them entirely). Each creator given the offer is told.

## W5 · A new product is listed (auto-add)
Product created (listing batch, Excel import, single create, legacy bulk upload) → for each published,
not-ended offer of that brand with auto-add on whose category-all / filter line matches the product:
it joins the pool from today (or the start date) unless it's locked elsewhere or excluded.

## W6 · A product's price changes (O12)
1. Brand edits the price → before saving the website asks the server what the change touches.
2. Product in a live/scheduled offer → the warning dialog; Cancel or **Change price**.
3. Saved → each creator given that offer is told "₹old → ₹new". No offer → saves as today.

## W7 · Products without offers (O8)
Pick a date (default today) → published products not locked on that day, with next / last offer.
Tick → **Put in offer** → W1 with those products already in the pool as one line.

## W8 · Gift items (O13)
+ New gift item (name, photo, value, stock) → listed with "Not in any offer" until a gift pool uses it.
Restock by editing stock. The pool builder's "+ New gift item" uses the same form and saves here.

## W9 · Reading offers on Products (O9)
The Inventory table gets an Offer column; the product's panel shows the offer now and the next.
