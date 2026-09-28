# creator-terms-v2 — expected outputs: the checks

Each check names the test that proves it. Status comes from the test run, never by hand.
Backend: `backend/tests/creator-terms-v2.test.js` (real API, real database). Phone:
`Packages/Mobile/src/screens/brand/__tests__/item5Brand.test.js` (brand, I3–I5 and I8) and
`Packages/Mobile/src/screens/influencer/__tests__/creatorTerms12.test.js` (creator, C1–C5).

| # | Check | Proved by | Status |
|---|---|---|---|
| 1 | The offers a brand can give: published, running on the posting date or starting the day after; others listed as left out with why and the date | backend "valid on the posting date or the day after…" | pass |
| 2 | Another brand's set answers 404 | backend "another brand's set answers 404" | pass |
| 3 | Products without offers: only those not held by an offer on or after the posting date; an offer that ended before it frees them | backend "only products not held by an offer…" | pass |
| 4 | Sending links the offers (not copied), freezes the products, writes nothing of the old scope, offer or code | backend "offers linked (not copied)…" | pass |
| 5 | "All products without offers" is the list on the day of sending; later products don't join (Q2) | backend "…the list on the day of sending…" | pass |
| 6 | Refused: nothing to sell (her first name), an offer not running on the day, another brand's offer, a product in an offer, the old scope | backend "refused: nothing to sell…" | pass |
| 7 | Pay for Sale commission must be above 0 | backend "Pay for Sale commission must be above 0" | pass |
| 8 | The brand reads "10% · 2 offers + 1 product"; the invitation carries the sell block | backend "the brand reads…" | pass |
| 9 | C1: one "You can sell" row; no old scope or shopper offer | backend "the invitation (C1)…"; phone C1 | pass |
| 10 | C2: each offer's deal, products, dates, thumbnails, what she earns; the normal-price list; read-only | backend "what you can sell (C2)…"; phone C2 | pass |
| 11 | C3: how it works for shoppers, dates, you earn, every product; another creator's or an unlinked offer answers 404 | backend "one offer (C3)…", "another creator…404"; phone C3 | pass |
| 12 | C4: the agreement lists her offers as of signing, the products at normal price and the end rule; counters change money only | backend "the agreement lists her offers…", "countering changes money only…"; phone C4 | pass |
| 13 | The brand is warned before ending: the number of unsigned invitations holding the offer | backend "dropped from unsigned invitations…" (`unsigned_invitations`); website walk (06-diff) | pass |
| 14 | Ending drops the offer from unsigned invitations with a notice; signed collaborations keep it | backend "dropped from unsigned invitations…" | pass |
| 15 | An invitation left with nothing to sell is withdrawn, and she's told | backend "dropped from unsigned invitations…" | pass |
| 15b | An offer that had already ended doesn't count as something left to sell | backend "an offer that had already ended…" | pass |
| 16 | Out of stock, off sale and a new normal price reach the creators who can sell the product | backend "out of stock, off sale, and a new normal price…" | pass |
| 17 | T1–T7 on the phone: the sell rows, the offers sheet (ends soon, left out), products sheet, choose screen, summary, no-offer screen, Review chips and banner, Send carries offers + products | phone I3–I5, I8 (item5Brand) | pass |
| 18 | The old readers accept the new terms: the publish check and her sellable list (offers + products) | backend "the publish check doesn't call…" | pass |
| 19 | C5: the notices screen opens What you can sell or the invitation | phone C5 | pass |
| 20 | Migration 194 applies twice cleanly; no collaboration changes; no money moves | `scripts/run-194.js --dry` then `--apply` twice on the scratch database | pass |
| 21 | Nothing else regresses: full backend suite serially vs the Level 1 record; full phone suite | `backend/scripts/compare-tests.js` (0 newly failing); phone `jest` 723/723 | pass |
