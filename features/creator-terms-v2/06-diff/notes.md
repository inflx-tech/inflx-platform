# creator-terms-v2 — before / after

**Before** = the locked board `04-preview/mockups/creator-terms-v2-mockups-v1.html` (T1–T7, C1–C5).

**After**, two ways:
- **Phone screens (T1–T7, C1–C5)** — rendered in the phone app's test runner with the board's own
  data (Urban Threads, Diwali Denim · Set A, posting 20 Oct, "20% off Levi's Jeans", "Buy 2 T-shirts
  → 30%", "Any 2 Jeans for ₹2,999"), and every sentence on the board asserted word for word
  (`item5Brand.test.js` I3–I5 and I8; `creatorTerms12.test.js`). **Not yet walked on a phone**: the
  device walk follows the OTA (walkthrough protocol; founder's walk after signing).
- **Website (the End offer warning, Q1)** — walked on 28 Sep 2026 in the in-app browser against a local
  backend on the private scratch database (`inflx_preview`, migration 194 rehearsed on it first — never
  production), with one unsigned invitation holding "Any 2 Jeans for Rs 2,999".

| Board | What the screen does now | Same as the board? |
|---|---|---|
| T1 Terms card | "You can sell" with two rows, Offers and Products without offers; the old scope chips, offer row and special offer are gone; commission required; the minimum warning never blocks. | Yes |
| T2 Offers sheet | "Offers for Priya", the offers valid on the posting day (20 Oct) with type, deal, products, dates; "⚠ Ends 25 Oct, 5 days after posting. Her posts using it leave the shop then."; "2 offers aren't listed: one starts 30 Oct, one ended 5 Oct." | Yes |
| T3 Products without offers | None / All / Choose; "3 products, fixed when you send"; "Sold at normal price. Only products not in any offer on or after 20 Oct are shown."; "To give a product that's in an offer, give its offer." | Yes |
| T4 Choose products | Full screen: Categories and Search tabs, price range, ticks; "₹1,299 · offer ended 5 Oct"; "1 picked · Shirts". | Yes |
| T5 Summary | "She can sell: 2 offers (39 products)" / "She can sell: 3 products at normal price" under the card; "Use these terms for everyone" copies offers and the product list. | Yes |
| T6 No offer on the day | "No offers valid on 20 Oct" · "Offers are built on the INFLX website. Build one that runs on 20 Oct or 21 Oct, or give her products without offers instead." | Yes |
| T7 Review | Rows "10% · 1 offer + 1 product", "12% · 1 offer · no other products", "10% · 40 products at normal price"; Below min / Ends soon / OK; "⚠ 1 creator was given an offer that ends 5 days after posting."; Send carries offers + products. | Yes |
| Website End offer | Dialog adds "It's in 1 unsigned invitation. It drops out of it and the creator is told. An invitation left with nothing to sell is withdrawn." Ending → "Offer ended. Its products are free from today. 1 creator was told. Taken out of 1 unsigned invitation."; the creator received "“Any 2 Jeans for Rs 2,999” was taken out of your invitation" (checked in the database). | Yes (the board shows the warning in words; the page is the Level 1 dialog with it added) |
| C1 Invitation | One row "You can sell · 2 offers + 12 products ›", opens What you can sell. | Yes |
| C2 What you can sell | Header line with her %, each offer's deal, "24 products · 1 Oct – 31 Oct", "You earn · 10% of ₹2,099 = ₹210"; "AT NORMAL PRICE · 12" opens the list; the end rule; no Counter. | Yes |
| C3 One offer | How it works for shoppers, the dates with the year, what she earns, the products. | Yes |
| C4 Agreement | Her offers with deal and dates, products at normal price, "When an offer ends…". | Yes |
| C5 Notices | The Notifications screen lists them; an offer or product notice opens What you can sell, an invitation notice opens the invitation. | A screen added (spec D11): the board drew the notices, the profile-only app had nowhere to show them. |

## Fixed during the walk
- The seeded invitation also held an offer that had **already ended** without its link being dropped.
  Ending the last live offer then left the invitation "with something to sell" (the ended offer), so
  it wasn't withdrawn. The emptiness check now ignores ended offers; a check proves it (15b).
