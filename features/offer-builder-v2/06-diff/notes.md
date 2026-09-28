# offer-builder-v2 — before / after

**Before** = the locked board `04-preview/mockups/offer-builder-v2-mockups-v1.html` (O1–O13).
**After** = the brand website run locally (`next dev`, port 3002) against a local backend on a private
scratch database (`inflx_preview` on the 5544 instance — never production), seeded with one fashion
brand (Urban Threads), 13 products, 2 gift items, one published offer ("Denim Days", holding one pair
of jeans) and one creator (Asha R.) linked to it. Walked on 28 Sep 2026 in the in-app browser,
1440 × 900. Every screen below was opened and used, not just loaded.

| Board | What the screen does now | Same as the board? |
|---|---|---|
| O1 Offers list | Search, type chips, status chips with counts (Live 1 · Scheduled 0 · Draft 0 · Ended 0), "Valid on" date filter; Denim Days row: Discount · Flat, 1 product, 25 Sep – 15 Oct, Live, 1 creator, Open. Tabs show "Products without offers 12" and "Gift items 2". | Yes. The date filter is a date picker ("Valid on") rather than a "Dates: any time ▾" menu. |
| O2 Type | Five cards; "Next: sub-type" creates the draft; the header switches to "Draft saved automatically" and the address to the draft's own. | Yes |
| O3 Sub-type | The chosen type's sub-types only (Bundle: Pick-any / Mix & match / Fixed). BOGO skips the step. | Yes. The board drew all four types side by side as a catalogue; the page shows the one chosen. |
| O4 Name & dates | Name, both dates, the "Why dates come first" note with the real dates. | Yes |
| O5 Pool builder | Browse Men › Bottomwear › Jeans; "All 7 products" lists 7 with Light Wash shown "🔒 In "Denim Days" until 15 Oct" and unticked; "Add 6 to pool"; the tray shows 6, the line "Jeans · all · 6 products · 1 locked and skipped". Search tab with ticks. Filters (sub-category, brand, price range, AND pills) on "Use filters". | Yes |
| O5b Pick-any rule | Adding "Oxford shirt · White" by search to the jeans bundle is refused with the board's sentence word for word. | Yes |
| O6 Numbers (pick-any) | Pick 2 for ₹3,200: "Suggested safe price: ₹2,700 – ₹3,100", band ✓, "✕ The cheapest pair must save at least 10%. Try ₹3,100 or less." At ₹2,999 all ✓. | Yes (the pool's cheapest pair here is ₹3,498, so the saving reads 14%). |
| O7 Review | Summary with Edit links, the nine publish checks all ✓, Save as draft / Publish offer. Publish → the offer page, "Scheduled · starts in 1 day", toast "Published…". | Yes |
| O8 Products without offers | Date picker (today), search, price range; "Joins "Any 2 Jeans for Rs 2,999" on 29 Sep" on the jeans; "Was in "Denim Days", ended 28 Sep" on the Light Wash after Denim Days was ended; Put in offer per row and for ticked rows. | Yes |
| O9 Products | New Offer column (now: name + "until"; next: name + "from"; else "No offer"); clicking it opens the product's panel in the right rail: "Offer now: None · Next offer: Any 2 Jeans… 29 Sep – 29 Oct". Bulk "Attach offer" is gone. | Yes. The panel sits at the top of the existing right rail rather than beside the table. |
| O10 Offer page | Title, type · deal · dates, status pill with days left, three tiles (Pool, Creators given this offer, Live posts using it = 0 with "Shoppable posts come next"), creators table (Asha R. · Diwali Denim · Set A · 0 · —), the frozen pool. | Yes. Posts and sales are 0 / "—" because posts don't exist yet (spec D11). |
| O11 End now | Dialog: "Every post using this offer leaves the shop… The 1 creator is told." → Ended; Asha received "“Denim Days” has ended" (checked in the database). Remove products: tick → preview dialog → remove. | Yes |
| O12 Price change | Editing Wrangler Regular · Blue ₹1,999 → ₹2,799: dialog names the offer, "The bundle price stays ₹2,999 for any 2", "No creator has this offer yet", and "Also breaks an offer rule: The costliest item (₹2,799) is more than 1.5 × the cheapest (₹1,699)." Cancel / Change price. | Yes. The board's "posts move from Under ₹1,999 to Under ₹2,999" line isn't shown: price bands come with posts (Level 3). |
| O13 Gift items | List (value, stock, used in), the 4-field form beside it, "Restock / edit". | Yes |

## Fixed during the walk
- Search tab showed products as ticked before they were ticked (a display mix-up with the category
  mode) — fixed.
- "All 1 product become free" — reworded.
- Inside Listings, the page's own styles made hints bold and right-aligned and boxed a red title
  inside the red box — the offer screens now keep their own look there.
- **A production fault found on the way:** the brand's own product list (Inventory → "All products")
  answered "Invalid ID format" since 11 Sep: a creator-side route for "a brand's products" was checked
  first and read "me" as a brand id. The route now only accepts real ids. Proved by a test and by
  reproducing it on the untouched code first.

## Not changed, noted
- The Listings page shows a development-only warning when opened on a tab from the address (it
  reads the address before the page is ready). It predates this work; production is unaffected.
