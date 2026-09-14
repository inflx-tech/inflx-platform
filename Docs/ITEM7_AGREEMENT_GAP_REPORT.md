# Item 7 — the agreement and the two signatures
## Phase 1 gap report

Read-only survey, 14 September 2026. Nothing was changed, no migration was run, no production row was
written and no money was moved. Sources, in order of authority: rules doc **v1.19 §9** (with §5, §5B,
§7, §7A, §7B, §10, §12, §19, §21, §24, §25, §26, §27, §28, §31), the **locked mockups P1–P16** and
their rules table, and the item 7 gap-check prompt. Items 5 and 6 were read as they now stand; item 6
went live earlier today.

---

## 1. Summary

| Area | Status | The gap in one line |
|---|---|---|
| The contract row | **P** | It exists with a unique key per invitation, but only 10 of its 24 columns are ever written, and it holds none of item 5's terms. |
| Terms snapshot | **M** | Nothing is frozen. Every term except the fee is re-joined live from the invitation at read and at PDF time, so a signed agreement can silently change. |
| Reference number | **M** | No column, no generator. The only identifier is the raw UUID. |
| Standard terms | **M** | Seven sentences hardcoded inside the PDF generator. No table, no version, no acceptance record. |
| Signature record | **P** | Her typed name and both timestamps exist. **The brand types nothing, and neither side's device or IP is recorded.** |
| Signature safety | **C** | Neither signature is a compare-and-swap. Both update `WHERE id = $1` after an unlocked status read. |
| The signing deadline | **M** | The set's cutoff is enforced on invitations and counters and **never reaches the signing endpoints**. |
| The money gate | **P** | Locking and the first release are real, wired and atomic with the brand's signature. But there is no available-vs-locked model, no shortfall answer, and the lock is not idempotent. |
| The three payments | **C** | Two different fee systems fire on one deal, and the tranche amounts do not sum to the fee on odd numbers. |
| Withdraw / decline / expire | **P** | Decline deletes an unsigned contract. **Withdraw does not exist. The set-expiry job never touches contracts.** |
| The document | **P** | A real PDF is generated and stored in R2, but it is regenerated from live joins, is produced before both signatures, and is handed out as a one-hour credential-free link. |
| The phone apps | **M** | The "Send agreement" chip renders and fires a "Coming soon" toast. No agreement screen, no wallet screen, no signing affordance in either app. |
| Viewing a document on the phone | **C** | **No native module for viewing, downloading, saving or sharing a file is in the binary.** Anything file-based needs an APK rebuild, not an OTA bundle. |
| Needs You | **P** | One creator-side counter exists (`contracts_to_sign`). There is no brand-side counter for an unsent draft or an awaited countersignature. |
| Notifications | **P** | Five `contract.*` keys exist. Nothing covers sent, expiring, expired, or withdrawn. |
| Admin | **P** | Admin can see escrow and contracts. There is no home for the standard terms; the item 6 settings page is the obvious model. |
| Production data | **E** | 6 contracts, 1 genuinely signed. **Zero escrow rows, zero wallet transactions, every balance ₹0.00 — no money has ever moved in production.** |

**The one-sentence verdict.** A contract machine already exists and most of it should be kept, but it
was built for a different deal shape: it snapshots almost nothing, it records a company rather than a
person as the brand's signatory, it does not know the set's cutoff, and its money path — which is real
and does move money — is not safe against a double tap. Item 7 is mostly a hardening and snapshotting
job on top of working machinery, not a green field.

---

## 2. Requirement table

Status: **E** exists · **P** partial · **M** missing · **C** conflicts.

