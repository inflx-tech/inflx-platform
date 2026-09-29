# shoppable-posts-v2 — before / after

**Before** = the locked board `04-preview/mockups/shoppable-posts-v2-mockups-v1.html` (P1–P20).

**After** = the creator app's new Create tab screens, rendered in the phone app's test runner with the
board's own data (Urban Threads, Diwali Denim · Set A, posting 10 Oct, "Any 2 Jeans for ₹2,999",
"Weekend denim", "Festive picks", "T-shirt stack", "Goa trip edit"), each sentence of the board asserted
word for word (`create13.test.js`, 22 checks), and the server behind them proved end to end
(`shoppable-posts-v2.test.js`, 35 checks, real signed uploads). The full app bundle builds. **Not yet
walked on a phone**: the device walk follows the OTA, once a collaboration on the new terms is signed and
its shoot is done (none in production yet).

| Board | What the screen does now | Same as the board? |
|---|---|---|
| P1 Create tab | "Needs a shoppable post · 1", "Urban Threads · Set A", "0 of 1 · before 10 Oct", Start; New shoppable post / New collection; "Your posts · n" with See all; rows with offer and earnings; "Collections · 2". | Yes. The phone has a "Create" tab, not a middle "+"; the "+" is in the tab's header and asks post or collection (P16). |
| P2 Brand | "Step 1 of 8", "Which brand is this post for?", a brand waiting for its shoot greyed "Opens after your shoot plan", the one-brand hint. | Yes |
| P3 Collaboration | "2 offers + 12 products · posts on 10 Oct", "0 of 1 posts done · earning 10%" / "earning 8% + ₹5,000". Next makes the draft. | Yes |
| P4 Post type | Offer post / Price post with counts; an impossible one greyed with the reason. | Yes |
| P5 Offer | "Discount (1)", "Bundle (1)"; "BOGO, Volume and Free gift aren't shown because this collaboration has none."; one offer per row with its end date; the ends-soon warning. | Yes |
| P6 Pick-any | "Pick at least 2 so a shopper can complete the bundle from this post."; "2 picked ✓"; Next off until met. | Yes |
| P7 Other offers | Discount prices as shoppers pay; "All 2 products are added for you"; "Free with this: Leather cap, Canvas belt or Silver coin. The shopper chooses one when spending ₹3,000." | Yes |
| P8 Price post | The five bands; "Shows your products up to ₹999, including cheaper ones."; "Men › Topwear" with leaf chips; the list filters. | Yes |
| P9 Theme | The four groups; "Season · 1 picked", "Use · optional"; another tag in a group swaps it. | Yes |
| P10 Media | Photo / Video, Single / Carousel, the slide strip with +, the music warning at the upload, tag looks. | Yes |
| P11a Tag products | Tap the photo, pick the product; "on photo 1" / "not tagged on a photo yet, still in the post". | Yes (rendered in code; the tap itself is proved on the phone walk). |
| P11 Review | "How shoppers will find it": Category "Men › Bottomwear › Jeans · from your products", Offer "Bundle · Any 2 for ₹2,999 · from your offer", Price "Under ₹2,999 · costliest item ₹2,499", Theme; For; Products; "Send to INFLX for review". | Yes |
| P12 In review | "WEEKEND DENIM", "In review since 8 Oct", "Usually within a day.", who checks it, "On 10 Oct, your posting date, once approved." | Yes |
| P13 Sent back | What INFLX said (quoted), what she can change, Fix and send again, Start over, "Your posting date hasn't moved". Plus Delete (spec D12). | Yes |
| P14 Your posts | Live · In review · Sent back · Removed · Drafts with counts; "Offer ended 15 Oct · 7 sales · ₹610 to you"; "Saved at step 6 · 14 Oct" carries on at step 6. | Yes |
| P15 Removed | "Removed from the shop on 15 Oct", the reason in her words, sales and earnings, the return-window line. | Yes |
| P17 Collections | "Shoppers see these in your store.", rows with brands and earnings, "0 of 3 posts still in the shop", Hidden, the hidden hint. | Yes |
| P18 / P19 New collection | Name, My posts / Products; products grouped by collaboration with "₹849 · normal price" / "₹1,899 with 20% off"; "Create collection · 1 product". | Yes |
| P20 One collection | Items, a post that left the shop greyed ("Left the shop 15 Oct"), remove, Add posts, Rename, Delete, the hint. | Yes |
| Admin · Posts (website, no board) | New posts show "Offer post · Bundle · Any 2 for ₹2,999", "For Urban Threads · Diwali Denim · Set A · posts on …", the facets; videos play; "Send back"; a "Left the shop" tab. | Existing page extended (build checked, not walked: it needs a sent post, which needs a signed new-terms collaboration). |

## Found while building
- Deleting a product only hid it and skipped the product-change hook, so a deleted product stayed in
  posts and her Level 2 "no longer on sale" notice never went. The delete now runs the same hook (check 24b).
- The phone's accessibility rule caught a "checked" state that could carry a non-boolean — fixed.
- The website offer page's "Live posts using it" and each creator's posts were placeholders at 0 since
  Level 1; they now count real posts.
