# INFLX — Item 7: The agreement, and the two signatures

## Phase 1: gap identification (backend, database, frontend, admin)

You are working in the INFLX codebase:

- the backend (Node, `backend/src/**`, migrations in `backend/migrations/**`, scheduled jobs in `backend/src/jobs/**`);
- the Brand and Creator phone apps (`Packages/Mobile`);
- the admin website and the brand website, which share the same backend.

Three files come with this prompt:

1. **`INFLX_Master_Business_Rules_Phase_1_v1.19.docx`**: the business rules.
   - **Main section:** **9 (Agreement & Contract Rules, expanded today)**.
   - **Related:** 4, 5, 5B, 6, 7, 7A, 7B, 8, 10 (funding and the wallet lock), 11.1 / 11.2, 12, 19, 21 (payments by Aim), 24, 25 (deadlines), 26 (disputes), 28 (locks), 31.
2. **`INFLX_Item7_Agreement_Mockups.html`**: the **locked** mockups, screens **P1–P16**, including the agreement document itself (P13), plus the rules table at the end of that page.
3. **This prompt.**

**Order of authority:** rules doc → mockups → this prompt. If two disagree, stop and ask. Never guess.

> **This session is Phase 1 only.** Read and report. Do **not** change code, run migrations or edit data. Do **not** create, send, sign or cancel anything in **production**, and do not move, lock or release money anywhere. Write the gap report (§10), then **stop and wait for approval.**

---

## 0. How to work

- **The repo is the truth.** Items 2–6 were built before this one; earlier reports are guides only. Cite **`file:line`** for every claim.
- **Item 6 has just been built.** Read it as it now stands — the terms rewritten onto the invitation when a counter is accepted, `answered_at`, the pool, the platform settings with their audit. Item 7 reads what item 6 leaves behind. Report anything item 6 left open that item 7 needs.
- **A contract machine already exists** — `contracts`, `contract.service.autoCreate`, the signature timestamps, the brand-sign lock, the tranche release job, a PDF service. **Map it completely before proposing anything**, and say for each part whether item 7 keeps it, extends it, or retires it. Prefer extending.
- **This is the first item that moves money.** Treat every write that touches a wallet, an escrow or a ledger as high risk: report exactly what exists, what it writes, and what is idempotent. Propose nothing that could double-lock or double-release.
- **Migrations:** additive only. Find the next free number yourself. Dry-run and print counts.
- **Server enforcement:** every rule below is enforced on the server. Assume both sides will call the API directly, twice, at the same moment.
- **Phone apps** ship over the air. Flag any new native module (PDF viewing and file saving are the likely ones) and say whether it is already in the binary.
- **Tests:** record the backend baseline before anything. Item 7 must add no new failures.

### Words: rules doc vs code

| Rules doc / mockups | Code (verify) |
|---|---|
| Creator | `influencer` |
| Invitation | a `campaign_influencers` row |
| Agreement | `contracts` row |
| Both signatures | `contracts.influencer_signed_at` **and** `brand_signed_at` |
| Aim | `goal = 'conversion' / 'engagement' / 'hybrid'` |
| Mode of work | `shoot_mode = 'visit' / 'shipment'` |
| Campaign fee | the INFLX fee on Pay for Content (`payment_config`) |
| The three payments | the tranches in `payment_config` (25 / 25 / 50) |
| Locked money | whatever escrow or wallet-lock mechanism exists today |
| Signing deadline | the set's invitation cutoff (posting date − 3 days) |

---

## 1. Aim of this item

### 1.1 In one sentence

Item 7 turns an accepted invitation into a **signed agreement**: the brand sends it, the creator signs, the brand signs last — and for Pay for Content and Hybrid that last signature is what locks the money and releases her first payment.

### 1.2 What it delivers

1. **An agreement generated from the invitation's terms**, Aim-aware, never editable, with a reference number and a stamped standard-terms version.
2. **Sending, with a preview** of exactly what she will see.
3. **Her signature**, then **the brand's**, each recorded with the name typed, the moment, the device and the IP.
4. **The money gate** at the brand's signature: the check, the shortfall, the hand-off to the wallet, and the return to finish signing.
5. **Locking the funds and releasing the first 25%** at that moment (Pay for Content and Hybrid only).
6. **Every ending**: withdrawn, declined, expired unsigned — including the half-signed case.
7. **The document**, produced once both have signed, stored, and downloadable by both.
8. **The handover into Active**, with the next step open: shoot plan for Store Visit, shipment for Remote.

