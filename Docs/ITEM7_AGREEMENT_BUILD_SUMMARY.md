# Item 7 — the agreement, and the two signatures
## Build summary

**Built 14 September 2026.** Rules doc v1.20 §9 and §3, the locked mockups P1–P16 as amended, the
item 7 gap-check prompt, and the gap report as changed by the approval message. Contract:
`features/item7-agreement/`.

**Not deployed.** Migration 183 has been dry-run against production only. Nothing has been migrated,
pushed or published. This is production-impacting work and, for the first time, work that moves money.

**One thing needs your word before it can be finished — see §11.**

---

## 1. The money-path fixes, first

You asked for these before any new feature, and that is the order they were built and tested in.

**Signing is now safe against a double tap.** Both signatures are compare-and-swap: the update carries
its own status condition and the code checks that a row actually changed. The contract row itself is
taken under lock at the top of the signing transaction, before any money moves. That last part matters
most for Pay for Sale, where nothing is locked and therefore nothing used to be serialised at all — a
double tap there would have signed twice and created the deliverables twice.

**The concurrent test result.** Two countersignatures fired at the same instant, on the same
agreement, on both a Pay for Content deal and a Pay for Sale one. In both cases exactly one succeeded
and one was refused. On the Pay for Content deal the brand was debited once, three escrow rows exist
rather than six, the creator's first payment reached her once, and three deliverables exist rather than
six. The database now also refuses it independently: `escrow_entries` has a unique index on the
invitation and tranche number, which is the one guard that cannot be raced.

**The three payments sum exactly to the fee.** There is one splitter now, and both the escrow writer
and every screen call it. A ₹9,999 fee splits into ₹2,500, ₹2,500 and ₹4,999. Before this the escrow
writer put an unrounded number into the database and let Postgres round each row on its own, while the
screen used a different, correct algorithm — so the number she was shown before signing and the number
written down were computed two different ways.

**A brand's reserved figure comes back down.** Nothing in the codebase had ever written the credit
side of a release, so "reserved" only ever grew, for the life of the account. Each release now writes
it. After a signature on a ₹9,000 fee, ₹6,750 is reserved; once all three payments have gone out, it
is zero.

---

## 2. What INFLX earns on a Pay for Content deal, end to end

One worked example, at the default 8%.

A brand agrees a ₹9,000 fee with a creator. She signs. The brand signs.

| | Amount |
|---|---|
| Taken from the brand's wallet | ₹9,720 |
| — held for the creator | ₹9,000 |
| — INFLX campaign fee, taken once | ₹720 |
| Released to her immediately | ₹2,250 |
| Still held for her | ₹6,750 |
| **She receives, in total** | **₹9,000** |
| **INFLX earns** | **₹720** |

The creator receives the agreed amount in full. Nothing is deducted from any of her three payments.
Before this item she would have been credited ₹8,730 on that deal while the brand was debited ₹9,720,
because a second fee was quietly coming out of her side.

**Hybrid** locks the fixed fee alone — no campaign fee. **Pay for Sale** locks nothing and has no
check at all; INFLX earns on the sales instead.

---

## 3. Migration 183 — what it adds, and the production counts

Additive only. `node backend/scripts/run-183.js --dry | --apply`.

**Production dry run, 14 September 2026:**

| Count before | Value |
|---|---|
| contracts | 6 |
| signed by both | 1 |
| signed by one side only | 0 |
| signed by neither | 5 |
| status `active` with no signatures | 4 |
| with a stored document | 1 |
| escrow rows | 0 |
| wallet transactions | 0 |
| invitations | 8 |
| duplicate invitation-and-tranche escrow pairs | none, so the new unique index will build |

None of the twenty-one new columns, three new statuses, one new table or six new indexes is present.
**There is nothing to backfill**, and nothing invents anything: no reference number is given to an old
contract, no terms are snapshotted onto one, and no signature is ever invented. The four seeded rows
that are `active` with no signatures stay exactly as they are, and now read correctly as unsigned.