| ID | Requirement | St | Evidence | Proposed change | Risk |
|---|---|---|---|---|---|
| D1.1 | One agreement per invitation | **E** | `migrations/006_contracts_and_payment_config.sql:18` — `campaign_influencer_id UUID NOT NULL UNIQUE` | None. Keep. | — |
| D1.2 | Reference number `INFLX-YYYY-NNNNN` | **M** | No column; grep for `reference_number\|contract_no` returns nothing | Add `reference_no text UNIQUE` + a per-year sequence, stamped at send | Low |
| D1.3 | Terms snapshot | **M** | `contract.service.js:122-148` writes 10 columns; everything else is joined live at `contract.controller.js:74-108` | Add `terms_json jsonb`, written once at send | **High** — this is the item's spine |
| D1.4 | Standard-terms version stamped | **M** | Seven sentences hardcoded at `pdf.service.js:266-275` | New `standard_terms` table + `terms_version` on the contract | Medium |
| D1.5 | State: draft·sent·signed by creator·both·withdrawn·declined·expired | **P** | Enum is `draft, pending_influencer, pending_brand, active, disputed` — `006:10-12`, `019:14` | Add `withdrawn`, `declined`, `expired`; map sent→`pending_influencer`, hers→`pending_brand`, both→`active` | Low |
| D1.6 | Her signature: name, time, device, IP | **P** | `influencer_signed_name`, `influencer_signed_at` exist (`006:26-27`). No device, no IP | Add `influencer_signed_ip inet`, `influencer_signed_device text` | Low |
| D1.7 | The brand's signer, by name | **M** | Only `brand_signed_by uuid → users(id)` (`006:29`). The PDF prints the **company** name at `pdf.service.js:289` | Add `brand_signed_name`, `brand_signed_ip`, `brand_signed_device` | Low |
| D1.8 | Sent at, sent by | **M** | No columns | Add `sent_at`, `sent_by` | Low |
| D1.9 | Withdrawn / declined records | **M** | No columns. Decline hard-deletes the row (`invitationAnswer.service.js:131`) | Add `withdrawn_at/by`, `declined_at`, `decline_reason`, `decline_note` | Medium |
| D1.10 | Money at signing | **P** | The lock is written to `wallet_transactions` (`contract.controller.js:505-516`); nothing links it back to the contract | Add `locked_amount`, `released_amount`, `campaign_fee_amount`, `locked_at` | Medium |
| D1.11 | The document | **P** | `pdf_url`, `pdf_generated_at`, `pdf_generation_error` (`006:30`, `017:8-10`). `pdf_url` actually holds an **R2 object key**, not a URL (`storage.service.js:16-17`) | Add `pdf_sha256`; produce only at completion | Medium |
| D2 | Aim-aware contents | **M** | The PDF renders one fixed layout and hardcodes 25/25/50 at `pdf.service.js:226-234` | Build the document from the snapshot, branched by Aim | Medium |
| D2b | Never the follower offer, description, street address | **C** | The PDF prints the offer and coupon at `pdf.service.js:237-260`; branch street lives in `brand_branches.formatted_address` | Exclude at snapshot time, not at render time | Medium |
| D2c | Three tranche amounts sum exactly to the fee | **C** | `escrow.service.js:71` — `const amount = fee * t.pct;` unrounded into `numeric(10,2)`. The display uses a **different, correct** algorithm at `invitationRows.service.js:339-340` | One shared exact-sum helper, used by both | **High** |
| D3 | Never editable after send | **M** | `approveContract` rewrites `content_requirements`, `custom_clauses`, `bonus_amount`, `production_mode` (`contract.controller.js:1163-1180`) | Refuse every edit once `sent_at` is set | Medium |
| D4.1 | Order: she signs, then the brand | **E** | `sign` needs `pending_influencer` (`:420`); `brandSign` needs `pending_brand` (`:629`) | Keep, and add the exact message | — |
| D4.2 | Typed name + two ticks | **P** | Her typed name is required (`:429-432`). The brand's endpoint **takes no body at all** (`:608`) | Add the brand's typed name and record both ticks | Low |
| D4.3 | Device and IP available? | **E** | `app.set('trust proxy', 1)` — `app.js:25`. `req.ip` and the user agent are already captured for link clicks at `tracking.controller.js:34-35` | Capture both on each signature | Low |
| D4.4 | Idempotent signing | **C** | Both updates are `WHERE id = $1` after an unlocked read — `contract.controller.js:436-443` and `:520-526` | `... AND status = 'x'` plus `rowCount === 0` → refuse; unique index on `escrow_entries (ci_id, tranche_number)` | **Highest** |
| D4.5 | Neither side may sign after the cutoff | **M** | **Zero cutoff references in `contract.controller.js`** (verified by grep) | Call `campaignState.assertNotClosed` in both sign paths | **High** |
| D5.1 | Required = fee + campaign fee (PfC) / fee (Hybrid) / nothing (PfS) | **C** | Today it is always `fee × (1 + platform_fee_pct/100)` (`contract.controller.js:481`) with no Aim branch | Branch by Aim; name the campaign fee properly | **High** |
| D5.2 | Checked against **available** balance | **C** | There is no available-vs-locked model. `brands.wallet_balance` **is** decremented by the lock. `wallet.controller.js:57-58` says so | Decide: keep the destructive decrement, or add a reserved column | **High** |
| D5.3 | Short → refuse, return the shortfall | **M** | Throws `WALLET_INSUFFICIENT` with a formatted string (`:662-677`); the shortfall is not a machine-readable field | Return `details: { required, available, shortfall }` | Low |
| D5.4 | Lock + first release atomic with the signature | **E** | All inside one `db.withTransaction` — `contract.controller.js:681-686`, `_signOneContractInTx:476-602` | Keep. This part is genuinely right. | — |
| D5.5 | Never double-lock or double-release | **C** | No status predicate, no unique constraint on `escrow_entries` | See D4.4 | **Highest** |
| D6.1 | Withdraw before her signature | **M** | No endpoint exists | New endpoint | Low |
| D6.2 | Decline with a reason | **P** | Invitation decline exists with five reasons (`invitationAnswer.service.js`); there is no agreement decline, and decline **deletes** the contract row | Add a sixth reason, "the agreement terms"; stop deleting, mark `declined` | Medium |
| D6.3 | Expire unsigned at the cutoff | **M** | `set-expiry.job.js` reads contracts only to decide whether to keep a set (`:49-52`); it never writes one | Extend the job | **High** |
| D7 | What signing starts | **E** | `campaign_influencers.status = 'contracted'` (`contract.controller.js:530-533`) and a `production_events` row (`:545`) | Keep; add the Active tab on both apps | Medium |
| D8 | The document, at completion only, both parties only | **P** | Generated at approve **and** at sign (`:1202`, `:695`); a presigned R2 URL is valid for a credential-free hour (`:975`) | Generate at completion only; shorten and log the link | Medium |
| D9 | Versioned standard terms | **M** | See D1.4 | New table + admin page | Medium |
| D10 | Privacy | **E** | `assertPartyAccess` — `contract.controller.js:136-150`; even admin is refused | Keep | — |
| D11 | Legacy data | **P** | See §12 | No backfill, and never invent a signature | Low |