### 1.3 Why it matters

Everything before this was a promise. This is the first point where INFLX takes money and where a document exists that either side could be held to. It is also the last item before the full end-to-end test pack.

### 1.4 Out of scope

- Adding money to the wallet (item 9). Item 7 builds the **check, the shortfall and the hand-off**; the add-money screen itself is item 9's, and the button may land on what exists today.
- The shoot plan and the shipment (items 10, 11). The button exists and routes; nothing behind it is built here.
- The second and third payments, completion, returns, disputes, cancellation after signing.
- Pitch-originated agreements (item 8) beyond reporting how they differ.
- Legal entity details, GST and PAN. Phase 1 is names and cities.

---

## 2. Screen inventory (locked mockups)

| ID | Screen | App |
|---|---|---|
| P1 | The set with agreement work in it: "Send agreement" and "Sign" both under Your move, the signing deadline | Brand |
| P2 | The preview: parties, the agreed terms per Aim, the note, the standard-terms link, "nothing here can be edited" | Brand |
| P3 | Send confirm: she signs first, you sign last, both by the cutoff | Brand |
| P4 | The agreement arrives, still under Invites, "Agreement ready to sign · by 17 Oct" | Creator |
| P5 | Reading it: what you get (fee split into the three payments), what you do, return terms, standard terms, Sign / Decline | Creator |
| P6 | Signing: typed full name, two ticks, what we record | Creator |
| P7 | Signed, waiting for the brand: both signature boxes, what happens if they never sign | Creator |
| P8 | Declining at signing, with reasons | Creator |
| P9 | The brand's signature with the money in view: fee, campaign fee, total locked, the split, balance is enough | Brand |
| P10 | Not enough money: the shortfall as an amount, add to wallet, the disabled sign button | Brand |
| P11 | The last signature sheet: typed name, two ticks, what becomes irreversible | Brand |
| P12 | Both signed: the two signatures, what locked, what was released, what remains, and the next step | Brand |
| P13 | **The document** both sides download, with the two signature blocks and how each was made | Document |
| P14 | Withdrawing an agreement she has not signed | Brand |
| P15 | Every ending: she declined, you withdrew, nobody signed in time, she signed and you didn't | Brand |
| P16 | It moves to Active, with the first payment in her wallet and the next step named | Creator |

The rules table at the foot of the mockups is part of the requirement.

---

## 3. How item 7 links to the rest

Report each row as **ready / not ready**, what is missing, and what item 7 must consume or expose.

| Link | What must be true |
|---|---|
| **Item 5: the invitation's terms** | The agreement is generated from `agreed_fee`, `commission_pct`, `formats_json`, `usage_rights_json`, the `alloc_*` selling scope, `brand_note` and `min_shoppable_posts`. Report each column as item 5 and 6 left it, and confirm the contract can carry all of them. **This was named as the item 7 gap in both earlier reports — answer it first.** |
| **Item 6: an accepted counter** | The invitation's terms are rewritten when a counter is accepted. Confirm the agreement always reads the invitation and never the negotiation thread, and that a contract drafted at accept time cannot hold stale terms. |
| **Item 6: the draft contract** | Item 5 and item 6 both auto-create a draft contract on accept. Report what that row contains, when it is created, and whether item 7 should use it, replace it, or leave it and generate at send. Recommend one. |
| **Item 4: the cutoff** | Both signatures must exist before the set's cutoff. Report `cutoffFor` / `assertCanInvite` / `indiaDay.js` and how a signature would be refused after it. |
| **Item 4: the set-expiry job** | The job must also expire an unsigned agreement, tell both sides, and never leave money locked. Report what it does today with `contracted` / `accepted` rows and open contracts. |
| **Item 6: the pool and move requests** | A creator moved to the pool has no agreement. Confirm nothing here touches a `deferred` row. |
| **Section 10: funding** | Report in full what exists for the wallet, available balance, locking, escrow and the tranche release: tables, services, the brand-sign path, and the release job. State plainly which parts are real and which are stubs. |
| **Section 21: payments by Aim** | The 25/25/50 split and the INFLX campaign fee on Pay for Content only, and no campaign fee on a Hybrid fixed amount. Report where these numbers live and who reads them. |
| **Items 10 / 11: what signing opens** | Report how the shoot plan and the shipment decide they are available today, and what item 7 must set for them to open. |
| **Item 8: pitches** | A pitch-originated invitation also ends in an agreement. Report how that path creates contracts today and whether it would bypass item 7's rules. Change nothing; list the divergences. |
| **Item 24: Needs You** | "Send agreement" and "Sign" are both the brand's move; "Sign" is hers. Report how each side's counts would learn them. |
| **Notifications** | Needed: agreement sent, she signed, both signed, withdrawn, declined, expiring soon, expired unsigned. Report the service and the keys that exist. |
| **The PDF** | Report `pdf.service.js` in full: what it renders today, what it is called by, where output is stored, and whether it can produce the P13 document. |
| **Admin website** | Report anything admin can see or do with contracts today, and whether the standard terms and their version could live with the item 6 platform settings. |
| **Existing production data** | `contracts` by status, how many have one signature, how many have both, how many are `active` without signatures, how many have a PDF, and any locked or released money. |