What it adds: three endings to the status vocabulary; the reference number, the terms snapshot, the
terms version, who sent it and when, the device and address on each signature, the brand signer's
name, the three ending timestamps with her decline reason and note, what was locked and released, and
a checksum for the document; a sequence for the reference; the `standard_terms` table seeded at
version 1.0; two more admin numbers; and the money-safety indexes.

---

## 4. The snapshot, and why the document cannot drift

This is the item's spine.

Before, a contract row held the fee and the posting date. Everything else — the commission, the
deliverables, the usage rights, the selling scope, your note — was read live from the invitation every
time the agreement was opened or the document was rendered. Editing an upstream row silently rewrote a
page that had already been signed.

Now the whole agreed term set is copied once, at the moment you send it, into a single column, and the
agreement and its document read only from there. The copy happens in one function, and the write is
guarded so it can only ever happen once. The three admin numbers it depends on — the campaign fee
percentage, the sales-commission return window and the Remote return window — are copied in at the
same moment, exactly as item 6 stamps the round limit.

**Proved two ways.** Changing the campaign fee percentage to 12% afterwards leaves a sent agreement at
8% and ₹9,720, and gives 12% to the next one. Publishing standard terms version 1.1 leaves a sent
agreement stamped 1.0, and version 1.0 is still served in full.

The follower offer, the campaign description and the branch street address are excluded when the
snapshot is taken, not when it is rendered, so no future screen can reintroduce them by accident.

---

## 5. The standard terms

They used to be seven sentences hardcoded inside the PDF generator, with no version. A deploy that
edited them would silently change what every already-signed contract appeared to say.

They now live in their own table, one row per version, exactly one current, enforced by the database.
Version 1.0 carries those seven sentences verbatim plus the two v1.20 added, so nothing already signed
changes meaning. An agreement stores the version it was generated under; that exact text is served
forever. Publishing a new version is an insert, never an edit and never a delete.

The admin page is at `/admin/settings/terms`, beside item 6's platform settings, on the same
capability, with the same shape.

---

## 6. What item 9 still owns

Adding money to the wallet. Item 7 builds the check, the shortfall as a real number, and the hand-off;
neither phone app has a wallet screen yet, so the "Add ₹3,720 to wallet" button opens the website's
wallet page. When item 9 gives the phone a wallet, that button changes destination and nothing else.

**And the note you asked for, about cancellation.** The lock is a destructive subtraction from the
brand's wallet balance, not a reservation held beside it. That is deliberate and it is what every
reader in the codebase already assumes. It works today because nothing in Phase 1 can void a signed
agreement, so no locked money ever has to come back. The moment cancellation or a dispute resolution
can return money, this has to change: either a real locked-balance column, or a compensating credit
written at the same time — and every place that reads "available balance" has to be revisited in the
same piece of work. Whoever picks that up should not have to rediscover it.

---

## 7. The document, and a limitation

It is produced only once both signatures exist, from the snapshot alone, stored with a checksum so it
can be proved not to have changed. Only the two parties can download it, through a link that lives
five minutes and is logged every time one is issued.

**The limitation, stated as one.** There is no way to view or save a file inside either phone app —
no such module is in the build, and adding one means rebuilding and reinstalling the apps rather than
an over-the-air update. So the agreement is drawn as ordinary screens for reading and signing, which
is what she actually signs, and **Download** opens the phone's browser. This is a limitation, not a
finished design. When there is another reason to rebuild the apps, an in-app viewer should go in with
it.

---

## 8. Tests

| Suite | Result |
|---|---|
| Backend, whole suite | **229 failed / 1024 passed / 1253** |
| Baseline after item 6 | 229 failed / 982 passed / 1211 |
| New failures | **0** |
| New tests | 42 in `backend/tests/item7-agreement.test.js`, all passing |
| Mobile, whole suite | **493 / 493** (baseline 479; 14 new) |

The 229 pre-existing failures are the same 229 as before this item.

Five existing assertions were rewritten because an approved rule changed underneath them: the tier fee
coming out of a creator's tranche, in three places; the unsigned contract being deleted rather than
marked, in two.

---

## 9. Every check, 1 to 41

