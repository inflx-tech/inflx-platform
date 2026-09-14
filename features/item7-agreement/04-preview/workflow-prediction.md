# item7-agreement — workflow prediction

Mockups: `mockups/item7-agreement-locked.html` (P1–P16, founder-locked and amended after the gap
report so the campaign fee arithmetic is consistent at 8%; the approval message says only those
numbers changed).

| Screen | Predicted | Built as |
|---|---|---|
| P1 Where the agreement starts | two different "your move"s together — one needs an agreement sent, one has signed and waits; the cutoff line; "Agreement sent {date}" under Waiting; "Signed by both {date}" with an Active chip | `BrandSetDetailScreen` + `SetCreatorRow5`, driven by `invitationRows.service`'s `sendAgreement` / `signAgreement` actions |
| P2 Brand · the preview | the reference as DRAFT, The two of you, What was agreed, Note from you, the standard-terms row, "Nothing here can be edited" | `brand/BrandAgreementScreen.js` in preview mode + `Reference7`, `Card7`, `TermRow7`, `StandardTermsRow7` |
| P3 Brand · sending it | the confirm listing she signs first, you sign after her, both by the cutoff | `SendAgreementSheet7` |
| P4 Creator · the agreement arrives | it stays under Invites, the chip turns to Your move, "Agreement ready to sign · by 17 Oct" | `CollabsScreen` + `InvitationCard5`, group `toSign` |
| P5 Creator · reading it | What you get first with the three payments as amounts, then What you do, return terms, the standard-terms row, Sign and Decline | `influencer/AgreementScreen.js` |
| P6 Creator · signing | typed full name, two ticks, what we record | `CreatorSignSheet7` |
| P7 Creator · signed, waiting | the blue box, both signature boxes, what happens if they never sign | `AgreementScreen` + `SignatureBlock7`, `StateBox7` |
| P8 Creator · declining | what it ends, six reasons, an optional note the brand sees | `DeclineAgreementSheet7` |
| P9 Brand · signing, with the money in view | What it costs you, Paid out as, the green balance line, "Sign and lock ₹{n}" | `BrandAgreementScreen` + `MoneyRow7`, `TotalRow7` |
| P10 Brand · not enough money | the shortfall as an amount, a wallet button, "We'll bring you straight back here", the sign button disabled | `ShortfallCard7` |
| P11 Brand · the last signature | the signer's name, the tick that names the money, what becomes irreversible | `BrandSignSheet7` |
| P12 Both signed | the two signatures, What happened just now, Next, Download and the shoot-plan button | `MoneyMoved7` + `SignatureBlock7` |
| P13 **The document** | title, the parties, The work, The money, Also agreed as numbered clauses, two signature blocks with name, time, device and IP, the standard-terms footer | `services/agreementDocument.service.js` (pdfkit), rendered **only** from `contracts.terms_json` |
| P14 Brand · withdrawing | possible only while she has not signed, and what to do instead | `WithdrawAgreementSheet7` |
| P15 Every ending | four sentences, each with a date, each saying no money changed hands | `agreementCopy.ENDING`, shown through `StateBox7` on both agreement screens and on her card |
| P16 Creator · it moves to Active | the Active tab, "₹2,250 is in your wallet. Signed 14 Sep.", a Next line and a link to the agreement | `CollabsScreen`'s Active tab, real for the first time |

Deliberate departures, all forced by things the gap report found:

- **The document is not viewable inside the app.** No native module for viewing, downloading, saving
  or sharing a file is in the binary, and adding one needs an APK rebuild rather than an over-the-air
  update. Approved Q7: the agreement is drawn as native views for reading and signing, and **Download**
  opens the system browser on a five-minute presigned link. P13 is the PDF's own page style, not a
  screen in the app.
- **P10's "Add to wallet" opens brand-web.** Neither phone app has a wallet screen — both tabs are
  "coming soon" — so until item 9 the button goes to the website's wallet page through the existing
  `openWebDashboard` helper.
- **P12's shoot-plan button routes but does nothing yet.** Items 10 and 11 build what is behind it.
- **P1's group titles are item 5's.** "Waiting to answer" holds an agreement that is out and unsigned,
  and the row's own line says "Agreement sent 14 Sep", rather than renaming a group item 6's tests lock.
