# item7-agreement — expected outputs

The 32 checks in the gap-check prompt (§12.1) plus the nine added in the approval message (§6.1).
Backend evidence is `backend/tests/item7-agreement.test.js` (42 tests, all passing); app evidence is
`Packages/Mobile/src/screens/influencer/__tests__/item7Creator.test.js` (8) and
`Packages/Mobile/src/screens/brand/__tests__/item7Brand.test.js` (6). "Founder walk" marks a check
whose remaining half is a device walk, which happens with the end-to-end pack after this item.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | An accepted creator shows "Send agreement"; one who has signed shows "Sign" | PASS | backend "an accepted creator shows…" · app P1 "two different 'your move's sit together" |
| 2 | The preview shows every term for the Aim, and nothing for the wrong Aim | PASS | backend "Pay for Sale shows commission, selling scope and the shoppable minimum…" |
| 3 | Pay for Sale / Pay for Content / Hybrid each show their own terms | PASS | backend three tests, one per Aim · app "a Pay for Sale agreement shows commission…" |
| 4 | The brand's note appears when there is one and is absent when there isn't | PASS | backend "the brand's note appears when there is one…" |
| 5 | The follower offer, the campaign description and the branch street address never appear | PASS | backend "the follower offer, the campaign description and the street address never appear" — asserted against the snapshot, where they are excluded at generation |
| 6 | The three tranche amounts sum exactly to the fee, including odd amounts | PASS | backend "the three tranche amounts sum exactly to the fee…" — ₹9,999 → 2500 / 2500 / 4999 |
| 7 | Sending stamps a unique reference and the standard-terms version, and notifies her | PASS | backend "sending stamps a unique reference…" |
| 8 | Sending before she accepted, twice, or after the cutoff is refused with the exact message | PASS | backend "sending before she accepted, twice, or after the cutoff…" |
| 9 | The API refuses any attempt to change a sent agreement | PASS | backend "the API refuses any attempt to change a sent agreement" — the snapshot and the reference are unchanged by the one door that used to rewrite terms |
| 10 | The brand cannot sign before she has | PASS | backend "the brand cannot sign before she has" — and nothing moved |
| 11 | She signs: the name, time, device and IP are recorded, and the brand is notified | PASS | backend "she signs: the name, time, device and IP are recorded…" and "a typed name and both ticks are required" · app P6 |
| 12 | Signing twice, or from two devices at once, produces one signature | PASS | backend "signing twice, or from two devices at once, produces ONE signature" — two simultaneous requests, one 200 and one 422 |
| 13 | Neither side can sign after the set's cutoff | PASS | backend "neither side can sign after the set's cutoff" |
| 14 | **Pay for Content:** the signature locks the fee plus the campaign fee and releases exactly 25%, in one transaction | PASS | backend "Pay for Content locks the fee plus the campaign fee…" |
| 15 | **Hybrid:** the fixed fee alone is locked, with no campaign fee | PASS | backend "Hybrid locks the fixed fee alone…" |
| 16 | **Pay for Sale:** nothing is locked and the agreement completes | PASS | backend "Pay for Sale locks nothing and the agreement completes" |
| 17 | A short balance refuses the signature, returns the shortfall, locks nothing, leaves her signature intact | PASS | backend "a short balance refuses the signature…" · app P10 |
| 18 | After adding money the same signature succeeds, and nothing was double-locked | PASS | backend "after adding money the same signature succeeds…" |
| 19 | A failure anywhere in the signing transaction leaves no money locked and no signature | PASS | backend "a failure inside the signing transaction…" |
| 20 | Both signatures move it to Active on both sides, with the first payment in her wallet | PASS | backend "both signatures move it to Active on both sides…" · app P16 |
| 21 | The next step opens: shoot plan for Store Visit, shipment for Remote | PASS | backend "the next step opens: a production event exists once both have signed" |
| 22 | Withdraw works only before her signature and returns her to accepted; the same agreement can be sent again | PASS | backend "withdraw works only before her signature…" · app P14 |
| 23 | She declines with a reason; the brand sees it; the invitation ends; she can be invited again | PASS | backend "she declines with a reason…" · app P8 |
| 24 | An unsigned agreement at the cutoff expires with nothing locked, and both sides are told | PASS | backend "an unsigned agreement at the cutoff expires…" |
| 25 | A half-signed agreement at the cutoff tells her by name that nothing was locked | PASS | backend "a half-signed agreement at the cutoff tells her by name…" |
| 26 | The PDF is produced only at completion and matches the signed terms | PASS | backend "the document is produced only at completion…" — null after send, null after her signature, present with a sha256 after his |
| 27 | Downloading before completion, or by anyone but the two parties, is refused | PASS | backend "downloading before completion, or by anyone but the two parties, is refused" — and the link lives 300 seconds |
| 28 | Updating the standard terms does not change an agreement already generated, and an old version is still served | PASS | backend "updating the standard terms does not change an agreement already generated…" |
| 29 | Another brand's or another creator's agreement, signature or document returns 404 | PASS | backend "another brand's or another creator's agreement returns 404" |
| 30 | No creator response contains the brand's balance, internal notes, the campaign description, or another creator's anything | PASS | backend "no creator response carries the brand's balance, notes or another creator's anything" |
| 31 | Loading, empty and couldn't-load states appear on every new screen | PASS (app) / PASS (API) | backend "loading and empty states answer rather than crash"; both new screens use the shared `Skeleton` / `LoadError` / `EmptyState`. Founder walk confirms the rendering. |
| 32 | Backend tests show no new failures against the Phase 1 baseline | PASS | see `05-impact.md` — 229 failed / 1024 passed / 1253 against the 229 / 982 / 1211 baseline |
| 33 | **Two simultaneous countersignatures produce one lock, one set of escrow entries and one tranche-1 release** — on Pay for Content **and** Pay for Sale | PASS | backend "two simultaneous countersignatures produce ONE lock…" and "…on a PAY FOR SALE contract also produce one of everything". Both are real concurrent requests, not sequential retries. |
| 34 | The three tranche amounts sum exactly to the fee for ₹9,999 and ₹10,001, in the escrow rows and on every screen | PASS | backend check 6's test plus "she receives the tranche IN FULL"; one shared `splitAmount` serves the escrow writer and every screen |
| 35 | A creator receives her tranche in full, with no tier fee deducted, on Pay for Content and on Hybrid | PASS | backend "she receives the tranche IN FULL — no tier fee is taken" — `escrow_fee_amount` and `fee_gst_amount` are zero and `net_to_influencer` equals `amount` |
| 36 | Hybrid locks the fixed fee with no campaign fee; Pay for Content locks fee + campaign fee; Pay for Sale locks nothing | PASS | the three money tests above, plus the Hybrid preview |
| 37 | `reserved_balance` goes back down as tranches release | PASS | backend "reserved_balance comes back down as tranches release" — 6750 after the signature, 0 once all three have released |
| 38 | The shoot plan cannot be reached, by either bypass endpoint, without both signatures | PASS | backend "the shoot plan cannot be reached by either bypass without both signatures" |
| 39 | No path deletes a contract row: declining, withdrawing, expiring and item 6's move-answer all leave a row with its ending recorded | PASS | backend "NO path deletes a contract row — every ending is recorded" |
| 40 | Changing `campaign_fee_pct` or either return window afterwards does not alter a sent or signed agreement, and does apply to the next | PASS | backend "changing an admin number afterwards does not alter a sent agreement…" |
| 41 | brand-web's Approve & Send shows its new message, and its lock amount matches the phone for the same deal | PASS (API) | backend "the website door and the phone door enforce the same money" and "the pending list carries what the website needs to quote the same number". The message itself is one line in `app/dashboard/campaigns/[id]/influencers/page.js`; founder walk confirms it on screen. |

## Two further guards, not on the list
- **The signature timestamps are the only definition of "signed by both"** (approval Q11).
  `collabCounts` no longer reads `status === 'active'`, so the four seeded production rows read as
  unsigned, which is the truth about them.
- **The brand's Needs You learns both agreement moves.** `agreements_to_send` and
  `agreements_to_sign` are counted for the first time; a draft sitting unsent used to be invisible in
  every Needs You number.