---

## 4. Data requirements

For each item report status (**E** exists / **P** partial / **M** missing / **C** conflicts), evidence (`file:line`), and a proposed change.

### D1. The agreement row

List **every existing column** of `contracts` first, with its type, who writes it and who reads it. Then map:

| Field | Rule |
|---|---|
| Invitation | One agreement per invitation. Say whether a unique constraint exists and propose one if not. |
| Reference number | Human-readable, unique, `INFLX-YYYY-NNNNN`. Report whether anything similar exists; propose how it is generated without gaps or collisions. |
| Terms snapshot | **The whole agreed term set, copied at generation**, so the document can never drift from what was signed: Aim, posting date, mode, branch, fee, commission, selling scope, deliverables, usage rights, minimum shoppable posts, the note, the payment split and the campaign fee amount. Report what `autoCreate` copies today (believed to be the fee and the posting date only). |
| Standard terms version | Stamped at generation. Report where the standard terms text would live. |
| State | Draft · sent · signed by creator · signed by both · withdrawn · declined · expired. Map onto whatever statuses exist. |
| Signatures | Per side: the name typed, the timestamp, the device, the IP. Report which of these exist today. |
| Sent at, sent by | The brand user who sent it. |
| Withdrawn / declined | Timestamps, who, and her decline reason and note. |
| Money at signing | What was locked, what was released, and the references to those movements. |
| Document | The stored file, its checksum or version, and when it was produced. |

### D2. What the agreement shows, per Aim

| Aim | Contents |
|---|---|
| **All** | Parties (names and cities), campaign and set, Aim, posting date, mode of work (branch name and city for Store Visit — **never the street address**), the signing deadline, the reference, the date. |
| **Pay for Sale** | Commission %, selling scope, minimum shoppable posts as her obligation, when commission is paid (after the return window — report where that number lives). |
| **Pay for Content** | Fee, the split in rupees (25/25/50, each as an amount), deliverables line by line, usage rights or "none", and for Remote the product-return terms. |
| **Hybrid** | Fixed fee with its split, plus everything from Pay for Sale. No deliverables, no usage rights. |
| **Never** | The follower offer, the campaign description, anything about other creators. |
| **The note** | Included when there is one, labelled as the brand's note. |

Rounding: say how the three tranche amounts are computed so they always sum exactly to the fee, and where that rounding rule already exists.

### D3. Generation and immutability

- Generated from the invitation, never typed, never editable, by either side, at any point.
- Regenerated only if it has not been sent.
- Report anything today that can edit a contract's terms after creation, and every caller.

### D4. Signing

| Rule | Detail |
|---|---|
| Order | Brand sends → creator signs → brand signs. The server refuses the brand's signature before hers. |
| Method | Typed full name (pre-filled from the account, editable, required), both ticks required, then sign. |
| Recorded | The typed name, the timestamp, the device and the IP, per side. Report what the API can see today and whether IP is available behind the proxy. |
| The brand's signer | A named person signing for the brand, stored and printed on the document. |
| Idempotency | Signing twice, or two devices at once, must produce one signature. Say how. |
| Deadline | Neither side can sign after the set's cutoff. |

### D5. The money gate (Pay for Content and Hybrid)

