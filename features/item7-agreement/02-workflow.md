# item7-agreement — workflows

## W1 — The brand sends it (P1, P2, P3)
Set detail → a creator under **Your move** with the **Send agreement** chip (she has accepted and no
agreement has gone out) → `GET /campaigns/:id/sets/:sid/invitations/:ciId/agreement/preview` → the
preview: the reference as `DRAFT`, **The two of you**, **What was agreed** (the §9 list for the Aim),
**Note from you** when there is one, the standard-terms row with its version, and the hint "Nothing
here can be edited. It is built from the terms you both agreed." → **Send for signature** → the P3
confirm listing she signs first, you sign after her, both by the cutoff →
`POST …/agreement/send` → the snapshot is taken, the reference is stamped, the status becomes
`pending_influencer`, and she is notified.

Refused, in the server's exact words: before she has accepted ("{Name} hasn't accepted the terms
yet."), twice ("An agreement is already out with {name}."), and after the cutoff ("Signatures for this
set closed on {date}.").

## W2 — She reads and signs (P4, P5, P6, P7)
Her card stays under **Invites** with a **Your move** chip and "Agreement ready to sign · by 17 Oct";
tapping it opens the agreement, not the invitation. `GET /influencers/me/invitations/:ciId/agreement`
→ **What you get** first — for Pay for Content the fee and the three payments as amounts, for Pay for
Sale the commission and when it is paid — then **What you do**, then the Remote return terms, then the
standard-terms row. **Sign** opens the P6 sheet: her full name pre-filled and editable, two ticks, and
"We record your name, the time and the device you signed from." → `POST …/agreement/sign
{ typedName, ticks }` → her name, the moment, the device and the address are recorded and the brand is
notified.

Afterwards (P7) the screen reads "Signed. Waiting for {Brand} to sign by 17 Oct", shows both signature
boxes, and says plainly what happens if they never sign.

## W3 — She declines instead (P8)
**Decline** → the P8 sheet: what it ends, one of six reasons — **The agreement terms** · Fee too low ·
Dates don't suit · Too much work · Other — and an optional note, with "The brand sees this." →
`POST …/agreement/decline { reason, note? }` → the contract is marked `declined` (never deleted), the
invitation ends, and the brand is told with her reason.

## W4 — The brand signs, and the money moves (P9, P10, P11, P12)
Her row moves to **Your move** with a **Sign** chip and "Signed 14 Sep · waiting for you". Opening it
loads `GET …/agreement` and `GET …/agreement/cost`.

**With enough balance (P9):** the amber "{Name} signed on {date}. Your signature completes it.",
**What it costs you** (the fee, the INFLX campaign fee at its percentage, and a totalled "Locked when
you sign"), **Paid out as** (the three amounts with what triggers each), the green "Your wallet has
₹{n} available. Enough." and the hint about what locking means. The button reads **Sign and lock
₹{n}**.

**Short (P10):** a red card "Add ₹{shortfall} to sign" with "Your wallet has ₹{n} available and this
needs ₹{m}.", a wallet button, "We'll bring you straight back here to sign.", and the sign button
disabled. Until item 9 the wallet button opens brand-web's wallet page.

**The sheet (P11):** the signer's full name with "Signing for {Brand}", a tick for having read it, and
a tick that names exactly what is about to happen — "I understand ₹9,720 will be locked now and ₹2,250
released to Tanvi straight away" — then "After this, the terms can never be changed inside this
collaboration." → `POST …/agreement/sign { typedName, ticks }`.

**Done (P12):** "Signed by both on {date}. This collaboration is live.", both signature blocks, **What
happened just now** — Locked / Released / Still locked — **Next**, and Download plus the shoot-plan
button.

**Pay for Sale** has no money card and no balance check; the button reads **Sign and complete**.

## W5 — Withdrawing (P14)
While she has not signed, the agreement screen offers **Withdraw** → the P14 sheet ("{Name} hasn't
signed yet. She goes back to waiting for an agreement, and you can send the same one again." plus what
to do if the terms need to change) → `POST …/agreement/withdraw` → the contract is marked `withdrawn`,
her invitation returns to `accepted`, and she is told. Once she has signed it is refused: "{Name} has
already signed, so this can't be withdrawn."

## W6 — The cutoff closes what nobody signed (P15)
`jobs/set-expiry.job` (hourly at :40, India) now also calls `agreement.expireForSet`: every agreement
still `draft`, `pending_influencer` or `pending_brand` on that set is marked `expired`, nothing is
locked, and both sides are told. The half-signed case names her by name — "{Name} signed on {date} but
the set closed on {date} before you did. Nothing was locked, and she was told."

## W7 — Active, and the next step (P16)
Both signatures set the invitation to `contracted` and create the production event. Her Collabs
**Active** tab — real for the first time — shows "₹2,250 is in your wallet. Signed 14 Sep." with a
**Next** line and a link to the agreement. The shoot plan and the shipment are gated on both
signatures, including the two endpoints that previously checked none.

## W8 — The document
`GET /agreements/:ciId/document`, for either party, once both have signed. It is produced at that
moment from the snapshot, stored in R2 with a sha256, and handed back as a presigned link good for
five minutes; the phone opens it in the system browser. Before completion it is refused: "The
agreement can be downloaded once you've both signed."

## W9 — Admin: the standard terms
`/admin/settings/terms` → `GET /admin/standard-terms` (any admin role) → the versions, newest first,
with the current one marked → **Publish a new version** → `POST /admin/standard-terms { version, body }`
(`settings` capability) → the new version becomes current and every agreement generated afterwards
carries it. Nothing already generated changes, and `GET /standard-terms/:version` still serves the old
text.

## W10 — The website, unchanged where it works
brand-web's **Approve & Send** now answers "Agreements are sent from the Brand app." Its countersign
still works and goes through the same service as the phone; its displayed lock amount reads the
server's `locked_amount` or the snapshot's `totalToLock` rather than recomputing `fee × 1.08`.