---

## 3. What already exists, in detail

### 3.1 The contract row — **keep, extend heavily**
`contracts` was created by `migrations/006_contracts_and_payment_config.sql:16` (migration 001 declared
it but was never applied — 006 says so at its line 3). Three `ALTER TABLE`s followed: `017:8`,
`019:19`, `024:19`. **24 columns in total**, of which the ones that matter are `campaign_influencer_id`
(NOT NULL, **UNIQUE**), `influencer_fee`, `posting_date`, `content_requirements`, three denormalised
name columns, `influencer_signed_at`, `influencer_signed_name`, `brand_signed_at`, `brand_signed_by`,
`pdf_url`, `status`, `custom_clauses`, `bonus_amount`, `approved_at/by`, `production_mode`.

The status enum is `draft → pending_influencer → pending_brand → active → disputed` (`006:10-12` plus
`019:14`). `disputed` is written by nothing. `influencer.controller.js:1615` tests for `'completed'`,
which is not a member — dead code.

**What it cannot hold:** commission, deliverables, usage rights, any of the four selling-scope columns,
the brand's note, `min_shoppable_posts`, the branch, or the Aim. Migration `182:126` explicitly promises
that `min_shoppable_posts` will be "copied into the agreement (item 7)" — nothing copies it yet.

### 3.2 `contract.service.autoCreate` — **keep, and change what it means**
`services/contract.service.js`, 189 lines, one export. It is **not transactional** — three separate pool
queries. It writes exactly 10 columns (`:122-148`) with `ON CONFLICT (campaign_influencer_id) DO
NOTHING`, defaults `revision_limit` to a hardcoded `2`, and notifies the **brand** with
`contract.draft_ready`. When the conflict fires it returns `null` and sends nothing, which callers
cannot distinguish from "invitation not found".

**Five callers**, all outside a transaction, all best-effort:

| Caller | Trigger | Status produced |
|---|---|---|
| `invitationAnswer.service.js:95` | she accepts a handpick invitation | `draft` |
| `negotiation.service.js:288` | either side accepts a counter (item 6) | `draft` |
| `campaign.controller.js:1763` | the brand approves an open-group application | `draft` |
| `contract.controller.js:1056` | the manual retry endpoint | `draft` |
| `invitationSend.service.js:354` | briefing from a settled pre-campaign agreement | **`pending_influencer`** |

That last one is the only path that skips the brand's Approve & Send, by design
(`contract.service.js:110-117`).

### 3.3 The signature paths — **keep the shape, fix the safety**
- **Hers**, `contract.controller.js:406-465`. Validates role, ownership, `status === 'pending_influencer'`
  and a non-empty typed name. **Not transactional** (a bare `db.query` at `:435`). Notifies the brand
  with `contract.influencer_signed`. No money.
- **The brand's**, `:608-779`. Validates role, ownership, `status === 'pending_brand'`, then a
  non-transactional wallet pre-flight, then one `db.withTransaction` that locks the brand row `FOR
  UPDATE`, decrements the balance, writes an `escrow_lock` row, flips the contract to `active`, flips
  the invitation to `contracted`, creates the production event, creates three escrow entries, releases
  tranche 1, and creates the deliverables. Afterwards, outside the transaction, it generates the PDF
  and notifies her with `contract.active`.
- **Bulk**, `:792-899`, up to 100 at once in one transaction.

**Neither signature is a compare-and-swap.** Both read the status without a lock and then update `WHERE
id = $1`. For a Pay for Sale contract the fee is zero, so `needsWalletLock` is false and **no row is
locked anywhere** — two simultaneous countersignatures would both succeed and create the deliverables
twice.

### 3.4 The money machinery — **real, wired, and running**
This is the part most likely to be underestimated. It is not a stub.

- `escrow.service.createEscrowEntries` writes three `escrow_entries` rows, status `locked`, with
  triggers `contract_signed`, `content_live`, `day_30_post_live` — an enum that already exists
  (`001:43`).
- Tranche 1 releases inside the signing transaction (`contract.controller.js:561`).
- Tranche 2 releases when every deliverable is live (`deliverable.controller.js:422`), correctly guarded
  inside its transaction.
- Tranche 3 is armed by tranche 2 and released by a cron that **is scheduled** — `jobs/index.js:58`,
  hourly, India time.
- `processTrancheRelease` credits `influencers.wallet_balance` and `total_earned` and writes an
  `influencer_ledger` row. It does **not** touch `pending_balance`, which is the follower-commission
  bucket.

Three defects sit inside it, all of which item 7 would inherit:

1. **`escrow_release` is written nowhere.** `wallet.controller.js:71` reads it to compute
   `reserved_balance`, so that number only ever grows. Already recorded in
   `Docs/BACKEND_DB_AUDIT_2026-09-09.md:81`.
2. **Two fee systems fire on one deal.** The brand is charged `fee × 1.08` on top
   (`contract.controller.js:481`) and the creator separately loses 3/2/1% out of each tranche
   (`escrow.service.js:72`). On a ₹10,000 fee the brand pays ₹10,800 and the creator receives ₹9,700.
3. **The tranche split is unrounded.** `escrow.service.js:71` puts a raw float into `numeric(10,2)`, so
   Postgres rounds each row independently and the three parts need not sum to the fee.