| Rule | Detail |
|---|---|
| Required | Pay for Content: the fee **plus** the INFLX campaign fee. Hybrid: the fixed fee alone. Pay for Sale: nothing. |
| Checked | Against available (not total) balance, at the moment of signing, inside the same transaction as the signature. |
| Short | The signature is refused, the shortfall is returned as an amount, and the app sends the brand to the wallet and back. |
| On success | The whole amount is locked and the first 25% is released to the creator, atomically with the signature. |
| Never | No money moves on generation, on sending, on her signature, or on any failure. Nothing is ever double-locked or double-released. |

Report exactly what exists for each of these today, what is a stub, and what item 7 must add versus what item 9 will own. If any part of locking or releasing cannot be made atomic with the signature, say so plainly and propose the safest order with a repair path.

### D6. Withdraw, decline, expire

| Ending | Rule |
|---|---|
| Withdraw | Only while she has not signed. The invitation returns to accepted; the same agreement may be sent again. Terms never unlock. No money involved. |
| Decline | At signing, with a reason from item 5's five plus "the agreement terms", and an optional note the brand sees. The invitation ends. |
| Expire | Unsigned at the set's cutoff: the agreement expires, nothing is locked, both sides are told, and the half-signed case is called out to her by name. |
| Never | No ending here may destroy a signed agreement or leave money locked. |

### D7. What signing starts

Both signatures: the invitation becomes the active collaboration on both sides, the first payment appears in her wallet, and the next step opens (shoot plan for Store Visit, shipment for Remote). Report what decides that today and what item 7 must write.

### D8. The document

- Produced when both signatures exist; stored; never regenerated with different content.
- Contains everything in P13, including both signature blocks with name, time, device and IP, and the standard-terms version.
- Downloadable by both sides, at any time afterwards, and by nobody else.
- Before signing, the on-screen agreement is the agreement — no PDF is produced for an unsigned one.
- Report the PDF service, where files are stored, how they are served, and how access is restricted.

### D9. Standard terms

One versioned text, part of every agreement, opened from a link, and stamped on the agreement at generation. Report where it should live (a table, a file, or beside the item 6 platform settings) and recommend one. Changing it must never alter an agreement already generated.

### D10. Privacy and access

Only the two parties may read an agreement or its document; anyone else gets 404. The creator never sees the campaign description, the brand's internal notes, other creators, or the brand's balance. The brand never sees her wallet.

### D11. Legacy data

Contracts that are `active` with one or no signatures (seeded), contracts with no terms beyond the fee, invitations accepted with no contract. Say what each would show on the new screens and whether any backfill is needed. **Prefer none, and never invent a signature.**

---

## 5. API requirements

Follow existing naming. Propose request and response shapes and error codes. Say for each whether it exists, needs extending, or is new.

| ID | Endpoint | Screens |
|---|---|---|
| C1 | **Brand: preview the agreement** — generated from the invitation, everything P2 shows, plus the standard-terms version. | P2 |
| C2 | **Brand: send it** — creates or finalises the agreement, sets the reference, snapshots the terms and the version, notifies her. | P3 |
| C3 | **Brand: the agreement** — its state, both signature blocks, the money summary and, when hers is the only signature, what the brand must do. | P1, P9, P12 |
| C4 | **Brand: what signing will cost** — the fee, the campaign fee, the total to lock, the three payouts, the available balance, and the shortfall when there is one. | P9, P10 |
| C5 | **Brand: sign** — the typed name and ticks; refuses before her signature, after the cutoff, and when the balance is short (returning the shortfall); locks the funds and releases the first payment atomically. | P11, P12 |
| C6 | **Brand: withdraw** — only while unsigned by her. | P14 |
| C7 | **Creator: the agreement** — everything P5 shows, with the split as amounts and the standard-terms version. | P4, P5, P7 |
| C8 | **Creator: sign** — the typed name and ticks; refuses after the cutoff or if already signed. | P6, P7 |
| C9 | **Creator: decline** — reason and optional note; ends the invitation. | P8 |
| C10 | **Standard terms** — the current text and version, and a given version by number. | P2, P5 |
| C11 | **The document** — download for either party once both have signed; 404 for anyone else and before completion. | P12, P13, P16 |
| C12 | **Job:** expire unsigned agreements at the set's cutoff, tell both sides, and assert nothing is locked. Idempotent, logged. | P15 |

**Access:** brand endpoints for the owning brand, creator endpoints for that creator, everything else 404.

---

## 6. Business rules and screen behaviour (exact)

### 6.1 The set (P1)

