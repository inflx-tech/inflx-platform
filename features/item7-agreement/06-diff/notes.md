# item7-agreement — before / after

**Before:** the founder's locked mockups (`04-preview/mockups/item7-agreement-locked.html`, P1–P16).
On the phone before this item: the "Send agreement" chip rendered on every accepted creator and fired
a **"Coming soon"** toast; the creator's **Active** tab was a hardcoded no-op with a comment saying
"Active arrives with item 7"; there was no agreement screen and no signature affordance of any kind in
either app. On the server: a contract row held the fee and the posting date and re-joined everything
else live, so editing an invitation silently rewrote a signed agreement; the cutoff never reached the
signing endpoints; neither signature was a compare-and-swap; a Pay for Sale countersignature locked no
row anywhere; the creator lost 1–3% of every tranche to a fee the brand was separately charged 8% for;
the three tranche amounts were an unrounded float; `escrow_release` was written nowhere; the shoot plan
could be opened on an unsigned agreement; and an unsigned contract was hard-deleted with no trace.

**After:** the screens as built, verified by render tests (14 new; whole mobile suite 493 / 493) and
the rules verified against a real database (42 new; full suite 229 failed / 1024 passed / 1253, 0 new
failures against the item 6 baseline of 229 / 982 / 1211). No device was attached to this session, so
there are no phone screenshots; the founder's walk happens with the end-to-end pack after this item.

## Screen by screen

| Mockup | Built as | Differences from the mockup |
|---|---|---|
| P1 Where the agreement starts | `BrandSetDetailScreen` | The group keeps item 5's title "Waiting to answer"; the row's own line says "Agreement sent 14 Sep", which is what the mockup's caption actually conveys. |
| P2 The preview | `brand/BrandAgreementScreen.js` (preview mode) | None. |
| P3 Sending it | `SendAgreementSheet7` | None. |
| P4 The agreement arrives | `CollabsScreen` + `InvitationCard5` | None. Tapping the card opens the agreement rather than the invitation. |
| P5 Creator · reading it | `influencer/AgreementScreen.js` | None. |
| P6 Creator · signing | `CreatorSignSheet7` | None. |
| P7 Signed, waiting | `AgreementScreen` | None. |
| P8 Declining | `DeclineAgreementSheet7` | Five reason chips, as drawn; item 5's "Not my kind of brand" is not offered here because the agreement, not the brand, is what she is answering. |
| P9 Signing with the money in view | `BrandAgreementScreen` | None. Every number comes from `GET …/agreement/cost`; nothing is computed on the phone. |
| P10 Not enough money | `ShortfallCard7` | "Add to wallet" opens brand-web's wallet page, because neither phone app has a wallet screen until item 9. |
| P11 The last signature | `BrandSignSheet7` | None. For Pay for Sale the second tick says signing completes the agreement instead of naming money. |
| P12 Both signed | `BrandAgreementScreen` | The shoot-plan button routes but is inert until items 10 and 11. |
| P13 **The document** | `services/agreementDocument.service.js` | It is a PDF, not a screen. It renders only from the snapshot, and it cannot be produced before both signatures exist. |
| P14 Withdrawing | `WithdrawAgreementSheet7` | None. |
| P15 Every ending | `agreementCopy.ENDING` through `StateBox7` | The four sentences appear on the agreement screen and on her card rather than on a separate list screen. |
| P16 It moves to Active | `CollabsScreen`'s Active tab | None. |

## Behaviour changes a user could notice

**Money.** A creator now receives her tranche in full; the tier fee no longer comes out of it. A Hybrid
deal locks the fixed fee alone, with no campaign fee. A brand's "reserved" figure comes back down as
tranches release, instead of only ever growing. The three payments always sum exactly to the fee.

**Safety.** A double-tapped countersignature now locks once and pays once, on every Aim. Neither side
can sign after the set's cutoff. The shoot plan cannot be reached without both signatures.

**The record.** An agreement is never deleted — declining, withdrawing, expiring and item 6's
move-answer all leave a row with its ending on it. The document is produced only at completion, reads
only from the snapshot, and is handed out on a five-minute link rather than an hour-long one.

**On the website.** Approve & Send answers "Agreements are sent from the Brand app." Signing still
works there and now quotes the same number the phone does.