### 3.5 The PDF service — **keep the library, rewrite the document**
`services/pdf.service.js`, 409 lines, `pdfkit`, in-memory buffer. Renders parties, campaign details,
deliverables, production arrangement, special clauses, content requirements, a **hardcoded** 25/25/50
schedule, commission terms, seven hardcoded terms, and two signature blocks. Stored via
`storage.service.uploadPDF` under the R2 key prefix `contracts/`; `contracts.pdf_url` holds the **key**,
not a URL.

Served three ways: a streaming endpoint that regenerates on every call and accepts a token in the query
string (`authenticateWithQuery`, `middleware/auth.js:37-50`), a presigned R2 URL valid for **one
credential-free hour** (`contract.controller.js:975`), and a brand-only regenerate.

For item 7 it fails on five counts: it renders live joins rather than a snapshot, it is produced before
both signatures, it prints the company name on the brand's line, it carries no device or IP, and it
prints the follower offer and the coupon, which the rules forbid.

---

## 4. Link readiness

| Link | Ready? | What is missing |
|---|---|---|
| **Item 5: the invitation's terms** | **Not ready — answer this first** | Every column exists on `campaign_influencers`: `agreed_fee`, `commission_pct`, `formats_json`, `usage_rights_json`, `alloc_scope`/`alloc_category`/`alloc_category_node_id`/`alloc_product_ids`, `brand_note` (≤300), `min_shoppable_posts`. **The contract can carry none of them.** This is the gap both earlier reports named, and it is answered by one new `terms_json` column plus a snapshot at send. Note the mode and branch are **not** on the invitation — they live on `campaign_sets.shoot_mode` and `campaign_sets.branch_id`. |
| **Item 6: an accepted counter** | **Ready** | `negotiation.service.js:270-281` rewrites `agreed_fee`, `commission_pct`, `formats_json` and `usage_rights_json` on the invitation itself, gated by Aim. The rules already say the agreement is generated from the invitation, never the thread (v1.19 line 394). Because item 7 will snapshot **at send** and not at accept, a stale draft cannot survive. |
| **Item 6: the draft contract** | **Ready, with a recommendation** | Both accepts call `autoCreate` and leave a `draft` row holding the fee and the posting date. **Recommendation: leave it, and generate at send.** Deleting it would break the retry endpoint and `contract_create_error`; using it as the agreement would mean snapshotting at accept, which is exactly when terms can still change. Treat the draft as a placeholder and have "Send agreement" fill it in. |
| **Item 4: the cutoff** | **Not ready** | `campaignState.cutoffFor` = posting date − 3 days, recomputed never stored (`:31-34`); `assertCanInvite` throws `INVITE_CLOSED` 422. `indiaDay.js` is correct on both IST and UTC servers. **None of it is called from `contract.controller.js`.** Both signing endpoints must call it. |
| **Item 4: the set-expiry job** | **Not ready** | It closes `invited/applied/accepted/negotiating` rows, ends open threads, stamps `expired_at`, and keeps a set that has any both-signed contract. **It never writes a contract row**, so an expired invitation can leave a live `draft` or `pending_influencer` contract behind. It correctly leaves `deferred` alone. |
| **Item 6: the pool** | **Ready** | A move agreed sets `deferred`, and `moveAnswer` already deletes the unsigned contract (`negotiation.service.js:378,384`). Nothing in item 7 should touch a `deferred` row. |
| **§10 funding** | **Partly ready** | Everything in §3.4. Real: the lock, the three entries, all three releases, the cron. Missing: available-vs-locked, the campaign fee as a named quantity, idempotency, and an unlock path. |
| **§21 payments by Aim** | **Partly ready** | `payment_config` holds 25/25/50 and `platform_fee_pct` 8%. Only four files read the tranche percentages, and only `escrow.service.js:23-25` writes money from them. **There is no "INFLX campaign fee" column, config key or code path anywhere** — the 8% platform fee is doing that job today, with no Aim branch, so a Hybrid deal is charged a campaign fee the rules say it must not be. |
| **Items 10 / 11** | **Ready, but leaky** | A `production_events` row is created automatically inside the countersign transaction. Two endpoints bypass the gate entirely: `POST /contracts/:id/production/initialise` and the auto-heal on `GET /contracts/:id/production` check party membership but **no status at all**. Also `production.controller.js:559` filters on `ci.status = 'live'`, which is not a value of the enum. |
| **Item 8: pitches** | **Ready to report** | A pitch no longer creates a contract at acceptance (migration `149:145-146`). It produces a `collab_agreements` row; briefing that into a campaign calls `autoCreate(ci.id, { ready: true })`, which skips Approve & Send. Consequences: no `custom_clauses`, `bonus_amount` 0, `approved_at` null, `production_mode` usually null, and **no PDF at all** when she reaches the sign screen. |
| **Item 24: Needs You** | **Partly ready** | Step 2 is called "Sign" (`collabStep.service.js:26`) and is the only step between agreeing and shooting. Her side has `contracts_to_sign` (`collabCounts.service.js:204-206`). **The brand has no equivalent** — nothing counts a `draft` awaiting send or a `pending_brand` awaiting the countersignature. Also `collabStep.service.js:131` matches `pending_brand`/`pending_influencer` against the **invitation's** status, where they never appear. |
| **Notifications** | **Partly ready** | `notification.service.send` writes an in-app row, pushes via OneSignal with an FCM fallback, and **SMS is a deliberate no-op since 2026-08-18**. Five contract keys exist: `contract.draft_ready`, `contract.influencer_signed`, `contract.active`, `contract.ready`, `contract.updated`. Missing: sent, withdrawn, declined, expiring soon, expired unsigned. |
| **The PDF** | **Partly ready** | §3.5. |
| **Admin** | **Partly ready** | `app/admin/escrow` and `app/admin/brands/[id]` touch contracts. A new admin page is two steps: a `page.js` and one entry in the `NAV` array of `app/admin/layout.js`. The item 6 platform-settings page is the model, audit line included. |
| **Production data** | See §12 | |