- The cutoff line becomes **"Both signatures needed by {date} · {n} days"** once any agreement is out.
- **Your move** holds both "Send agreement" (she accepted) and "Sign" (she signed, the brand hasn't).
- **Waiting for the creator** holds agreements sent and unsigned, with "Agreement sent {date}".
- **Signed** rows read "Signed by both {date}" with an Active chip.

### 6.2 The preview and sending (P2, P3)

- Header "Agreement · {name}", then the reference as `INFLX-2026-00123 · DRAFT`.
- Cards: **The two of you** · **What was agreed** (the D2 list for the Aim) · **Note from you** when there is one · a row opening the **INFLX standard terms** with their version.
- Hint: "Nothing here can be edited. It is built from the terms you both agreed."
- Button: "Send for signature". The confirm lists: Sneha signs — First; You sign — After her; Both by — {date}; then "Nothing can be changed once it is sent. If you need different terms, remove {name} from the set and invite her again while there is still time."

### 6.3 Her side (P4–P8)

- The card stays under **Invites** with a **Your move** chip and "Agreement ready to sign · by {date}".
- The agreement leads with **What you get** — for Pay for Content the fee and the three payments as amounts — then **What you do**, then return terms for Remote, then the standard-terms row. Buttons: **Sign** (main), **Decline**.
- The sign sheet: "Type your full name", hint "As it should appear on the agreement", two ticks — "I have read the agreement and the INFLX standard terms, and I agree to them" and "I understand this becomes binding once {Brand} sign too" — then "We record your name, the time and the device you signed from."
- Signed and waiting: a blue box "Signed. Waiting for {Brand} to sign by {date}", both signature boxes, and "Nothing is binding until both signatures are on it. If they don't sign by {date}, this closes and neither of you owes anything."
- Decline: "This ends the collaboration with {Brand} for this set. They can invite you again if there is still time.", reasons **The agreement terms · Fee too low · Dates don't suit · Too much work · Other**, an optional note, "The brand sees this."

### 6.4 The brand's signature (P9–P12)

- Amber box: "{Name} signed on {date}. Your signature completes it."
- **What it costs you**: the fee, the INFLX campaign fee (Pay for Content only), and a totalled line "Locked when you sign".
- **Paid out as**: the three amounts with what triggers each.
- Balance: green "Your wallet has ₹{n} available. Enough." Hint: "Signing locks ₹{n} of your balance for this collaboration. It can't be spent on anything else."
- Button: **"Sign and lock ₹{n}"**.
- **Short:** a red card "Add ₹{shortfall} to sign" / "Your wallet has ₹{n} available and this needs ₹{m}.", a wallet button "Add ₹{shortfall} to wallet", the hint "We'll bring you straight back here to sign.", and the sign button disabled.
- The sign sheet: the signer's full name with "Signing for {Brand}", ticks including "I understand ₹{n} will be locked now and ₹{m} released to {name} straight away", then "After this, the terms can never be changed inside this collaboration."
- Done: green "Signed by both on {date}. This collaboration is live.", both signature boxes, **What happened just now** — Locked / Released / Still locked — **Next**, and Download plus the next-step button.
- **Pay for Sale:** no money card, no balance check; the sheet says signing completes the agreement and opens the shoot plan.

### 6.5 The document (P13)

Title "Collaboration Agreement", the parties, the reference and date; then **The parties** · **The work** · **The money** · **Also agreed** (numbered plain-language clauses) · the two signature blocks with name, time, device and IP · a footer naming the standard-terms version and the reference.

### 6.6 Endings (P14, P15)

- Withdraw: "{Name} hasn't signed yet. She goes back to waiting for an agreement, and you can send the same one again." plus "The terms can't be changed. To offer something different, remove {name} from the set and invite her again while there is still time."
- The four endings, each a sentence with a date: she declined (with her reason); you withdrew; nobody signed in time ("The agreement expired unsigned and no money was taken."); she signed and you didn't ("Nothing was locked, and she was told.").

### 6.7 Active (P16)

Her card moves to **Active** with "₹{n} is in your wallet. Signed {date}.", a **Next** line naming the next step, and a link to the agreement.

---

## 7. Validation and messages (server and app, identical text)

| Field / action | Rule | Message |
|---|---|---|
| Send before she accepted | Server | {Name} hasn't accepted the terms yet. |
| Send twice | Server | An agreement is already out with {name}. |
| Send after the cutoff | Server | Signatures for this set closed on {date}. |
| Edit a sent agreement | Server | An agreement can't be changed once it's sent. |
| Typed name empty | — | Type your full name to sign. |
| Ticks not both ticked | — | Tick both boxes to sign. |
| Brand signs before the creator | Server | {Name} hasn't signed yet. |
| Sign after the cutoff | Server | Signatures for this set closed on {date}. |
| Sign twice | Server | This is already signed. |
| Balance short | Server | Add ₹{shortfall} to your wallet to sign this agreement. |
| Withdraw after she signed | Server | {Name} has already signed, so this can't be withdrawn. |
| Decline with no reason | — | Choose a reason. |
| Decline note | ≤ 200 | Keep it under 200 characters. |
| Download before completion | Server | The agreement can be downloaded once you've both signed. |

---

## 8. Look and feel

Item 2's theme, as items 3–6 use it:

- White background, `#F6F6F3` surfaces, `#E5E4DE` borders, ink `#1A1A17` / `#5B5A53` / `#77766E`.
- Yellow `#FFC700` for the single main button — here always the signing button; red for decline and withdraw.
- Boxes: your move amber, waiting blue, done green, neutral grey; the shortfall card is the declined-red family.
- A signed signature block is a green surface card; an unsigned one is outlined.
- The reference number is mono, uppercase, `--ink3`, above the content.
- Money is right-aligned and tabular; the total line sits under a dark rule.
- The document (P13) is its own page style: a two-rule header, mono section labels, rows with the value right-aligned, numbered clauses, and two signature blocks side by side.
- Plus Jakarta Sans; dates "20 Oct 2026" on the document and "20 Oct" in lists; times "4:32 pm IST".

---

## 9. Phase 1 checklist

### 9.1 Database
- Every column of `contracts` today, with writer and reader.
- Everything in §4 (D1–D11) mapped to a column or named as missing.
- The wallet, balance, lock or escrow and ledger tables, in full.
- `payment_config` — the tranches and the campaign fee — and every reader.
- Where a document file would be stored, and how access is controlled.
- Production counts from §3's last row.
- Indexes for the set screen, the creator's list and the expiry job.

### 9.2 Backend
- Every endpoint in §5, with what exists today, its shape, its callers and its access checks.
- `contract.service.autoCreate` and every caller; the brand-sign path; the tranche release job.
- Every path that can create, change or delete a contract, including the pitch path and any script.
- What is genuinely implemented for locking and releasing money, and what is a stub.
- The cutoff helpers and the set-expiry job as items 4–6 left them.
- `pdf.service.js` in full.
- The notification service and the keys that exist.

### 9.3 Phone apps
- **Brand:** item 5 and 6's set screen and creator detail; where "Send agreement" and "Sign" attach; the wallet screen as it exists.
- **Creator:** the invitation screen, the Invites and Active tabs, and the wallet.
- Components reusable from items 2–6: cards, sheets, confirm sheets, chips, money rows, state boxes, skeletons, empty and error states.
- What is new: the signature block, the tick rows, the money summary, the shortfall card, the document viewer or download.
- Any new native module for viewing or saving a PDF, and whether it is OTA-safe.

### 9.4 Websites and admin
- Anything that touches contracts today; where the standard terms and their version would live.

### 9.5 Tests
- Baseline pass and fail counts; existing tests touching contracts, signing, escrow and the tranche release.

---

## 10. Phase 1 output

Write **`Docs/ITEM7_AGREEMENT_GAP_REPORT.md`**:

1. **Summary:** area · status · one-line gap.
2. **Requirement table:** ID · requirement · status · evidence (`file:line`) · proposed change · risk.
3. **What already exists, in detail:** the contract row, auto-create, the signature paths, the money machinery, the PDF service — and which parts item 7 keeps, extends or retires.
4. **Link readiness (§3),** row by row.
5. **The money answer:** exactly what is real today, what item 7 must build, what item 9 will own, and how locking and releasing stay atomic with the signature. **Be blunt about anything that cannot be.**
6. **Proposed migrations** (additive), with dry-run checks.
7. **Proposed endpoints** with shapes, error codes and affected callers.
8. **The terms snapshot design** and how the document can never drift.
9. **The standard terms**: where they live, how they are versioned, and how an old version is served.
10. **The document**: generation, storage, access and the app's viewing route.
11. **Frontend plan** per screen, components reused and new.
12. **Test baseline** and the tests you will add.
13. **Questions for the founder,** each with a recommendation, including every assumption in §11.

Then **stop and wait for approval.**

---

## 11. Assumptions to confirm in your questions

1. **One agreement per invitation**, generated from the invitation and never editable.
2. **The terms are snapshotted onto the agreement** at generation, so the document can never drift.
3. **She signs first, always**, and the server refuses the brand's signature before hers.
4. **A typed name plus two ticks is a signature**, recorded with time, device and IP.
5. **The brand's signer is a named person** signing for the brand.
6. **The money check is against available balance**, at the moment of signing, and the lock and the first release are atomic with it.
7. **Pay for Sale has no money gate** and completes on the brand's signature.
8. **Nothing moves money** on generation, sending, or her signature.
9. **Withdrawing never unlocks the terms**; different terms mean removing her and inviting again.
10. **An unsigned agreement at the cutoff expires**, with nothing locked, and the half-signed case is called out to her.
11. **The PDF is produced only once both have signed**, and only the two parties may download it.
12. **Phase 1 identifies the parties by name and city**; GST and PAN come with the payout work.

---

## 12. After approval (not in Phase 1)

- **Phase 2:** migrations, the generation and snapshot, send, both signature paths, the money gate, locking and the first release, withdraw, decline, the expiry job, the standard terms, the document and its storage, notifications.
- **Phase 3:** the Brand screens P1–P3, P9–P12, P14, P15; the Creator screens P4–P8, P16; the document P13.
- **Phase 4:** tests — and then **the full end-to-end test pack across items 2–7**, which is the next piece of work after this item.

### 12.1 Final functionality: all must pass

1. An accepted creator shows "Send agreement" under Your move; one who has signed shows "Sign".
2. The preview shows every term for the Aim, and nothing for the wrong Aim.
3. A Pay for Sale agreement shows commission, selling scope and the shoppable-post minimum; a Pay for Content one shows the fee, the three amounts, deliverables and usage rights; Hybrid shows the fixed fee plus the Pay for Sale terms.
4. The brand's note appears when there is one and is absent when there isn't.
5. The follower offer, the campaign description and the branch street address never appear.
6. The three tranche amounts sum exactly to the fee, including odd amounts.
7. Sending stamps a unique reference and the standard-terms version, and notifies her.
8. Sending before she accepted, twice, or after the cutoff is refused with the exact message.
9. The API refuses any attempt to change a sent agreement.
10. The brand cannot sign before she has; the API refuses it.
11. She signs: the name, time, device and IP are recorded, and the brand is notified.
12. Signing twice, or from two devices at once, produces one signature.
13. Neither side can sign after the set's cutoff.
14. **Pay for Content:** the brand's signature locks the fee plus the campaign fee and releases exactly 25% of the fee to her, in one transaction.
15. **Hybrid:** the fixed fee alone is locked, with no campaign fee.
16. **Pay for Sale:** nothing is locked and the agreement completes.
17. A short balance refuses the signature, returns the shortfall, locks nothing, and leaves her signature intact.
18. After adding money, the same signature succeeds, and nothing was double-locked.
19. A failure anywhere in the signing transaction leaves no money locked and no signature recorded.
20. Both signatures move the collaboration to Active on both sides, with the first payment visible in her wallet.
21. The next step opens: shoot plan for Store Visit, shipment for Remote.
22. Withdraw works only before her signature and returns her to accepted; the same agreement can be sent again.
23. She declines with a reason; the brand sees it; the invitation ends; she can be invited again before the cutoff.
24. An unsigned agreement at the cutoff expires with nothing locked, and both sides are told.
25. A half-signed agreement at the cutoff tells her by name that it went nowhere and that nothing was locked.
26. The PDF is produced only at completion, matches the signed terms exactly, and shows both signature blocks with time, device and IP.
27. Downloading before completion, or by anyone but the two parties, is refused.
28. Updating the standard terms does not change any agreement already generated, and an old version is still served.
29. Another brand's or another creator's agreement, signature or document returns 404.
30. No creator response contains the brand's balance, internal notes, the campaign description, or another creator's anything.
31. Loading, empty and couldn't-load states appear on every new screen.
32. Backend tests show no new failures against the Phase 1 baseline.

### 12.2 Final deliverable

A short summary of what changed, the test results, the result of every check 1–32, exactly what money the item can now move and what item 9 still owns, and anything left open before the end-to-end test pack.
