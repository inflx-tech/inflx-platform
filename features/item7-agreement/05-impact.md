# item7-agreement — impact

**Verdict: production-impacting, and it moves money.** One migration (183, additive, no backfill),
three live defects fixed on the money path, one signing service that brand-web now shares, sixteen new
endpoints, two OTA bundles and one new admin page. Explicit go required before migrate / push / OTA.

## The money-path fixes, first (approval Q4, Q3, 4.4)
These matter more than anything item 7 adds, and were built before it.

- **Both signatures are compare-and-swap.** `UPDATE … AND status = 'x'` with a `rowCount` check, and
  the contract row is taken `FOR UPDATE` at the top of the signing transaction. Before this, a
  Pay for Sale countersignature locked no row anywhere, so a double tap flipped the contract twice,
  wrote two sets of escrow entries and two sets of deliverables.
- **`escrow_entries` has a unique index** on `(campaign_influencer_id, tranche_number)` — the guard
  that cannot be raced.
- **`processTrancheRelease` is idempotent in itself**, not only in its callers: the row is locked, the
  status is re-read, and the mark is a compare-and-swap.
- **The split is exact.** `utils/money.splitAmount` is the one splitter; the escrow writer used to put
  an unrounded float into `numeric(10,2)` and let Postgres round each row independently.
- **`escrow_release` is written.** Nothing in the codebase had ever written the credit side, so a
  brand's reserved figure only ever grew, for the life of the account.

## Database (migration 183, additive)
- Three new `contract_status` values: `withdrawn`, `declined`, `expired`.
- `contracts` gains `reference_no`, **`terms_json`**, `terms_version`, `sent_at/by`,
  `influencer_signed_ip/device`, `brand_signed_name/ip/device`, `withdrawn_at/by`, `declined_at`,
  `decline_reason`, `decline_note` (≤ 200), `expired_at`, `locked_amount`, `campaign_fee_amount`,
  `released_amount`, `money_at`, `pdf_sha256`; a unique index on the reference; an index on status and
  a partial one on the three open statuses; and `contract_reference_seq`.
- New `standard_terms` table, one current enforced by a partial unique index, seeded at version 1.0.
- `platform_settings` gains `campaign_fee_pct` (8, 0–30) and `remote_return_days` (7, 1–60).
- **No backfill.** No reference is invented for an old contract, no terms are snapshotted onto one,
  and no signature is ever invented. The four seeded `active`-with-no-signatures rows stay as they are.

## Backend
- **New:** `services/agreement.service` (the one door — preview, send, both signatures, withdraw,
  decline, cost, expire), `services/agreementTerms.service` (**the snapshot**, the reference, the
  per-Aim money), `services/contractSign.service` (the only place funds lock — shared with
  brand-web), `services/agreementDocument.service` (the PDF, from the snapshot alone),
  `services/standardTerms.service`, `services/agreementCopy`, `controllers/agreements.controller`,
  `controllers/standardTerms.controller`, `routes/item7.routes`.
- **Changed:** `controllers/contract.controller` (the signing transaction moved into the shared
  service; both signature writes guarded; no PDF at approve; the pending list carries the snapshot),
  `services/escrow.service` (exact split, no tier fee on a fee tranche, the release guard, the
  `escrow_release` row), `utils/money` (`splitAmount`), `services/invitationRows.service` (the
  agreement's actions and lines on both sides, the creator's `toSign` / `signedWaiting` groups, the
  Active tab), `services/invitationAnswer.service` and `services/invitationSend.service` and
  `services/negotiation.service` (**stop deleting contract rows**), `services/collabCounts.service`
  (the signature timestamps are the definition of signed; the brand's two new agreement counters),
  `services/contract.service` (`autoCreate` transactional and unambiguous),
  `controllers/production.controller` (**both bypasses gated on both signatures**),
  `jobs/set-expiry.job` (expires unsigned agreements and tells both sides),
  `services/platformSettings.service` (the two new numbers).
- **Notification keys:** `agreement.sent`, `agreement.signed`, `agreement.complete`,
  `agreement.withdrawn`, `agreement.declined`, `agreement.expiring`, `agreement.expired`. There was no
  `agreement.*` namespace before; the five `contract.*` keys stay for the legacy web path.
- **Behaviour a live user could notice:** a creator now receives her tranche in full, where the tier
  fee used to take 1–3% of it; a Hybrid deal no longer carries a campaign fee; the shoot plan can no
  longer be opened without both signatures; brand-web's Approve & Send is switched off with a message;
  an unsigned agreement is now marked rather than deleted when an invitation ends.

## Phone
Brand app: `BrandAgreementScreen` is new and carries P2, P3, P9–P12 and P14; the set detail's chip is
live. Creator app: `AgreementScreen` is new and carries P4–P8; the **Active tab is real for the first
time**; the invitation screen's empty footer becomes the way into the agreement. New shared
`components/agreement/{copy7,bits7,sheets7}.js`. All JavaScript; OTA only. **No new native module**,
which is why the document opens in the system browser rather than in the app.

## Websites
One new admin page, `/admin/settings/terms`, with three `lib/api.js` methods and a nav entry.
brand-web's Approve & Send answers "Agreements are sent from the Brand app."; its `contractLockAmount`
reads the server's number instead of recomputing `fee × 1.08`.

## Tests
Backend `tests/item7-agreement.test.js` (42 new). Mobile `item7Creator.test.js` (8) and
`item7Brand.test.js` (6). Assertions updated where an approved rule changed: the tier fee coming out
of a tranche (`escrow-fee-tiers`, `earnings`, `deliverables`, `contracts`), the unsigned contract being
deleted (`item5-invitations`, `brief-to-signing`), the accepted creator moving to "Your move"
(`item5-invitations`, `item5Brand`), and the settings list gaining two keys (`item6-negotiation`).

**Full backend suite: 229 failed / 1024 passed / 1253**, against the item 6 baseline of
229 / 982 / 1211 — **0 new failures**, 42 new tests. **Mobile: 493 / 493** (baseline 479).

## What item 9 still owns, and the Q3 note
Adding money to the wallet. The check, the shortfall and the hand-off are built here; the destination
is brand-web's wallet page until item 9 gives the phone one.

**When cancellation and disputes arrive, this has to change.** The lock is a destructive decrement of
`brands.wallet_balance`, not a reservation against it, so there is no way to give locked money back.
Today nothing can void a signed agreement, so nothing needs to. A cancellation or a dispute resolution
that returns money will need either a real `locked_balance` column or a compensating credit, and every
reader of "available balance" will have to be revisited at the same time.
