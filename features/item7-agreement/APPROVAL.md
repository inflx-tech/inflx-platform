# item7-agreement — approval

The founder's message `INFLX_Item7_Implementation_Prompt.md` (14 Sep 2026) opens with "The item 7 gap
report is approved. Start building." and adds: "It found three live defects on the money path that
matter more than anything item 7 adds, and it was right to say so plainly." It is kept verbatim as
`PROMPT.md`. This file records what it decided.

## The order of work, as instructed
**The safety fixes come first, before any new feature.**
1. **Phase 2a** — the guarded UPDATE on both signatures, the `rowCount` check, the unique index on
   `escrow_entries`, the exact-sum split helper, the `escrow_release` write.
2. **Phase 2b** — migration 183, the snapshot, send, both signature paths with the cutoff, the Aim
   branch on the money, withdraw, decline, the expiry job, the standard terms, the document.
3. **Phase 3** — the screens.
4. **Phase 4** — tests, then the full end-to-end pack across items 2–7.

## The twelve answers

| # | Question | Answer |
|---|---|---|
| Q1 | Where does the campaign fee live? | **A percentage, admin-controlled, Pay for Content only** — `campaign_fee_pct`, default **8%** so nothing changes commercially on the day it ships. Charged once, to the brand, when the funds lock. `platform_fee_pct` is left alone: it is the commerce fee and has its own job. |
| Q2 | Two fee systems on one deal | **The escrow tier fee must not be taken from a fee tranche.** The creator receives the full agreed amount on Pay for Content and Hybrid. `escrow_fee_tiers` is not deleted, and every other use of it is reported and left alone. The deciding argument: "The agreement is now an evidentiary document that prints '₹2,250 when you both sign'. Paying her ₹2,182.50 would make our own document false." |
| Q3 | Reserve, or keep decrementing? | **Keep the destructive decrement** — every reader already agrees with it and Phase 1 has no path that voids a signed agreement. One condition: **fix the missing `escrow_release` write**, and write a note in the summary saying what must change when cancellation and disputes arrive. |
| Q4 | Fix the signing idempotency here? | **Yes, and first.** "Two simultaneous countersignatures double-locking a brand and paying tranche 1 twice is the worst thing in this codebase." Prove it with a concurrent test, and guard the Pay for Sale case too, where nothing was locked so nothing was serialised. |
| Q5 | The return window says 7, the database says 30 | **Seven, and the config is wrong** — set `return_window_days` to 7 and always print from the config. **"If thirty was a deliberate decision somebody made, stop and tell me before changing it."** |
| Q6 | Where does the Remote return term come from? | **A platform sentence plus a fourth admin number** — `remote_return_days`, default 7, and the brand pays the return shipping. Now in the rules doc §9 and in the standard terms. |
| Q7 | The document on the phone | **Native views, and `Linking.openURL` for Download.** Shipping over the air is worth more than a nicer viewer today. Two conditions: shorten the presigned link to **five minutes** and log every issue. An in-app viewer waits for another reason to rebuild the APK, and is a known limitation, not done. |
| Q8 | What happens to an unsigned contract row? | **Nothing deletes a contract row, anywhere.** Every path marks instead: `declined`, `withdrawn`, `expired` — including invitation decline and item 6's move-answer. A draft that was never sent takes the ending its invitation took. |
| Q9 | Does Send replace Approve & Send? | **Yes, and go one step further** — switch brand-web's Approve & Send off with a message, as item 4 did with the invite button. Custom clauses and the bonus are in neither the rules nor the mockups and must never reach the phone. **Web signing stays**, because the server does the real money maths, but the web's displayed lock amount must read C4 instead of its own `fee × 1.08`. |
| Q10 | Who is the brand's signer? | **A named person**, pre-filled from `users.name`, editable, stored, and printed as "{Name}, for {Brand}". |
| Q11 | Two definitions of "signed by both" | **The signature timestamps win everywhere.** Stop reading `status === 'active'` as signed. The four seeded contracts then read as unsigned, which is the truth about them. |
| Q12 | The assumptions | **Both confirmed** — available balance is the wallet balance, and the PDF is produced only at completion, so the generate call at `approveContract` is removed. |

## The mockups were updated
The campaign fee arithmetic was illustrative and is now consistent at 8%: P9–P12 read "INFLX campaign
fee · 8% — ₹720", the total locked is ₹9,720, the shortfall is ₹3,720 and "still locked" is ₹7,470;
P13's fee row reads "₹720 (8%), paid by the brand" and gains a fifth clause — "The creator receives the
fee in full. The INFLX campaign fee is paid by the brand and is never deducted from a creator payment."
**None of these numbers is a constant.** Every one is computed from the fee and the admin setting.

## The rules doc was updated
**v1.20** replaces v1.19, with two additions to §9 and one line tying the three admin numbers to the
same screen as item 6's:
1. The creator receives the agreed amount in full; no platform charge of any kind is deducted from a
   creator payment on Pay for Content or Hybrid.
2. The Remote return window (admin-controlled, seven days by default) and that the brand pays the
   return shipping.

## Five further decisions
1. **Close the production bypass.** Gate both `POST /contracts/:id/production/initialise` and the
   auto-heal on `GET /contracts/:id/production` on **both signatures present**, and report what else
   calls them and the `ci.status = 'live'` filter that names a value the enum does not have.
2. **The stamped numbers are stamped, not read later.** `campaign_fee_pct`, `return_window_days` and
   `remote_return_days` are copied into `terms_json` at generation. A later admin change must never
   alter a document that has been signed — or one that has been sent.
3. **`autoCreate` must stop being ambiguous.** It returned `null` both when the contract already
   existed and when the invitation was not found. Make the two distinguishable and put its writes in
   one transaction.
4. **One shared split helper, used everywhere.** Extract the correct one, use it in both places,
   delete the wrong one, and prove it with ₹9,999 and ₹10,001.
5. **The draft stays.** Leave the draft `autoCreate` makes and have "Send agreement" fill it in and
   stamp it. Snapshotting at accept would freeze terms item 6 can still change.

## Approved as written
Migration 183 exactly as proposed, including the three new statuses, the reference sequence, the
`standard_terms` table seeded at 1.0 with the seven sentences verbatim, and the unique index on
`escrow_entries (campaign_influencer_id, tranche_number)`. `terms_json` written once at send, guarded
by `WHERE sent_at IS NULL`. The cutoff called in both signing paths. The set-expiry job extended. The
standard terms as their own table with an admin page beside item 6's. The document at completion only,
from the snapshot alone, with a sha256, a five-minute link and the exclusions. The signature record on
both sides. The frontend plan including the Creator app's Active tab. **No backfill, and never invent
a signature** — the seeded rows stay exactly as they are.

## Also asked for
- **Nine more checks, 33–41**, added to the 32 in the gap-check prompt. All forty-one are recorded in
  `03-expected-outputs.md`.
- **A final summary** covering the money safety fixes with the concurrent test result, what INFLX now
  earns on a Pay for Content deal as one worked example, migration 183 with its counts, the snapshot
  and proof the document cannot drift, the standard terms and how an old version is served, what item
  9 still owns and the Q3 note about cancellation, the PDF-viewer limitation stated as a limitation,
  the test result against 229 / 982 / 1211, every check 1–41, and anything left open before the
  end-to-end pack.

## Standing constraint
"If anything comes up that none of these cover, stop and ask me. Don't guess." Production-impacting
deploys need an explicit go before migrate / push / OTA.
