# item7-agreement — spec

Rules doc **v1.20** §9 and §3 (both amended 14 Sep 2026 after the gap check), with §4, §5, §5B, §6,
§7, §7A, §7B, §8, §10, §11.1, §11.2, §12, §19, §21, §24, §25, §26, §28, §31. Locked mockups
`04-preview/mockups/item7-agreement-locked.html` (P1–P16, amended after the gap report so the campaign
fee arithmetic is consistent at 8%). Gap report `Docs/ITEM7_AGREEMENT_GAP_REPORT.md`, approved with
twelve answers and five further decisions in `APPROVAL.md`. Prompt in `PROMPT.md`; the Phase 1 brief
is kept as `GAP_CHECK_PROMPT.md`.

## What item 7 delivers
An accepted invitation becomes a **signed agreement**: the brand sends it, the creator signs, and the
brand signs last — which for Pay for Content and Hybrid is the moment the money locks and her first
payment leaves. It is the first item that moves money, and the first that produces a document either
side could be held to.

## The rules, as built

### The agreement
- **Generated from the invitation**, Aim-aware, never typed and never editable. One per invitation
  (`contracts.campaign_influencer_id` has been unique since migration 006).
- **The terms are snapshotted at send** into `contracts.terms_json` — the whole agreed term set, the
  parties, the money with its three amounts, the work, the selling scope, the Remote return terms, the
  brand's note, and the standard-terms version. Written once, guarded by `WHERE sent_at IS NULL`. The
  agreement and its document read **only** from the snapshot, so an invitation that changes afterwards
  cannot rewrite a page that has been signed.
- **A reference number** `INFLX-2026-00123`, from a sequence, unique, stamped at send.
- **The three admin numbers it depends on are stamped with it** — the campaign fee percentage, the
  sales-commission return window and the Remote return window — exactly as item 6 stamps the round
  limit and the pool lifetime. A later admin change never reaches a sent agreement.
- **What it contains, by Aim (§9):** always the parties (name and city — Phase 1 identity), campaign
  and set, Aim, posting date, mode of work (for Store Visit the branch name and city, **never the
  street address**), the signing deadline, the reference and the date. Pay for Sale adds the
  commission, the selling scope, the shoppable-post minimum as her obligation, and when commission is
  paid. Pay for Content adds the fee, the 25/25/50 split written out in rupees, the deliverables and
  the usage rights, plus the Remote return terms. Hybrid is the fixed fee with its split plus
  everything from Pay for Sale. The **follower offer never appears**, and neither does the campaign
  description — both are excluded at snapshot time so no renderer can reintroduce them.

### Signing
- **Order:** the brand sends → the creator signs → the brand signs. The server refuses the brand's
  signature before hers, so no money is ever locked against an agreement she has not accepted.
- **A signature is a typed full name plus two ticks**, recorded with the moment, the device and the
  network address on each side. The brand's signer is a **person** signing for the brand, named on the
  document. `trust proxy` was already set, so `req.ip` is the real client address.
- **Idempotent by construction:** every signature is a compare-and-swap (`AND status = 'x'` with a
  `rowCount` check), the contract row is taken `FOR UPDATE` before any money moves, and
  `escrow_entries` has a unique index on `(campaign_influencer_id, tranche_number)`.
- **Neither side may sign after the set's cutoff** (posting date − 3 days). The cutoff never reached
  the contract endpoints before this item.

### The money (§3, §10, §21)
- **Pay for Content** locks the fee **plus** the INFLX campaign fee. **Hybrid** locks the fixed fee
  alone — no campaign fee is charged on a Hybrid amount. **Pay for Sale** locks nothing and has no
  check at all.
- **The creator receives the agreed amount in full.** No platform charge of any kind is deducted from
  a fee tranche; the campaign fee is charged to the brand and to the brand alone. The escrow tier fee
  is no longer taken from a fee tranche, and `escrow_fee_tiers` is untouched for its other uses.
- **Checked against the available balance at the moment of signing**, inside the same transaction as
  the signature. A shortfall refuses the signature, returns the amount, locks nothing, and leaves her
  signature intact.
- **The lock and the first release are atomic with the signature.** One balance decrement, two audit
  rows: `escrow_lock` for the fee (what "reserved" means) and `platform_fee` for the campaign fee
  (INFLX's, taken once, never released). Each tranche release now also writes the `escrow_release`
  credit that nothing in the codebase had ever written, so a brand's reserved figure comes back down.
- **The three amounts sum exactly to the fee**, from one shared splitter (`utils/money.splitAmount`)
  used by the escrow writer and by every screen. A whole-rupee fee splits into whole rupees.

### The endings
- **Withdraw** only while she has not signed. She returns to waiting for an agreement and the same one
  may be sent again. The terms never unlock: different terms mean removing her from the set and
  inviting her again.
- **Decline** at signing, with one of six reasons — item 5's five plus "the agreement terms" — and an
  optional note the brand sees. The invitation ends; she can be invited again before the cutoff.
- **Expire** at the set's cutoff: the agreement closes unsigned, nothing is locked, and both sides are
  told — the half-signed case named to her, because she did her part.
- **Nothing deletes a contract row, anywhere.** Every ending is recorded, so P15 can name it months
  later. That includes the two paths that used to delete: an invitation decline and item 6's
  move-answer.

### What signing starts
Both signatures move the collaboration to Active on both sides, put the first payment in her wallet,
and open the next step — the shoot plan for Store Visit, the shipment for Remote. **The shoot plan is
gated on both signatures**; the two endpoints that reached it with no status check at all are closed.

### The document
Produced **only once both signatures exist**, from the snapshot alone, stored in R2 with a sha256 so
drift is detectable. Downloadable by the two parties and nobody else, through a presigned link that
lives **five minutes** and is logged on every issue. Before signing, the on-screen agreement is the
agreement.

### The standard terms
One versioned text in its own `standard_terms` table, exactly one current, seeded at version 1.0 with
the seven sentences that had lived inside the PDF generator plus the two v1.20 added. An agreement
stores its version and that exact text is served forever, so publishing a new version never changes
anything already generated. Admin page at `/admin/settings/terms`, beside item 6's, same capability.

### One service, two doors
`services/contractSign.service.js` is the only place funds lock, and both brand-web's existing
countersign and the phone's new endpoint go through it. brand-web's **Approve & Send is switched off**
with a message — agreements are sent from the Brand app — because two doors with different rules is
how a deal ends up with a bonus nobody agreed to. Web signing stays, and its displayed lock amount now
reads the server's answer instead of recomputing one.

### Privacy
Only the two parties may read an agreement or its document; anyone else gets 404. The creator never
sees the brand's balance, its internal notes, the campaign description or another creator's anything.