---

## 5. The money answer

**What is real today.** All of it moves. On the brand's countersignature, inside one transaction: the
brand row is locked `FOR UPDATE`, `wallet_balance` is decremented by `fee × 1.08`, an `escrow_lock`
transaction is written, three `escrow_entries` are created, and tranche 1 is released to the creator's
`wallet_balance` with an `influencer_ledger` row. Tranche 2 fires on content going live. Tranche 3 is
armed by tranche 2 and released by an hourly cron that is scheduled and running. None of this is a stub.

**What item 7 must build.**
1. **An Aim branch on the required amount.** Pay for Content = fee + campaign fee. Hybrid = the fixed
   fee alone. Pay for Sale = nothing, and no check. Today there is one formula for all three.
2. **The campaign fee as a real quantity.** It does not exist under that name anywhere. Either the 8%
   platform fee is renamed and restricted to Pay for Content, or a new admin number joins item 6's
   platform settings. This needs your decision — see Q3.
3. **A machine-readable shortfall** so the app can print "Add ₹3,500 to sign".
4. **Idempotency.** A guarded UPDATE, a `rowCount` check, and a unique index on `escrow_entries
   (campaign_influencer_id, tranche_number)`.
5. **An exact-sum split.** One helper, used by both the display and the escrow writer.
6. **The `escrow_release` write** so `reserved_balance` comes back down.

**What item 9 owns.** Adding money to the wallet. The brand-web wallet page already does Razorpay
top-ups, and `react-native-razorpay` is already in the phone binary but wired to nothing — the phone
has no wallet screen at all. Item 7 builds the check, the shortfall and the hand-off; the destination
screen can be a link to brand-web until item 9 lands.

**Can locking and releasing be atomic with the signature? Yes — they already are.** `_signOneContractInTx`
does the balance decrement, the contract flip, the escrow entries and the tranche 1 release inside one
`db.withTransaction`. Item 7 does not need to invent this; it needs to make it safe to call twice.

**The one thing I must be blunt about.** The lock is **destructive**: it subtracts from
`brands.wallet_balance` rather than reserving against it, and `wallet.controller.js:57-58` states that
this is deliberate — "already net of locks + payouts, so it IS available". That is workable and I
recommend keeping it, because changing it now would touch every balance reader. But it means "available
balance" and "total balance" are the same number, the mockup's phrase "Your wallet has ₹24,000
available" is simply the wallet balance, and there is **no way to unlock** money if an agreement is
later voided. Since nothing after signing can void an agreement in Phase 1, that is safe today. It will
not be safe when cancellation and disputes arrive.

---

## 6. Proposed migrations (additive)

**Next free number: 183.** The highest applied is 182 (item 6, applied to production today).

### 183 — the agreement
```
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'withdrawn';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'declined';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'expired';

ALTER TABLE contracts
  ADD COLUMN reference_no          text,
  ADD COLUMN terms_json            jsonb,
  ADD COLUMN terms_version         text,
  ADD COLUMN sent_at               timestamptz,
  ADD COLUMN sent_by               uuid REFERENCES users(id),
  ADD COLUMN influencer_signed_ip     text,
  ADD COLUMN influencer_signed_device text,
  ADD COLUMN brand_signed_name     text,
  ADD COLUMN brand_signed_ip       text,
  ADD COLUMN brand_signed_device   text,
  ADD COLUMN withdrawn_at          timestamptz,
  ADD COLUMN withdrawn_by          uuid REFERENCES users(id),
  ADD COLUMN declined_at           timestamptz,
  ADD COLUMN decline_reason        text,
  ADD COLUMN decline_note          text,
  ADD COLUMN expired_at            timestamptz,
  ADD COLUMN locked_amount         numeric(12,2),
  ADD COLUMN campaign_fee_amount   numeric(12,2),
  ADD COLUMN released_amount       numeric(12,2),
  ADD COLUMN money_at              timestamptz,
  ADD COLUMN pdf_sha256            text;

CREATE UNIQUE INDEX uq_contracts_reference ON contracts (reference_no) WHERE reference_no IS NOT NULL;
CREATE INDEX idx_contracts_status ON contracts (status);
CREATE INDEX idx_contracts_open_unsigned ON contracts (status)
  WHERE status IN ('draft','pending_influencer','pending_brand');
CREATE SEQUENCE IF NOT EXISTS contract_reference_seq;

CREATE TABLE standard_terms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version      text NOT NULL UNIQUE,
  body_md      text NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  is_current   boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_standard_terms_current ON standard_terms (is_current) WHERE is_current;

-- the money-safety fix item 7 inherits
CREATE UNIQUE INDEX uq_escrow_ci_tranche ON escrow_entries (campaign_influencer_id, tranche_number);
CREATE INDEX idx_escrow_ci ON escrow_entries (campaign_influencer_id);
```
Seed one `standard_terms` row at version `1.0` carrying the seven sentences that are hardcoded in
`pdf.service.js` today, so nothing already signed changes meaning.