All forty-one pass. The full table, with the test that proves each one, is in
`features/item7-agreement/03-expected-outputs.md`. In short:

- **1–9, the preview and sending** — the right terms for each Aim and nothing for the wrong one, the
  note when there is one, no follower offer or street address, the three amounts summing exactly, a
  unique reference and a stamped version, and the three exact refusals.
- **10–13, 33, signing** — the brand cannot sign first, her signature records name, time, device and
  address, two simultaneous attempts produce one signature, neither side can sign after the cutoff,
  and a double countersignature locks and pays exactly once on both money-bearing and commission-only
  deals.
- **14–19, 35–37, the money** — the Aim branch on what is locked, the creator paid in full, a short
  balance that refuses and locks nothing while leaving her signature intact, the retry that succeeds
  without double-locking, a mid-transaction failure that leaves nothing behind, and reserved coming
  back down.
- **20, 21, 38, what signing starts** — Active on both sides with her first payment visible, the next
  step opened, and the shoot plan closed to anyone without both signatures.
- **22–25, 39, the endings** — withdraw before her signature and not after, decline with a reason,
  expiry with nothing locked, the half-signed case named to her, and no path anywhere deleting a
  contract row.
- **26–28, 40, the document and the terms** — produced only at completion, refused before it and to
  anyone else, an old terms version still served, and an admin change that cannot reach back.
- **29–32, 41, privacy and the two doors** — 404 for everyone else, no leak in any creator response,
  the loading and empty states, and the website and the phone quoting the same number for the same
  deal.

---

## 10. Left open before the end-to-end pack

**Hybrid and deliverables disagree with the rules.** The code treats Hybrid as content-buying, so a
Hybrid set with no formats cannot be countersigned at all. Rules v1.20 §21 says Hybrid has no
brand-defined content package. This predates item 7 and I did not change it, because it would ripple
through item 4's set wizard and item 5's terms screen. It needs a decision.

**Two stale things found while gating the shoot plan.** One query filters on a collaboration status
called `live`, which is not one of the fourteen real values, so that query cannot run. And the two
production endpoints I gated were the only reachable way to open a shoot plan early; nothing else
calls them.

**Pitch-originated agreements.** A pitch briefed straight into a campaign still creates its contract
ready-to-sign, skipping the brand's send step by design. It now goes through the same signing service
and the same money rules, but it never gets a snapshot until someone sends it, so an item 8 review
should decide whether that path should send properly.

**The admin revenue tiles.** They read the escrow protection fee as INFLX's revenue. That number is
now zero on Pay for Content and Hybrid, because the campaign fee replaced it. The campaign fee is
recorded on each agreement and as its own wallet transaction, so the data is there, but the admin
dashboard has not been repointed at it.

**Nothing is tested end to end yet.** Everything above is proved by unit and API tests against a real
database and by render tests on the screens. The full end-to-end pack across items 2 to 7 is the next
piece of work, and your device walk goes with it.

---

## 11. One thing I stopped on, as you asked

**The sales-commission return window.** You said to set it to 7 and to stop and tell you first if 30
had been a deliberate decision. It was, twice over:

- The number governs when a creator's **sales commission** becomes spendable after a shopper buys — it
  is not the Remote product-return window, which is the new separate setting at 7 days.
- A contract from May 2026 (`features/wave1-admin-categories-return-window`) added a **per-category**
  override and states that every category was set to 30 deliberately, to match the behaviour that was
  already live. So there are eleven-plus places holding 30, not one.

Changing the single global number to 7 would therefore not reach any category that has its own value,
and where it did reach it would change when every creator's pending commission unlocks, across all
live commerce. That is a much wider blast radius than item 7.

**What I did instead:** the agreement prints whatever the configuration says, never a constant, so the
code is correct either way. Production still holds 30 and I have not touched it. Say the word and I
will set both the global and the per-category values to 7 in one migration.

---

## 12. Before anything ships

Nothing has been deployed. When the go comes, in this order: apply migration 183, commit, push (which
deploys the backend and the website, bringing the new admin page with it), then publish the two app
bundles one at a time — brand, then creator.