**Dry-run checks to print:** contracts by status; contracts with one signature, both, neither;
contracts that are `active` with no signatures; contracts with a PDF; escrow rows by status; **and
whether any `(campaign_influencer_id, tranche_number)` pair is already duplicated**, since the new
unique index would fail on one. Production has zero escrow rows, so it will not.

**No backfill.** No reference number is invented for an old contract, and no signature is ever invented.

---

## 7. Proposed endpoints

Envelope as everywhere else: `{success:true,data}` / `{success:false,error:{code,message,field}}`.
Brand endpoints for the owning brand, creator endpoints for that creator, everything else 404.

| ID | Method and path | Status | Notes |
|---|---|---|---|
| C1 | `GET /campaigns/:id/sets/:sid/invitations/:ciId/agreement/preview` | **new** | Generated from the invitation. Returns the parties, the Aim-branched terms, the note, the standard-terms version, the reference as `DRAFT`. |
| C2 | `POST …/agreement/send` | **new** | Creates or fills the draft, stamps `reference_no`, `terms_json`, `terms_version`, `sent_at/by`, status → `pending_influencer`, notifies her. Refuses: not accepted (`{Name} hasn't accepted the terms yet.`), already sent (`An agreement is already out with {name}.`), after the cutoff (`Signatures for this set closed on {date}.`) |
| C3 | `GET …/agreement` | **new** (wraps `getContract`) | State, both signature blocks, the money summary, what the brand must do next. |
| C4 | `GET …/agreement/cost` | **new** | `{ fee, campaignFee, totalToLock, payouts:[t1,t2,t3], availableBalance, shortfall }`. Pay for Sale returns nulls and `gate:false`. |
| C5 | `POST …/agreement/sign` (brand) | **extends** `brandSign` | Now takes `{ typedName, ticks }`. Adds: cutoff refusal, her-signature-first refusal, a guarded UPDATE, `details.shortfall` on `WALLET_INSUFFICIENT`, and the Aim branch on the amount. |
| C6 | `POST …/agreement/withdraw` | **new** | Only while `influencer_signed_at IS NULL`. Refuses with `{Name} has already signed, so this can't be withdrawn.` Invitation returns to `accepted`. |
| C7 | `GET /influencers/me/invitations/:ciId/agreement` | **new** | Everything P5 shows, the split as amounts, the standard-terms version. |
| C8 | `POST …/agreement/sign` (creator) | **extends** `sign` | Adds the cutoff refusal, the ticks, IP and device, and a guarded UPDATE. |
| C9 | `POST …/agreement/decline` | **new** | Six reasons (item 5's five plus `agreement_terms`), note ≤ 200. Marks `declined`; **stops deleting the row**. |
| C10 | `GET /standard-terms` and `/standard-terms/:version` | **new** | Public to both roles. |
| C11 | `GET …/agreement/document` | **extends** the PDF endpoints | Only once both have signed; otherwise `The agreement can be downloaded once you've both signed.` |
| C12 | job: expire unsigned agreements at the cutoff | **extends** `set-expiry.job` | Idempotent, logged, asserts nothing is locked, and names the half-signed case to her. |

New error codes: none. `VALIDATION_ERROR`, `INVITE_CLOSED`, `WALLET_INSUFFICIENT`, `LOCKED`,
`NOT_FOUND`, `FORBIDDEN` cover everything.

---

## 8. The terms snapshot

One `jsonb` column, written **once**, at send, and never again. Shape, following item 6's snapshot
convention so the two are readable side by side:

```
{
  aim, campaignName, setName, postingDate, shootMode, branchName, branchCity,
  cutoff, parties: { brand:{name,city,state,signerLabel}, creator:{name,city,state,handle} },
  money: { fee, commissionPct, campaignFee, split:{t1,t2,t3}, splitPct:{25,25,50} },
  work:  { deliverables:[{type,count}], usageRights:{on,durationDays,places}, minShoppablePosts },
  sell:  { scope, words }, note, returnTerms, commissionPaidAfterDays,
  termsVersion, referenceNo, generatedAt
}
```

**Why it cannot drift.** Today the PDF re-joins `campaign_influencers`, `campaign_sets`, `campaigns` and
`collab_agreements` on every render, so editing an upstream row silently rewrites a signed agreement.
After this change the document reads only `terms_json`, and `terms_json` is written by exactly one
function, guarded by `WHERE sent_at IS NULL`. The three tranche amounts are computed once, by the shared
exact-sum helper, and stored as rupee amounts — not recomputed at render, where a changed
`payment_config` would produce different numbers on the same signed page.

---

## 9. The standard terms

**Recommendation: a `standard_terms` table, not a file and not a row in `platform_settings`.**

Item 6's `platform_settings` holds three integers with a min and a max. The standard terms are a long
versioned document that must be served by version forever, which is a different shape. But the **admin
page** should sit right beside item 6's, at `/admin/settings/terms`, gated on the same `settings`
capability, copying the same skeleton including the audit line.

Versioning: one row per version, `is_current` unique-partial so exactly one is live. Publishing a new
version inserts a row and flips the flag. An agreement stores `terms_version` at generation, and
`GET /standard-terms/:version` serves that exact body forever. Updating the terms therefore cannot
change anything already generated — which is the whole point.

The first row is version `1.0`, carrying verbatim the seven sentences now hardcoded at
`pdf.service.js:266-275`, so no already-signed contract changes meaning on the day this ships.

---

## 10. The document

- **Generated only when both signatures exist**, from `terms_json` alone. Remove the generate calls at
  `approveContract:1202` and keep the one at the end of the countersignature.
- **Stored** in R2 under `contracts/`, as today, with `pdf_sha256` recorded so drift is detectable.
- **Access**: `assertPartyAccess` already refuses everyone but the two parties, admin included. Keep it.
  Shorten the presigned URL from one hour to five minutes and log each issue. Refuse the download
  before completion with the exact message.
- **On the phone**: this is the hard constraint, so it decides the design. **No native module for
  viewing, downloading, saving or sharing a file is in the binary** — no `react-native-pdf`, no
  `react-native-blob-util`, no `react-native-fs`, no `react-native-share`. Core `Share` is text only.
  Adding one means an APK rebuild, not an OTA bundle.

  The two options that ship over the air are: render the agreement as native views from the snapshot,
  exactly as item 5 already renders terms, and hand the PDF to the system browser with
  `Linking.openURL(presignedUrl)` — the pattern already used in six places, with `openWebDashboard` as
  a ready-made helper. `react-native-webview` is linked but has never been rendered in this app, so I
  would not rely on it untested. **Recommendation: native views for reading and signing, and
  `Linking.openURL` for "Download".** See Q7.

---

## 11. Frontend plan

**Brand app.** The attach point already exists: the "Send agreement" chip renders on every `accepted`
row and fires a "Coming soon" toast at `BrandSetDetailScreen.js:172`; the backend already emits the
flag at `invitationRows.service.js:186` with the comment "item 7's button". New screens:
`BrandAgreementPreviewScreen` (P2), `BrandAgreementScreen` (P1 entry, P9, P10, P12), and sheets for
send (P3), sign (P11) and withdraw (P14). Reused: `LockedSetCard5`, `KV5`, `ValueLine6`, `Chip5`,
`StateBox6`, `EndingCard6`, `ConfirmSheet`, `TextField4`, `CheckboxRow`, `PrimaryButton`, `Skeleton`,
`LoadError`, `EmptyState`. `MoveConfirmSheet6` is the closest precedent for the P11 "here is exactly
what this does" confirm.

**Creator app.** `CollabsScreen`'s **Active tab is a hardcoded no-op** — `TAB_PARAM` has no entry for
it and the file comment says "Active arrives with item 7". That tab, plus a new chip and sentence for
"Agreement ready to sign", plus `AgreementScreen` (P5, P7), a sign sheet (P6) and a decline sheet (P8),
which is item 5's `DeclineSheet5` with a sixth reason. The invitation screen's footer is empty for an
`accepted` row, which is exactly where "Read and sign" belongs.

**New components:** a signature block (signed = green surface, unsigned = outlined), a tick row (wrap
the existing `CheckboxRow`), a money summary card, and the shortfall card.

**Wallet.** Neither app has a wallet screen; both tabs are `ComingSoonScreen`. P10's "Add ₹3,500 to
wallet" has nowhere to go on the phone. Until item 9, it should open brand-web's wallet page through
`openWebDashboard`.

**Admin.** One page, `/admin/settings/terms`, and one `NAV` entry.

**Websites.** brand-web already has a working contract surface — `contractApi` with `brandSign`,
`bulkSign`, `getPdfUrl`, a PDF iframe, and `contractLockAmount`. It will keep working, but its money
math (`walletLock(fee, bonus, platformFeePct)`) is the old one-formula-for-all-Aims rule and will
disagree with the phone once item 7 branches by Aim. It needs the same branch.

---

## 12. Production data, and what legacy rows will show

Read-only probe, 14 September 2026:

| Fact | Value |
|---|---|
| contracts | 6 |
| by status | 5 `active`, 1 `pending_brand` |
| both signatures | 1 |
| one signature | 0 |
| no signature | 5 |
| `active` with no signatures | 4 |
| with a PDF | 1 |
| duplicate contracts per invitation | none |
| accepted invitations with no contract | 0 |
| escrow entries | **0** |
| wallet transactions | **0** |
| brand wallet balances | **₹0.00 across 9 brands** |
| creator balances | **₹0.00 wallet, ₹0.00 pending, across 26 creators** |

Five of the six contracts were written by a seed script on 21 August (identical timestamps) with
`status = 'active'` and both signature columns null. The sixth, from 28 August, is genuinely signed by
both and has a PDF.

**No money has ever moved in production.** Nothing is locked, nothing is released, no ledger row exists.

**What legacy rows would show, and why I recommend no backfill.** The four `active`-with-no-signatures
rows would appear on the new screens as signed-by-both, because `campaign_influencers.status` reads
`contracted`/`active`, while the canonical `SIGNED_CONTRACT_SQL` test would call them unsigned. That
disagreement already exists in the code today: two definitions of "signed by both" coexist —
`influencer_signed_at IS NOT NULL AND brand_signed_at IS NOT NULL` (14 call sites) and
`contract_status === 'active'` (`collabCounts.service.js:123,282`). Item 7 should settle on the
signature test everywhere and leave the seeded rows alone. They are test data, they carry no money, and
inventing a signature to tidy them up would be exactly the wrong thing to do to an evidentiary record.

---

## 13. Test baseline, and what item 7 will add

**Measured today, after item 6 shipped: 229 failed / 982 passed / 1211 total.** Item 7 must add no new
failures.

Existing suites that will be touched: `tests/contracts.test.js`, `tests/brief-to-signing.test.js`,
`tests/admin-escrow.test.js`, `tests/escrow-fee-tiers.test.js`, `tests/cron-tranche3.test.js`,
`tests/cron-low-wallet.test.js`.

New: `backend/tests/item7-agreement.test.js` covering checks 1–32, with particular weight on the money
ones — a short balance leaving nothing locked and her signature intact, a concurrent double
countersignature producing one lock and one release, a failure mid-transaction leaving neither, and the
three tranche amounts summing exactly to an odd fee. Plus `item7Brand.test.js` and
`item7Creator.test.js` for the screens.

---

## 14. Questions, each with a recommendation

**Q1. The campaign fee has no home. What is it?**
The mockups show "INFLX campaign fee ₹500" on a ₹9,000 Pay for Content deal. That is 5.6%, not the 8%
`platform_fee_pct` charges today, and today's 8% is charged on **every** Aim including Hybrid, which
§10 says must not carry one. **Recommendation: a new admin number beside item 6's platform settings —
a percentage of the fee, charged on Pay for Content only, default 8% to match today.** Keep
`platform_fee_pct` for the marketplace and rename nothing.

**Q2. Two fee systems are charged on one deal.** The brand pays `fee × 1.08` on top; the creator
separately loses 3/2/1% out of each tranche via `escrow_fee_tiers`. On a ₹10,000 fee the brand is
debited ₹10,800 and the creator credited ₹9,700. The mockups show the creator receiving the full
₹2,250/₹2,250/₹4,500 with no deduction. **Recommendation: for Pay for Content and Hybrid, the escrow
tier fee is not taken — the campaign fee is the platform's whole take, and the creator receives the fee
in full, exactly as P9 and P13 promise.** This needs your word, because it changes what INFLX earns.

**Q3. Should the lock reserve, or keep decrementing?** Today the lock subtracts from
`wallet_balance` outright, so "available" and "total" are one number and there is no unlock path.
**Recommendation: keep it. Add nothing.** It is honest, every reader already agrees with it, and Phase 1
has no path that voids a signed agreement. Revisit at cancellation and disputes.

**Q4. Do I fix the signing idempotency as part of item 7?** It is a live defect on a money path: two
simultaneous countersignatures would double-lock the brand and pay tranche 1 twice, and for a Pay for
Sale contract nothing is locked at all. **Recommendation: yes, and first.** A guarded UPDATE, a
`rowCount` check and the unique index on `escrow_entries` are three small changes, and item 7 doubles
the traffic on that path.

**Q5. The commission return window says 7 in two places and 30 in the database.** P2 prints "After the
7-day return window"; §25 says "Admin-controlled; default 7 days"; production `payment_config` has
`return_window_days = 30`. **Recommendation: the agreement prints whatever the config says, and the
mockup's "7" is read as an example.** Confirm.

**Q6. Where does the Remote return term come from?** P5 says "Send back anything you don't keep within
7 days of posting. Stride Kicks pay the return shipping." No such number or rule exists in the code.
**Recommendation: a fixed platform sentence in the standard terms with the number as a fourth admin
setting, default 7 days.**

**Q7. The document on the phone.** No native module for viewing or saving a file is in the binary, so a
real in-app PDF viewer or a Download button means an APK rebuild. **Recommendation: render the
agreement as native views from the snapshot for reading and signing, and make "Download" open the
system browser on a presigned link.** Everything then ships over the air. Say the word if you would
rather rebuild the APK for a proper in-app viewer.

**Q8. What happens to an expired invitation's unsigned contract?** The set-expiry job never touches
contracts, so today one is left alive. Decline and the move-decline both **hard-delete** the row.
**Recommendation: stop deleting anywhere. Mark `declined`, `withdrawn` or `expired` and keep the row**
— an agreement that once existed is a record, and P15 has to name its ending months later.

**Q9. Does "Send agreement" replace the brand's existing Approve & Send step?** brand-web has a working
`approveContract` that sets custom clauses and a bonus. **Recommendation: item 7's Send supersedes it
for set-based collaborations, and Approve & Send stays for the legacy web path** until it can be
retired. Custom clauses and the bonus are not in item 7's mockups and should not appear on the phone.

**Q10. Who is the brand's signer?** The rules say a named person. Today only a user id is stored and
the PDF prints the company. **Recommendation: pre-fill the typed name from `users.name` on the signing
account, editable, and print "{Name}, for {Brand}" as P13 does.**

**Q11. Two definitions of "signed by both" coexist in the code.** **Recommendation: the signature
timestamps win everywhere, and `collabCounts` stops reading `status === 'active'`.**

**Q12. Confirming §11's assumptions.** All twelve are consistent with the rules doc and with what the
code can support. The two that need your explicit yes are number 6 (available balance — see Q3) and
number 11 (the PDF only at completion, which means removing today's generate-at-approve).

---

## 15. What I have not done

No code was changed, no migration was run, no production row was written, and no money was moved. The
only production access was read-only `SELECT` for the counts in §12.

**Stopping here for your approval**, as the prompt requires.
