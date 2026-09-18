# Item 10 — The Store Visit shoot plan: Phase 1 gap report

Read-only survey, 18 September 2026. Nothing was changed, no migration was run, no production row
was written, nothing was created, sent, confirmed or cancelled in production, and no money moved.
Production access was `SELECT` only, under `SET default_transaction_read_only = on`.

Read against **rules v1.23** (§11.1, §10, §9, §12, §19, §21, §23, §24, §25, §28, §31), the
**locked mockups V1–V15** and their rules table, and the gap-check prompt. Order of authority:
rules → mockups → prompt. Where they disagree I have stopped and asked (§13).

---

## 1. Summary

| Area | Status | One-line gap |
|---|---|---|
| **The funding gate (§10)** | **P** | Both signatures are now checked on `GET /contracts/:id/production` and `POST …/initialise` (item 7 added it — the prompt's "no status at all" is out of date). **Money is checked nowhere.** Four other paths into the shoot check only party membership, and none of the twelve `/production-events/:id/*` routes checks even the signatures. |
| **The shoot table** | **E / C** | `production_events` exists, one row per contract, with visit address, contact, time, two-sided completion. **It carries the wrong mode for every set-first collaboration in production** — the set's Store Visit / Remote choice is never copied across, so all six signed set-first collaborations, including the one Store Visit, hold a `remote` shoot. |
| **The plan (branch, contact, time, notes)** | **P** | Columns exist for address, contact, time, minutes. Missing: branch id + address snapshot, free-text duration, ≤500-char notes, sent-at/by, agreed-at, auto-confirm stamps, delayed stamps. |
| **Address revealed at send** | **E (boundary) / M (feature)** | No endpoint leaks the street address before signing — the agreement snapshot omits it by construction. But nothing today copies `brand_branches.formatted_address` into a plan, and **none of the three practice brands has a street address on file.** |
| **Time-only negotiation via item 6's engine** | **M** | The engine has two anchors (invitation, pitch). A third costs a rewritten one-anchor CHECK, a context loader, a `{visitAt}` snapshot branch, and — first — a fix to the change-detector, which would reject every time-only counter as "nothing changed". No decline is a one-line `can` change. |
| **Rescheduling (same thread reopens)** | **M** | The engine has **no reopen**: `endThread` sets `outcome` and nothing ever clears it. Reopening is new engine behaviour, contained to the shoot anchor. |
| **A passed time** | **E (derivable)** | Derived from `visit_scheduled_at < now()` with nothing marked. No job needed. |
| **She marks, brand confirms, auto-confirm** | **P** | Migration 164's two timestamps are exactly this model and are live. Missing: the auto-confirm due date, the stamped admin number, the job, "confirmed itself" recorded. |
| **Delayed flag** | **M** | The word `delayed` appears nowhere in the backend. New columns, new job, new chip tone. Set-expiry is unaffected if it is a flag, not a status. |
| **Admin number** | **M** | `shoot_auto_confirm_days` does not exist. Adding it is a seed row + two map entries; the admin page is data-driven and needs no change. |
| **Notifications** | **P** | `production.*` keys exist inline (11 of them). None of the eight item 10 needs is named; the namespace should move to a `productionCopy.js` map like items 5–8. |
| **Needs You** | **P** | Step 3 exists in the shared step machine but is a stub: only `status = 'proposed'` counts as the brand's move; the creator's flat count has **no shoot item at all**. |
| **Mobile** | **M** | Every shoot screen was deleted on 10 September (profile-only apps). The API bindings, an address card with "Open in Maps", a slot card and a pure-JS time picker survive as orphaned code. Native time picker and maps are **in the shipped APK** — everything item 10 needs is OTA-safe. |
| **Admin website** | **P** | `/admin/production-queue` is an exception list; it does not show the 164 timestamps or the posting date. |
| **Tests** | **E** | Baseline recorded in §12. |

**Item 10 is buildable without a native rebuild, and mostly by extending what exists.** The two
things that must be done first, before any screen: the money half of the gate, and the mode
fix — otherwise the very first Store Visit collaboration opens a Remote shoot.

---

## 2. Requirement table

Status: **E** exists · **P** partial · **M** missing · **C** conflicts.

| ID | Requirement | Status | Evidence | Proposed change | Risk |
|---|---|---|---|---|---|
| D1a | One shoot plan per collaboration | **E** | `production_events.contract_id UUID UNIQUE NOT NULL` — `migrations/024_production_coordination.sql:26`; `contracts.campaign_influencer_id … UNIQUE` — `006:18` | Keep. The chain collaboration → contract → shoot is already 1:1:1. | — |
| D1b | Mode inherited from the agreement, never editable | **C** | Mode is resolved from `contracts.production_mode` → `collab_agreements.terms_json->>'mode'` → `'remote'` (`productionMode.model.js:52-62`). **`campaign_sets.shoot_mode` is never read.** `POST …/initialise` lets the brand pick a mode (`production.controller.js:127-135`); `flip-to-remote` changes it mid-shoot (`production.service.js:423-449`). | `autoCreateForContract` reads `campaign_sets.shoot_mode` first. Retire `/initialise`'s mode choice and `flip-to-remote`. | **High** — live defect, see §4.3 |
| D1c | Branch inherited from the set, address snapshotted at send | **M** | No `branch_id` on `production_events`; `visit_address/_city/_state/_pincode` are free text typed by the brand (`production.service.js:301-309`) | Add `branch_id` + fill `visit_address` etc. from `brand_branches` at send. The existing text columns **are** the snapshot. | Low |
| D1d | Contact person + number, revealed at send | **P** | `visit_contact_name`, `visit_contact_phone` exist (`024:39-40`); returned to either party by `GET …/production` after signatures (`production.controller.js:154-185`) | Return them only when `plan_sent_at IS NOT NULL` for the creator. Validate Indian mobile. | Low |
| D1e | Date and time, judged in India | **P** | `visit_scheduled_at TIMESTAMPTZ` (`024:37`); `getVisitDateRange` + `isWithinRange` compare on India days (`production.service.js:57-140`, `utils/indiaDay.js`) | Keep column. Replace the range's `posting_date - 1 day` buffer (`:32`) with the §11.1 rule: ≤ posting date, > now. | Low |
| D1f | Roughly how long — optional free text | **P** | `visit_window_minutes INT` (`024:38`) | Add `visit_duration_text`. Leave the INT for the old panel until it is retired. | Low |
| D1g | Anything to bring — optional, ≤500 | **M** | `shipment_notes` exists; no visit notes column | Add `visit_notes text` + CHECK `char_length ≤ 500`. | Low |
| D1h | Sent at / sent by | **M** | Nothing. `slot_proposed_by` (`039:21`) records the old slot dance, not a send. | Add `plan_sent_at`, `plan_sent_by`. | Low |
| D1i | Agreed at | **M** | Status flips to `confirmed` (`production.service.js:482-488`) with no timestamp | Add `time_agreed_at`. | Low |
| D1j | Attended at (hers) | **E** | `influencer_completed_at` — `164_shoot_two_sided_completion.sql:28`, written by `completeShoot` (`production.service.js:668-676`) | Keep; it means exactly "she marked it". | — |
| D1k | Confirmed at / by / automatic | **P** | `brand_completed_at` (`164:27`) and `visit_completed_at`; no actor, no auto flag | Add `brand_completed_by`, `auto_confirmed_at`. | Low |
| D1l | Auto-confirm due at, stamped from the admin number | **M** | — | Add `auto_confirm_due_at`, `auto_confirm_days` (stamped copy). | Low |
| D1m | State: not sent · sent · agreed · attended · complete; Delayed as a flag | **P** | `status` is JS-only vocabulary `proposed/confirmed/in_progress/completed/cancelled` (`production.service.js:27`, no CHECK — `024:28`) | **Derive** the item 10 stage from the timestamps (`plan_sent_at`, `time_agreed_at`, `influencer_completed_at`, `brand_completed_at/auto_confirmed_at`), the way item 4 derives set states. Keep writing `status` for the old readers. | Low |
| D2 | The funding gate on every path | **P** | Signatures: `assertBothSignatures` on 2 of 18 paths (`production.controller.js:77-87`, called `:125`, `:157`). Money: **nowhere.** | One function `shootGate(ciId)`; one guard `assertShootOpen(contractId)` on every path (§3). | **High** |
| D3a | Time never after the posting date | **P** | Range caps at `posting_date - 1 day` (`production.service.js:32`) using `contracts.posting_date`, not `campaign_sets.go_live_date` | Cap = `go_live_date` inclusive, in the range endpoint **and** on every write. | Low |
| D3b | Judged in India time | **E** | `indiaDay.js` `istDayOf`, `todayInIndia`, `startOfIndiaDay`, `endOfIndiaDay` (`:75-123`) | Use `endOfIndiaDay(go_live_date)` as the upper bound. | — |
| D3c | Minimum notice | — | — | **None.** A time in the past is refused; two hours ahead is allowed. | — |
| D4 | Time-only negotiation, item 6 engine, same round limit, no decline | **M** | Anchors: `negotiations_one_anchor CHECK ((ci IS NOT NULL) <> (pitch IS NOT NULL))` — `184_item8_pitch.sql:44-45`. Snapshot keyed on goal (`negotiation.service.js:143-172`). `canon` serialises only `{c,f,d,u}` (`:178-183`). Round limit stamped at `:322-325`. | Third anchor `production_event_id`; `loadShootContext`; `{visitAt}` branch in `termsOf/normalizeSnapshot/canon/termsLine/changesBetween`; `can.decline=false`. §6. | Medium |
| D5 | Reschedule reopens the same thread | **M** | `endThread` sets `outcome`, `ended_at`, `current_turn=NULL … WHERE outcome IS NULL` (`negotiation.service.js:276-279`). No code clears it. | `reopen(tx, negId, by)` for the shoot anchor only: `outcome=NULL, ended_at=NULL, status='awaiting_<other>', current_turn=<other>`; counters counted since the last `accept` turn. | Medium |
| D6 | A passed time | **E** | Derivable: `visit_scheduled_at < now() AND influencer_completed_at IS NULL AND status <> 'completed'` | No job. F1 returns `passed:true`; V13 renders. | — |
| D7a | Only she marks attended; not before the day | **P** | `parcel.MAY_COMPLETE.visit = ['brand','influencer']` (`parcel.service.js:35-39`); `completeShoot` has no date check (`production.service.js:641-697`) | New `POST …/shoot/attended` (creator only), allowed from `istDayOf(visit_scheduled_at)` onward. Stamps due date. | Low |
| D7b | Brand confirms, records who | **P** | `brand_completed_at` set by `completeShoot`; no `by` | New `POST …/shoot/confirm`; `brand_completed_by`. | Low |
| D7c | Auto-confirm job, stamped days | **M** | No key, no job (grep `shoot_auto_confirm`: 0 hits) | `shoot_auto_confirm_days` + `jobs/shoot-auto-confirm.job.js` at `:45` hourly. §9. | Low |
| D7d | Idempotent marks | **E (pattern)** | `completeShoot` early-returns if the side already marked (`production.service.js:658-659`); set-expiry uses `FOR UPDATE SKIP LOCKED` (`set-expiry.job.js:50-51`) | Same: `UPDATE … WHERE influencer_completed_at IS NULL` + `rowCount` check. | — |
| D7e | No money | **E** | No production route touches `escrow_entries`, `wallet_transactions` or balances (grep of `production.*`). Money moves only in `contractSign.service.js:115-198`, `deliverable.controller.js:412-441`, `tranche-3-release.job.js`, admin override. | Test proves balances + escrow identical before/after a whole shoot (§12). | — |
| D8 | Delayed flag, stage, both told once, nothing else moves | **M** | `delayed` — 0 hits in `backend/src`, `backend/migrations` | `campaign_influencers.delayed_at`, `delayed_stage`. Job at `:05` hourly. Not a status → set-expiry's `OPEN_STATUSES` (`campaignState.service.js:70`) untouched. §9. | Low |
| D9 | City only before send | **E** | Agreement snapshot selects `bb.name, rc.name` only (`agreementTerms.service.js:37-42, :56`); invitation rows `city_name` only (`invitationRows.service.js:263-278`); pitch brand card city names only (`brand.controller.js:1099-1122`) | Keep. New F1 must send address + contact **only** when `plan_sent_at` is set. | — |
| D10 | Legacy data | **C** | §4.3 and §5 last row | One data correction (mode) recommended; otherwise no backfill. | Medium |
| F10 | Admin number on the settings page | **M** | Page is data-driven (`admin/settings/platform/page.js:127-155`) | Seed + `DEFAULTS` + `DESCRIPTION` (`platformSettings.service.js:19-45`). | Low |

---

## 3. The gate — first and in full

### 3.1 What §10 and §11.1 require

Pay for Sale: both signatures. Pay for Content and Hybrid: both signatures **and** the funds
locked **and** the first 25% released. On every path, not one screen.

### 3.2 Every path into the shoot today, and what each checks

`production.routes.js` is mounted at `/` (`routes/index.js:181`). Party membership is
`ensureParty` (`production.controller.js:53-66`) — it checks the caller is the brand or the
creator on the contract, **nothing else**.

| # | Path | Route | Party | Signatures | Money |
|---|---|---|---|---|---|
| 1 | `GET /contracts/:id/production` (+ **auto-heal creates the row on a GET**) | `production.routes.js:29` | ✓ either | ✓ `assertBothSignatures` `:157` | ✗ |
| 2 | `POST /contracts/:id/production/initialise` | `:45` | ✓ brand | ✓ `:125` | ✗ |
| 3 | `GET /contracts/:id/production/date-range` | `:40` | ✓ either | ✗ (`:235-240`) | ✗ |
| 4 | `POST /contracts/:id/production/visit-details` | `:50` | ✓ brand | ✗ (`:192-200`) | ✗ |
| 5 | `POST /production-events/:id/propose-slot` | `:57` | ✓ creator | ✗ | ✗ |
| 6 | `POST /production-events/:id/accept` | `:58` | ✓ either | ✗ | ✗ |
| 7 | `POST /production-events/:id/counter-propose` | `:59` | ✓ either | ✗ | ✗ |
| 8 | `POST /production-events/:id/dispatch` | `:60` | ✓ brand | ✗ | ✗ |
| 9 | `POST /production-events/:id/confirm-received` | `:61` | ✓ creator | ✗ | ✗ |
| 10 | `POST /production-events/:id/complete` | `:62` | ✓ either | ✗ | ✗ |
| 11 | `POST /production-events/:id/flip-to-remote` | `:63` | ✓ either | ✗ | ✗ |
| 12 | `POST /production-events/:id/cancel` | `:64` | admin | ✗ | ✗ |
| 13–16 | `GET/POST/DELETE …/items`, `POST …/items/:itemId/drop` | `:69-88` | ✓ | ✗ | ✗ |
| 17 | `GET /brands/me/shoots` (list) | `brand.routes.js:49` | brand | ✗ (`pe.status <> 'cancelled'` only, `production.controller.js:641-642`) | ✗ |
| 18 | `GET /campaigns/:id/production` (roster) | `production.routes.js:35` | brand | ✗ (`ci.status IN (…,'live',…)` — `'live'` is not an enum value, `:582`) | ✗ |
| 19 | **Countersign creates the row** | `contractSign.service.js:178-183` | — | by construction (inside the sign transaction) | by construction — but see note |
| 20 | Admin exception queue | `admin.controller.js:1709` | admin | ✗ | ✗ |
| 21 | brand-web `ProductionPanel` | `dashboard/campaigns/[id]/influencers/page.js:968` | client | `contract.status === 'active'` — **the client, and the wrong test** (four seeded rows are `active` with no signatures) | ✗ |
| 22 | Mobile apps | — | — | **no screen exists** (deleted 10 Sep, commit `5e04e1c`) | — |

Paths 5–11 take a `production_events` id, so they can only be reached once a row exists — and a
row exists only via 1, 2 or 19, which are gated on signatures. That is why nothing has gone wrong
yet. It is **defence by accident**: the moment any route creates a row differently, every
transition is open.

Note on 19: `autoCreateForContract` runs at `:178`, **before** the escrow rows are created at
`:185-198`, inside one transaction. Atomic, so a failed lock rolls the row back — fine. But it
means the row is born at the same instant as the money, and nothing afterwards ever re-checks.

### 3.3 The signed test — as item 7 settled it

Canonical: `SIGNED_CONTRACT_SQL = con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NOT NULL`
— `services/collabState.js:56-59`, used in 11 files. The JS form is `assertBothSignatures`
(`production.controller.js:77-87`), which explicitly refuses to use `contracts.status`.

**Does anything still read `status = 'active'` as signed?** One place that matters:
`influencer.controller.js:1615` auto-heals deliverables when `contract.status === 'active'` —
the four seeded no-signature rows would get deliverables invented. Not item 10's, but noted.
`agreement.service.js:372` uses it belt-and-braces beside `brand_signed_at` — safe. The
brand-web panel (path 21) is the other. Everything else uses the signature test.

### 3.4 The funded test — what is actually recorded

At the brand's signature (`contractSign.service.js:86-214`), for Pay for Content / Hybrid:

1. `brands.wallet_balance -= totalToLock` (`:115-127`)
2. `wallet_transactions`: `escrow_lock` debit of the fee (`:129-133`); `platform_fee` debit of the campaign fee when > 0 (`:135-149`)
3. `contracts`: `status='active', brand_signed_at, locked_amount, campaign_fee_amount, money_at=now()` (`:152-167`) — `money_at` only when `lockAmount > 0` (`:159`)
4. Three `escrow_entries` rows, all `locked`, tranches 1/2/3 (`escrow.service.js:64-98`), unique on `(campaign_influencer_id, tranche_number)` (`183:21-22`)
5. Tranche 1 → `released`, `released_at`, creator wallet credited (`escrow.service.js:114-256`); `contracts.released_amount` (`:195-197`)

For Pay for Sale: `totalToLock = 0` → steps 1, 2, 4, 5 skipped; `money_at` stays NULL.

There is **no `contract_id` on `escrow_entries`** — every money query goes through
`campaign_influencer_id`. `terms_json.money` has **no `gate`** field; it is re-derived
(`contractSign.service.js:57`).

### 3.5 The single function

Put it beside `SIGNED_CONTRACT_SQL` so there is one definition:

```js
// services/collabState.js (or services/shootGate.service.js)
async function shootGate(ciId, conn = db) {
  const { rows: [r] } = await conn.query(`
    SELECT cs.goal, cs.shoot_mode,
           con.id AS contract_id, con.influencer_signed_at, con.brand_signed_at,
           con.locked_amount, con.released_amount, con.money_at,
           (SELECT count(*)::int FROM escrow_entries e WHERE e.campaign_influencer_id = ci.id) AS escrow_rows,
           (SELECT e.released_at FROM escrow_entries e
             WHERE e.campaign_influencer_id = ci.id AND e.tranche_number = 1 AND e.status = 'released') AS t1_released_at
    FROM campaign_influencers ci
    JOIN campaign_sets cs ON cs.id = ci.set_id
    LEFT JOIN contracts con ON con.campaign_influencer_id = ci.id
    WHERE ci.id = $1`, [ciId]);
  if (!r) return null;
  const signed = !!(r.influencer_signed_at && r.brand_signed_at);
  const needsMoney = r.goal !== 'conversion';                       // PfC and Hybrid
  const funded = !needsMoney
    || (r.money_at != null && Number(r.locked_amount) > 0 && r.escrow_rows === 3 && r.t1_released_at != null);
  return {
    open: signed && funded,
    reason: !signed ? 'NOT_SIGNED' : !funded ? 'NOT_FUNDED' : null,
    signed: { at: signed ? r.brand_signed_at : null },
    money: needsMoney
      ? { required: true, locked: Number(r.locked_amount || 0), released: Number(r.released_amount || 0), releasedAt: r.t1_released_at }
      : { required: false },
    goal: r.goal, shootMode: r.shoot_mode, contractId: r.contract_id,
  };
}
```

And one guard used by **every** route in §3.2 that survives (and the new ones in §8):

```js
async function assertShootOpen(contractId) {           // replaces assertBothSignatures
  const g = await shootGate(await ciIdOfContract(contractId));
  if (!g)          throw new AppError('NOT_FOUND', 'Not found', 404);
  if (!g.signed)   throw new AppError('NOT_SIGNED', "This collaboration isn't signed by both of you yet.", 422, 'status');
  if (!g.open)     throw new AppError('NOT_FUNDED', "The money for this collaboration isn't locked yet.", 422, 'status');
  return g;
}
```

**Where it must be called:** paths 1, 3, 4, 17 (as a filter), 18, 20 (as a column), every new
item 10 endpoint (F1–F8), the auto-confirm and Delayed jobs (skip rows whose gate is closed),
and `autoCreateForContract` itself (assert, so a future caller cannot create an ungated row).
Paths 2, 5–7, 11 are retired (§4.2); 8–10, 13–16 are item 11's and get the same guard then.

The gate card on V1 reads `signed.at`, `money.locked`, `money.released` from this object — real
numbers from `contracts.locked_amount` / `released_amount`, the same ones item 7's
`MoneyMoved7` shows today.

**A zero-fee Pay for Content or Hybrid** cannot be created through item 5 (fee required, > 0),
so `needsMoney && locked_amount = 0` can only be a legacy row. The function above **blocks** it,
which is what §10 says. None of the seven signed production rows is in that state. See §13 Q4.

---

## 4. What already exists, in detail

### 4.1 Tables

**`production_events`** (`024:24-64`, +`039:21-30`, +`164:26-28`). Every column, writer, reader:

| Column | Writer | Reader | Item 10 |
|---|---|---|---|
| `contract_id UNIQUE` | `autoCreateForContract` `production.service.js:215-228` | everything | **keep** |
| `mode` | same; `confirmRemoteFlip` `:435-441` | `collabCounts`, `pdf.service.js:118-145`, panel | **keep; fix the source** |
| `status` | every transition | `collabCounts.service.js:95-96, 275-276`, admin queue | **keep for old readers; derive item 10 stage** |
| `visit_address/_pincode/_city/_state` | `setVisitDetails` `:301-309`, `counterPropose` | `GET …/production`, PDF `pdf.service.js:131-138` | **keep = the address snapshot** |
| `visit_maps_url` | brand typed | panel | retire (derive from `brand_branches.lat/lng`) |
| `visit_scheduled_at` | `setVisitDetails`, `proposeSlot` `:376-382`, `counterPropose` | all | **keep** |
| `visit_window_minutes` | `setVisitDetails` | panel | leave; add `visit_duration_text` |
| `visit_contact_name/_phone` | `setVisitDetails` | `GET …/production`, PDF | **keep** |
| `visit_completed_at` | `completeShoot` `:687-696` | `collabCounts.service.js:95, 275` | keep (set alongside) |
| `shipment_*` (11 columns) | dispatch / receive | item 11 | untouched |
| `reschedule_count_brand/_influencer` | `setVisitDetails :327-334`, `proposeSlot`, `counterPropose :515` | admin queue | retire (rounds live on the thread) |
| `slot_proposed_by` | `setVisitDetails :321`, `proposeSlot` | `accept :474-479` | retire |
| `remote_flip_requested_by/_at` | `requestRemoteFlip` `:397-420` | panel | retire (§11 forbids changing mode) |
| `brand_completed_at`, `influencer_completed_at` | `completeShoot :668-676` | `influencer.controller.js:1598-1610` | **keep — this is D7** |
| `created_at`, `updated_at` | — | — | keep |

**`production_event_log`** (`024:67-81`) — action audit, written by `logAction`
(`production.service.js:719-750`), which also mirrors into `collab_events` at step 3. **Keep**;
item 10 writes `plan_sent`, `time_agreed`, `time_moved`, `attended`, `confirmed`,
`auto_confirmed`, `delayed`.

**`production_event_items`** (`161`) — parcel contents. Item 11. Untouched.

**Mode columns elsewhere:** `campaign_sets.shoot_mode` (`165:55`, CHECK `165:78-84`, branch
CHECK `180:26-30`) is the **canonical** one — written by set create/update (`campaign.controller.js:700-789, 814-841`),
locked once invited (`campaignState.service.js:186`). `contracts.production_mode` (`024:19`)
is the stale copy.

### 4.2 Code — keep / extend / retire

| Part | Verdict | Why |
|---|---|---|
| `autoCreateForContract` (`production.service.js:165-239`) | **Extend** | Read `campaign_sets.shoot_mode` first; stamp `branch_id`; call `assertShootOpen`. |
| `productionMode.model.js` | **Extend** | `resolveProductionMode({ setMode, contractMode, agreementMode })` — set wins. |
| `completeShoot` + `parcel.MAY_COMPLETE/isShootComplete` (`production.service.js:641-697`, `parcel.service.js:35-73`) | **Keep for Remote/shipment (item 11); replace for visit** | Visit gets two named endpoints (attended / confirm) with the day rule and the due-date stamp. |
| `getVisitDateRange` (`:57-140`) | **Replace** | Its basis chain and buffers predate `go_live_date`; item 10's cap is one rule. |
| `setVisitDetails`, `proposeSlot`, `accept`, `counterPropose` (`:280-553`) + routes 2, 4–7 | **Retire** | The built-in slot dance with a hard-coded 2-per-side cap is exactly what §11.1 says must be item 6's engine instead. |
| `requestRemoteFlip`, `confirmRemoteFlip` + route 11 | **Retire** | §11: mode cannot change inside the shoot plan. |
| `cancel` + route 12 | **Keep** | Admin only; not in the rules but harmless. |
| `logAction` | **Keep** | |
| `GET /contracts/:id/production` (path 1) | **Keep, behind the gate, shape extended** → F1 | It is the natural F1; the auto-heal becomes harmless once `autoCreateForContract` is gated. |
| `GET /brands/me/shoots` (17) | **Keep, filtered by the gate** | Needs-you-ordered list; item 10's list source. |
| `GET /campaigns/:id/production` (18) | **Keep, fix `'live'`** | |
| `production-shipment-reminder.job` | Untouched | Item 11. |
| Admin `/production/queue` | **Extend** | Add `brand_completed_at`, `influencer_completed_at`, `auto_confirm_due_at`, `go_live_date`, `delayed_at`. |
| brand-web `ProductionPanel` visit branch (`influencers/page.js:367-…`) and `initialise` picker (`:307-336`) | **Retire → read-only card** | Item 10 is phone-first (Docs/THE_PLAN); the panel's client-side `status==='active'` gate is wrong. |
| brand-web `ProductionSection.js` | Leave | Reads the pre-Phase-P `physical_delivery` flag; item 11 territory. |
| Mobile `components/shoot/ShootParts.js` (`AddressCard` with Open in Maps `:82-102`, `SlotCard :61`, `WindowCard :26`), `ShootDiary.js`, `utils/shoot.js`, `DateTimeChipPicker.js` | **Reuse after a token pass** | Orphaned since `5e04e1c`; styled on the old `ig`/`brandPalette` tokens. |
| Mobile `api.js:374-395, 552-565` production bindings | **Keep; add the new paths** | |
| Contracts `features/stage-4-the-shoot`, `shoot-starts-where-the-agreement-left-it`, `shoot-plan-you-can-actually-see` (approved, never released), `post-agreement-shoot-and-content` (unapproved) | **Supersede** | New `features/item10-store-visit/`; note the four as superseded in its spec. |

### 4.3 The live defect: every set-first shoot is Remote

`autoCreateForContract` resolves the mode from `contracts.production_mode` (written only by the
old Approve & Send step and `/initialise`) then `collab_agreements.terms_json->>'mode'` (the brief
path, which item 8 closed — `invitationSend.service.js:128-130` refuses `agreement_id`), then
defaults to `'remote'` (`productionMode.model.js:52-62`). **`campaign_sets.shoot_mode` is not
in the chain.**

Production, read-only, 18 September:

| Contract | Set mode | Contract mode | Shoot row mode / status | Brand | Posts |
|---|---|---|---|---|---|
| `924b758f…` | **visit** (branch: Main Branch) | null | **remote / confirmed** | Kanchi Silks (practice) | 26 Sep |
| `d3fc0d4f…`, `9f8d3b99…`, `97781a7e…`, `151f1b59…`, `938a60f8…` | shipment | null | **remote / confirmed** ×5 | Kanchi Silks (practice) | 23 / 30 Sep |
| `f716428c…` | null (pre-set-first) | visit | visit / proposed | Label Fern (practice) | none |

Six of seven signed collaborations carry the wrong shoot. The one Store Visit collaboration in
existence would open V1 and be told it is Remote. This is Phase 2a work alongside the gate, and
it needs a one-time data correction (§13 Q2).

Two adjacent findings from the same read, not item 10's to fix but recorded: `addParcelItems`
passes `undefined` as `brandId` because `getContractParties` never selects `b.id`
(`production.controller.js:696` vs `:30-49`) — item 11's parcel endpoint cannot work today;
and `DangerButton` drops its `busy` prop (`primitives.js:144`), so four confirm sheets can be
double-tapped mid-request.

---

## 5. Link readiness (§3), row by row

| Link | Ready? | What is missing / what item 10 consumes |
|---|---|---|
| **Item 7: the signatures** | **Ready** | `SIGNED_CONTRACT_SQL` (`collabState.js:59`); `assertBothSignatures` (`production.controller.js:77-87`). Consume both. One stray `status === 'active'` read at `influencer.controller.js:1615` (deliverable heal) — outside item 10. |
| **Item 9: the money** | **Ready** | §3.4. Consume `contracts.locked_amount/released_amount/money_at` and escrow T1. `terms_json.money` has no `gate`; derive. |
| **§10's missing gate** | **Not ready** | §3.2. Signatures on 2 of 18 paths; money on none. |
| **Item 4: the branch** | **Ready, with a data hole** | `brand_branches` (`172:30-49`): `name, google_place_id, formatted_address, pincode, lat, lng, city_id, state_id, is_main`. No street/phone columns — the address is one Google-formatted string. `campaign_sets.branch_id` (`180:18`) `ON DELETE RESTRICT`, locked after first invitation, required when `shoot_mode='visit'` (CHECK `180:26-30`). Privacy holds: agreement snapshot selects `bb.name, rc.name` only (`agreementTerms.service.js:56`). **But: 10 branches in production, 4 without any address — including all three practice brands.** |
| **Item 4: the posting date** | **Ready** | `campaign_sets.go_live_date DATE` (`165:53`). `cutoffFor` (`campaignState.service.js:34`) = go-live − 3 calendar days; `earliestGoLiveDay` (`setShape.model.js:152-156`) = today + 7. `indiaDay.js`: `calendarDay` for DATE columns (`:55`), `istDayOf` for instants (`:75`), `todayInIndia` (`:83` — note: not `todayIST`), `startOfIndiaDay/endOfIndiaDay` (`:116-123`). Item 10's cap: `visit_scheduled_at <= endOfIndiaDay(go_live_date)`. |
| **Item 6/8: the negotiation engine** | **Not ready — see §6** | Two anchors, XOR CHECK, goal-keyed snapshot, `canon` blind to any new term, no reopen, no reminders for non-invitation anchors. |
| **Item 9: the admin settings** | **Ready** | `platform_settings` (`182:94-104`, `value int`, CHECK in range) + `platform_settings_audit` (`182:111-119`). Service cache 60 s per process, busted on write (`platformSettings.service.js:49-70, :101`). Controller projects through `KEYS` (`negotiations.controller.js:148`) so a seeded row **must** also be in `DEFAULTS`. Admin page fully data-driven (`admin/settings/platform/page.js:127-155`). Adding `shoot_auto_confirm_days`: seed row + `DEFAULTS` + `DESCRIPTION`. Stamp it on the row; never read it live (house rule `platformSettings.service.js:10-12`). |
| **Item 12: what comes next** | **Ready to write, nothing to build** | Today "shoot done" = `pe.status='completed' OR visit_completed_at IS NOT NULL` (`collabCounts.service.js:95, 275`) and only moves the derived step number (`collabStep.service.js:145-148`). **Deliverable submission is not gated on the shoot anywhere** (`deliverable.controller.js` has zero production references; deliverables are created at countersign). Item 10 writes `status='completed'`, `visit_completed_at`, `brand_completed_at` or `auto_confirmed_at`. Item 12 reads them. |
| **Item 11: Remote** | **Shares almost everything** — §11 | |
| **§24: Needs You** | **Partly ready** | Shared step machine step 3 is a stub: `x.shootTurn || NOBODY` (`collabStep.service.js:145-148`), fed by `shoot_status === 'proposed' ? brand : nobody` (`collabCounts.service.js:146, 309`). Creator's flat count has **no shoot item** (`:208-250`). Four edits, §8 F1 notes. |
| **Notifications** | **Partly ready** | `notificationService.send({userId,type,title,body,data})` (`notification.service.js:26`) — in-app row + OneSignal (FCM fallback). Existing `production.*` keys inline in `production.controller.js:223-748`. Convention to follow: a `NOTIFY` map per item (`agreementCopy.js:119-131`) + a per-item `notify(ctx, side, key, body)` wrapper (`agreement.service.js:523-534`). |
| **Admin website** | **Partly ready** | `/admin/production-queue` (`admin.controller.js:1709-1760`): exception list (>3 d proposed, >14 d in progress, ≥2 reschedules). No 164 timestamps, no posting date. `/admin/escrow` shows per-tranche money. |
| **Existing production data** | see table | 7 signed contracts (all `active`), 4 seeded `active` with no signatures, 1 `pending_brand`. By set mode: 5 shipment, 1 visit, 1 pre-set-first. 11 `production_events`: 6 remote/confirmed (all wrong, §4.3), 1 shipment/confirmed and 3 visit/completed **without a signed contract** (seed rows of 21 Aug), 1 visit/proposed (legacy Label Fern). Posting date already passed: 1 (the legacy one, `contracts.posting_date`). `negotiations`: 2 rows, 0 open. `platform_settings`: 8 keys, none for shoots. |

---

## 6. The third anchor — what item 8 left, and what a shoot-plan subject touches

### 6.1 How item 8 generalised the anchor

Migration `184_item8_pitch.sql:27-45`: `campaign_influencer_id` made nullable; `pitch_id`
added; the table UNIQUE replaced by two partial unique indexes; and
`CHECK ((campaign_influencer_id IS NOT NULL) <> (pitch_id IS NOT NULL))`. In the engine the
anchor is **not a switch** — the caller picks the loader (`loadContext` `:49` or
`loadPitchContext` `:90`), the pitch loader tags `kind:'pitch'` (`:118`), and fourteen
`isPitch(ctx)` branches do the rest (`:238, :260, :300-301, :325, :331, :352, :391, :425, :460, :587, :594, :600-601, :603-604`).

### 6.2 What a `production_event_id` anchor touches

| # | Where | Change |
|---|---|---|
| 1 | Migration 187 | `ADD COLUMN production_event_id uuid REFERENCES production_events(id) ON DELETE CASCADE`; `CREATE UNIQUE INDEX uq_neg_shoot ON negotiations (production_event_id) WHERE production_event_id IS NOT NULL`; **rewrite** `negotiations_one_anchor` as `CHECK (num_nonnulls(campaign_influencer_id, pitch_id, production_event_id) = 1)` — the XOR form is two-operand only. |
| 2 | `negotiation.service.js:90` | `loadShootContext(eventId, scope)` → `kind:'shoot'`, plus `visit_at`, `go_live_date`, `brand_user_id`, `creator_user_id`, names; everything invitation-shaped null. |
| 3 | `:138` | `isPitch` → an `anchorOf(ctx)` returning `'invitation'|'pitch'|'shoot'`; audit all 14 sites. |
| 4 | `:143 termsOf`, `:162 normalizeSnapshot` | New `subject` switch: shoot → `{ visitAt }` validated as ISO instant, `> now`, `<= endOfIndiaDay(go_live_date)`. |
| 5 | **`:178 canon`** | **Load-bearing.** Add `v: visitAt`. Without it two snapshots differing only in time canonicalise equal and `:315` throws `NOTHING_CHANGED` on every counter. |
| 6 | `:187 termsLine`, `:195 changesBetween` | One line: `"18 Oct, 11:00 am → 19 Oct, 4:00 pm"`, term key `visitAt`. |
| 7 | `:226 cutoffOf / closedByCutoff` | Shoot threads are not closed by the invite cutoff; close by `go_live_date` instead. |
| 8 | `:235 assertOpenInvitation` | Third vocabulary: open while shoot not complete. |
| 9 | `:254-264 notify` | Deep link `screen:'shoot'`, `campaign_influencer_id`. |
| 10 | `:322-326` INSERT | Three-way anchor column. Turn zero = the plan as sent (like a pitch: stored as a counter, excluded from `counters_used` via `GREATEST(count-1,0)`, `:101-107`). |
| 11 | `:352, :391, :460` write-backs | Shoot: counter → nothing on the event (the thread is the record); accept → `visit_scheduled_at = agreed`, `time_agreed_at = now()`; decline → **route not offered** (`can.decline=false`, endpoint 422 `NO_DECLINE`). |
| 12 | `:300-301` who may open | Either side (she counters the plan; the brand moves an agreed time). |
| 13 | `:565-634 thread()` | `can.decline=false`, `can.moveRequest/moveAnswer=false`; return anchor id as `shootId` beside the misnamed `invitationId` (`:610`). |
| 14 | `:644 endingOf` | Shoot wording. |
| 15 | `:661 endForExpiredSet`, `:673 sendReminders` | Leave; reminders for shoot threads ride the Needs You count (pitch threads get none either — pre-existing gap). |
| 16 | **New `reopen(tx, negId, by)`** | Shoot only: `UPDATE negotiations SET outcome=NULL, ended_at=NULL, ended_by=NULL, status='awaiting_<other>', current_turn=<other>, turn_changed_at=now() WHERE id=$1 AND production_event_id IS NOT NULL`. `counters_used` for shoot = counters **after the last `accept` turn**, so each episode gets the stamped round budget (§13 Q7). |
| 17 | Mobile `copy6.js:44-54` | `TERM_LABEL.visitAt='Time'`, `termValue`, `snapshotLine6`, `NEGOTIABLE.shoot=['visitAt']`; `PitchCounterScreen.js:100-103`'s client-side no-change guard uses `snapshotLine6` and would otherwise refuse too. `TurnCard6`, `RoundPill6`, `StateBox6`, `EndingCard6` need nothing. |

Controllers follow `pitch.controller.js:79-86` (`ctxFor`) and `item8.routes.js:28-43`.

**Cost:** one migration, ~120 lines in the engine spread over 17 sites, one new controller, one
new routes file, ~40 lines of mobile copy. Medium. The alternative — a shoot-local time dance
like the retired `slot_proposed_by` one — is what the rules explicitly forbid.

---

## 7. Proposed migrations (additive)

**Next free number: 187** (`186_item9_fee_override_and_t3_wait.sql` is the highest; test harness applied 184 — see §12 note).

`187_item10_store_visit.sql`:

```sql
BEGIN;
-- 1. The plan
ALTER TABLE production_events
  ADD COLUMN IF NOT EXISTS branch_id            uuid REFERENCES brand_branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visit_branch_name    text,
  ADD COLUMN IF NOT EXISTS visit_lat            numeric(10,6),
  ADD COLUMN IF NOT EXISTS visit_lng            numeric(10,6),
  ADD COLUMN IF NOT EXISTS visit_duration_text  text,
  ADD COLUMN IF NOT EXISTS visit_notes          text,
  ADD COLUMN IF NOT EXISTS plan_sent_at         timestamptz,
  ADD COLUMN IF NOT EXISTS plan_sent_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS time_agreed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS brand_completed_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_confirm_days    int,
  ADD COLUMN IF NOT EXISTS auto_confirm_due_at  timestamptz,
  ADD COLUMN IF NOT EXISTS auto_confirmed_at    timestamptz;
ALTER TABLE production_events DROP CONSTRAINT IF EXISTS pe_visit_notes_len;
ALTER TABLE production_events ADD CONSTRAINT pe_visit_notes_len
  CHECK (visit_notes IS NULL OR char_length(visit_notes) <= 500) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_pe_auto_confirm_due
  ON production_events (auto_confirm_due_at) WHERE auto_confirm_due_at IS NOT NULL AND status <> 'completed';

-- 2. Delayed — on the collaboration, because §25 moves collaborations, and item 12 will set it too
ALTER TABLE campaign_influencers
  ADD COLUMN IF NOT EXISTS delayed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS delayed_stage text;
ALTER TABLE campaign_influencers DROP CONSTRAINT IF EXISTS ci_delayed_stage_known;
ALTER TABLE campaign_influencers ADD CONSTRAINT ci_delayed_stage_known
  CHECK (delayed_stage IS NULL OR delayed_stage IN ('plan_not_sent','time_not_agreed','not_attended','not_confirmed','content_not_live'));
CREATE INDEX IF NOT EXISTS idx_ci_delayed ON campaign_influencers (set_id) WHERE delayed_at IS NOT NULL;

-- 3. The third anchor
ALTER TABLE negotiations
  ADD COLUMN IF NOT EXISTS production_event_id uuid REFERENCES production_events(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_neg_shoot
  ON negotiations (production_event_id) WHERE production_event_id IS NOT NULL;
ALTER TABLE negotiations DROP CONSTRAINT IF EXISTS negotiations_one_anchor;
ALTER TABLE negotiations ADD CONSTRAINT negotiations_one_anchor
  CHECK (num_nonnulls(campaign_influencer_id, pitch_id, production_event_id) = 1);

-- 4. The admin number
INSERT INTO platform_settings (key, value, min_value, max_value, unit, label)
VALUES ('shoot_auto_confirm_days', 3, 1, 30, 'days', 'Store visit auto-confirm')
ON CONFLICT (key) DO NOTHING;
COMMIT;
```

Dry-run prints (runner `scripts/run-187.js --dry|--apply`): `production_events` count (11),
rows by mode/status, `negotiations` count (2) and that all satisfy the new CHECK,
`campaign_influencers` count, `platform_settings` before/after (8 → 9), and the six rows §4.3
would correct **if** Q2 is approved — as a separate `--fix-modes` flag, never silently.

Indexes for the lists: `idx_production_events_status (status, mode)` exists (`024:63`);
brand list joins on `contract_id UNIQUE`; creator list via `campaign_influencers.influencer_id`
(`idx_ci_influencer`). The two job lanes: `idx_pe_auto_confirm_due` above; Delayed scans
`campaign_sets.go_live_date < today` joined to signed contracts — small, but add
`idx_cs_go_live ON campaign_sets (go_live_date)` if absent.

---

## 8. Proposed endpoints

Paths follow item 7 (`item7.routes.js`): brand under the set, creator under her invitation.
Envelope as everywhere. All behind `assertShootOpen`; wrong party → 404; Remote → 422
`WRONG_MODE` "This is a Remote collaboration. Products are shipped to {name}."

| ID | Method + path | Exists? | Body → Response | Errors |
|---|---|---|---|---|
| **F1** | `GET /campaigns/:id/sets/:sid/invitations/:ciId/shoot` (brand) · `GET /influencers/me/invitations/:ciId/shoot` (creator) | **extend path 1** | → `{ gate:{open,reason,signed:{at},money:{required,locked,released}}, aim, mode, postingDate, daysToPosting, stage:'not_sent'|'sent'|'agreed'|'attended'|'complete', passed, plan:{ branch:{name,city,address*,lat*,lng*}, contact*:{name,phone}, visitAt, durationText, notes, sentAt, agreedAt, attendedAt, confirmedAt, confirmedBy, autoConfirmedAt, autoConfirmDueAt }, thread:<item 6 payload>|null, delayed:{at,stage}|null, can:{plan,send,accept,counter,move,markAttended,confirm}, steps:[{key,label,state,detail}] }`. `*` creator sees these **only when `plan.sentAt` is set**. | `NOT_SIGNED`, `NOT_FUNDED`, `WRONG_MODE` |
| **F2+F3** | `POST …/shoot/plan` (brand) | **new** (replaces path 4) | `{ contactName, contactPhone, visitAt, durationText?, notes? }` → F1 payload. Validates gate, mode, branch has an address, `visitAt > now`, `visitAt <= endOfIndiaDay(go_live_date)`; snapshots branch name/address/lat/lng; stamps `plan_sent_at/by`; notifies her. **One call — no server draft** (§13 Q5). | `PLAN_ALREADY_SENT` "A plan is already with {name}.", `BRANCH_NO_ADDRESS`, `TIME_AFTER_POSTING` "The visit has to be before {date}, the day she posts.", `TIME_IN_PAST`, `VALIDATION_ERROR` per field |
| **F4** | `POST …/shoot/accept` (creator) | **new** | → F1. No thread: stamps `time_agreed_at`, `status='confirmed'`. Thread open: engine `accept`. | `TIME_ALREADY_AGREED`, `WRONG_TURN` |
| **F5** | `GET …/shoot/thread` · `POST …/shoot/thread/counter` · `POST …/shoot/thread/accept` (both sides) | **new**, item 8's controller shape | `{ visitAt, note? }` → thread. Turn zero = the plan. **No decline route.** | `NO_ROUNDS_LEFT` "There are no counters left. You can accept this time or ask to move it.", `WRONG_TURN`, `NOTHING_CHANGED`, `TIME_ALREADY_AGREED` "The time is already agreed. Ask to move it instead." |
| **F6** | `POST …/shoot/move` (both sides) | **new** | `{ visitAt, note? }` → thread. Allowed while `influencer_completed_at IS NULL`. Reopens the thread (§6 #16) or creates it with the agreed time as turn zero; clears `time_agreed_at`; `status='proposed'`. Brand's V10 "She didn't come" = this call after her mark (§13 Q3). | `TIME_AFTER_POSTING`, `TIME_IN_PAST`, `PLAN_LOCKED` "Send a new time instead of changing this one." (any attempt to edit contact/notes after send) |
| **F7** | `POST …/shoot/attended` (creator) | **new** (replaces path 10 for visit) | → F1. Requires `time_agreed_at` and `todayInIndia() >= istDayOf(visit_scheduled_at)`; stamps `influencer_completed_at`, `auto_confirm_days` (from settings, once), `auto_confirm_due_at = now() + days`; notifies brand. `UPDATE … WHERE influencer_completed_at IS NULL` → second call 422. | `TIME_NOT_AGREED` "The time hasn't been agreed yet.", `TOO_EARLY`, `ALREADY_MARKED` "This is already marked." |
| **F8** | `POST …/shoot/confirm` (brand) | **new** | → F1. Requires `influencer_completed_at`; stamps `brand_completed_at/_by`, `visit_completed_at`, `status='completed'`; notifies her. | `NOT_MARKED_YET` "{Name} hasn't said she visited yet.", `ALREADY_MARKED` |
| **F9** | jobs | **new** | §9 | |
| **F10** | `PATCH /admin/platform-settings` | **exists** (`item6.routes.js:38`) | key `shoot_auto_confirm_days` | range 422 |
| — | `GET /brands/me/shoots` | **extend** | filter `gate.open`, add `stage`, `visitAt`, `delayed` | |

**Needs You** (four moves) — all in existing files, both sides from one rule:
`collabStep.service.js:145-148` widens step 3 to `stage` → turn: `not_sent` → brand;
`sent` with thread turn → that side, no thread → creator; `agreed` → nobody (or creator on/after
the day); `attended` → brand; `collabCounts.service.js:95-96, 275-276` add
`plan_sent_at, time_agreed_at, brand_completed_at, influencer_completed_at, visit_scheduled_at,
n.current_turn`; `:146, :309` pass them; `forCreator` `:208-250` gains `shoot_to_answer`.

**Notifications** — `productionCopy.js` `NOTIFY`: `shoot.plan_sent`, `shoot.time_countered`,
`shoot.time_agreed`, `shoot.time_moved`, `shoot.attended`, `shoot.confirmed`,
`shoot.auto_confirmed`, `collab.delayed`. Wrapper as `agreement.service.js:523-534`, deep link
`screen:'shoot'`.

---

## 9. The two job lanes

**Lane map** (`jobs/index.js:54-120`, IST): `:00` T3 release · `:13/:43` post-eligibility ·
`:20` handshake + settlement retry · `:25` social · `:35` pitch · `:40` set-expiry · `:50`
negotiation housekeeping. Free: `:05`, `:10`, `:45`, `:55`.

### 9.1 `shoot-auto-confirm.job.js` — hourly at `:45`

```sql
SELECT pe.id FROM production_events pe
WHERE pe.mode = 'visit' AND pe.status <> 'completed'
  AND pe.influencer_completed_at IS NOT NULL AND pe.brand_completed_at IS NULL
  AND pe.auto_confirmed_at IS NULL AND pe.auto_confirm_due_at <= now()
FOR UPDATE SKIP LOCKED
```
Per row, one transaction: `assertShootOpen` (skip if closed), `UPDATE … SET auto_confirmed_at=now(),
visit_completed_at=COALESCE(visit_completed_at, now()), status='completed' WHERE id=$1 AND
auto_confirmed_at IS NULL AND brand_completed_at IS NULL`; `rowCount=0` → skip; log
`auto_confirmed`; notify both after commit. **Idempotent** because the selection requires
`auto_confirmed_at IS NULL` and the update sets it, and the CAS refuses a row the brand confirmed
in between. Reads `auto_confirm_due_at` (stamped at F7) — **never** the live setting, so check
12.1 #19 holds by construction. Counts: `{checked, confirmed, skippedGate, failed}`. Modelled on
`set-expiry.job.js:32-95`, not on T3 (no money).

### 9.2 `collab-delayed.job.js` — hourly at `:05`

```sql
SELECT ci.id, pe.* FROM campaign_influencers ci
JOIN campaign_sets cs ON cs.id = ci.set_id
JOIN contracts con ON con.campaign_influencer_id = ci.id
LEFT JOIN production_events pe ON pe.contract_id = con.id
WHERE ci.delayed_at IS NULL AND cs.go_live_date < $today
  AND con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NOT NULL
  AND (pe.id IS NULL OR pe.status <> 'completed')
FOR UPDATE OF ci SKIP LOCKED
```
Stage from the timestamps (`plan_not_sent` / `time_not_agreed` / `not_attended` /
`not_confirmed`); `UPDATE campaign_influencers SET delayed_at=now(), delayed_stage=$2 WHERE
id=$1 AND delayed_at IS NULL`; log; notify both once. **Nothing else**: status stays
`contracted`, the row stays in its set, no invitation, contract, escrow or wallet row is touched.
`$today = todayInIndia()`, so "the day after the posting date" is judged in India.

**Set-expiry unaffected**: it keeps any set with a signed member (`set-expiry.job.js:53-56`),
flips only `OPEN_STATUSES` (`campaignState.service.js:70` = invited/applied/accepted/negotiating),
and item 10 never changes `status`. `familyOf('contracted')` stays `ACTIVE` (`collabState.js:23-41`);
the Delayed chip is layered on by the app when `delayed_at` is set. Item 4's counts are untouched
because they group by status.

---

## 10. Frontend plan

**Both apps: no native change.** Verified against the shipped APKs (2026-08-04), not docs:
`@react-native-community/datetimepicker` **is** compiled in (`RNDateTimePicker` in the DEX);
`react-native-maps` is in too (80 `com/rnmaps/maps/` hits — the `utils/maps.js:5-15` comment
saying otherwise is stale; `isMapsAvailable()` probes at runtime and is correct); `Linking.openURL`
for `https://www.google.com/maps/...` and `tel:` is core RN and already used in 14 places
(`BrandActionRow.js:138-158`, `ShootParts.js:85`, `BrandBranchesScreen.js:72`). No file-viewing
module exists (confirmed absent: pdf, file-viewer, document-picker) — not needed here.
`NATIVE_RUNTIME` stays `'3'` (`otaUpdater.js:28`).

**Time picker choice:** the native picker is OTA-safe, but `features/stage-4-the-shoot` added a
guard test that fails if a shoot file imports it (`06-diff/notes.md:186-191`), and the pure-JS
`DateTimeChipPicker.js` (date strip + hour/minute chips, orphaned) already exists. **Recommend
the JS picker** restyled to `settingsTokens`, `maxDate = go_live_date` (§13 Q8).

**Reused from items 2–9:** `Card7`, `StateBox7`, `MoneyRow7`, `ShortfallCard7`-shape (`agreement/bits7.js`);
`TurnCard6`, `RoundPill6`, `StateBox6`, `ChangeLine6`, `EndingCard6` (`negotiation/bits6.js`);
`InvitationCard5`, `Chip5`, `KV5` (`invitations/bits5.js`); `TextField4` (`campaigns/bits4.js`);
`Sheet`, `ConfirmSheet` (`settings/sheets.js`); `PrimaryButton`, `SecondaryButton`, `EmptyState`
(`settings/primitives.js`); `Skeleton`, `LoadError`, `useToast` (`settings/feedback.js`);
`LoadErrorList` (`DiscoverList.js`); `AddressCard` with Open in Maps + call (`shoot/ShootParts.js:82-102`, token pass).
Sheets that a server can refuse render the refusal **inside** the sheet (`sheets7.js:123-131` — the 17 Sep toast-behind-modal lesson).

**New:** `GateCard10` (ticks/hourglass, green/blue), `StepLine10` (four steps: filled green ·
amber ring · empty ring), `TimeCard10` (solid ink when live; grey when past/historic, with
"Today"/"Passed"/"Visited"), `TimePicker10` (wrapper around `DateTimeChipPicker`), a **Delayed**
tone — the eighth entry in `tokens.js:515-523` (amber family, yourMove colours, label "Delayed").
Files: `components/shoot/{bits10,copy10,sheets10}.js`.

| Screen | App | Where it attaches | Notes |
|---|---|---|---|
| V1 | Brand | `BrandAgreementScreen.js:226-235` after both-signed: gate card between `MoneyMoved7` (`:228`) and the "Next" card (`:229`); step line replaces the "Next" sentence; button `:234` currently toasts "Shoot plan opens in item 10." → navigates to `BrandShoot`. Label `copy7.js:117` → "Plan the visit". | F1 |
| V2/V3 | Brand | new `BrandShootPlanScreen` in `CampaignsStack` (`BrandNavigator.js:81-95`) | locked card from set; two required fields; picker; `ConfirmSheet` lists address, number, time → F2+F3 |
| V7 | Brand | `BrandShootThreadScreen` = `PitchThreadScreen` pattern with `side="brand"`, no decline button, hint text | F5 |
| V10/V11/V13/V14 | Brand | `BrandShootScreen` (F1-driven; one screen, stage switch) | V10 quiet alternative = F6 |
| V12 | Brand+Creator | `MoveTimeSheet10` | F6 |
| V4 | Creator | `InvitationCard5` signed branch (`bits5.js:167-182`) — add the second line from `card.shoot.line`; the `active` tab query (`influencer.controller` invitations) emits it | F1-lite on the list |
| V5/V8/V9/V15 | Creator | new `ShootScreen` in `CollabsStack` (`InfluencerNavigator.js:53-70`); `AgreementScreen.js:181-185` gains a "Store visit" button after both-signed | F1, F4, F7 |
| V6 | Creator | `ShootCounterScreen` = `PitchCounterScreen` with one field | F5 |
| Loading / empty / error | both | `Skeleton`, `EmptyState`, `LoadError` as items 2–9 | |

Look and feel per §8 of the prompt; tokens all exist (`tokens.js:509-524`); Plus Jakarta Sans is
bundled (`assets/fonts/`, `tokens.js:457-476`).

**brand-web:** retire the visit branch of `ProductionPanel` and the `initialise` picker; leave a
read-only "Shoot plan is managed in the app" card. Admin: extend `/admin/production-queue`
projection; `shoot_auto_confirm_days` appears on `/admin/settings/platform` automatically.

---

## 11. What item 11 (Remote) will share

Same table (`production_events`, one row per contract), same gate (`shootGate` — Pay for Sale
by signatures, others funded), same mode source (`campaign_sets.shoot_mode`, fixed in 2a), same
completion columns (`influencer_completed_at` — for Remote it is sufficient alone, as
`parcel.isShootComplete` already says, `parcel.service.js:67-73`), same `status='completed'`
that item 12 reads, same Delayed flag and job (stage vocabulary extended with
`address_not_given`, `not_dispatched`, `not_received`), same notification namespace, same
Needs You step 3 rule, same F1 shape (`plan` becomes `shipment`), same list endpoint. Item 11
keeps the shipment columns, `production_event_items`, routes 8–10 and 13–16 (behind the gate),
and `production-shipment-reminder.job`. Item 11 must fix `addParcelItems`' undefined `brandId`
(§4.3). What it does **not** share: the time negotiation and auto-confirm (§11.2 has no time to
agree and the creator alone marks it).

---

## 12. Test baseline and the tests to add

**Baseline** (`npx jest --runInBand` against `inflx_test` on port 5544, 18 Sep, before any
change): see the figures block at the end of this section — filled in from the run that was in
progress while this report was written. The harness reported `migrations applied: 184/184`; the
two newest migrations (185, 186) are applied by the helper's reseed path — confirmed last
session when `brand.test.js` moved to `platform_fee_pct = null`.

Existing tests touching this ground: `item7-agreement.test.js` (49 — signing, lock, T1,
still-locked), `item8-pitch.test.js` (49 — the engine on a second anchor, turn zero, rounds),
`item6-negotiation*.test.js`, `earnings.test.js` (escrow flow, several pre-existing failures),
`admin-escrow.test.js`, `production*.test.js` if present (to be listed with the figures), the
jobs tests for `set-expiry` and `tranche-3-release`.

**New: `item10-storevisit.test.js`**, one assertion per final check 1–30 of the prompt, plus:

- Gate: signed-unfunded PfC refused on **every** surviving path (loop over the route table);
  Pay for Sale opens on signatures; unsigned refused everywhere; gate card numbers equal
  `contracts.locked_amount`/`released_amount`.
- Mode: a `visit` set produces a `visit` shoot at countersign (regression for §4.3).
- Plan: branch/mode not editable via API; address absent from creator F1 before send, present
  after; second send refused; edit after send refused.
- Time: after posting date refused (boundary: 23:59 IST on the posting day allowed, 00:00 next
  day refused); past refused; picker max = posting date.
- Thread: turn zero excluded from rounds; limit = stamped `negotiation_rounds`; no decline route
  (404) and `can.decline=false`; identical `NO_ROUNDS_LEFT` behaviour to an invitation and a pitch.
- Reschedule: same `negotiations.id` before and after; `outcome` cleared; rounds reset per
  episode; capped by posting date.
- Passed: nothing changes; F1 `passed:true`; brand can move.
- Attended/confirm: due date = `now + stamped days`; changing the setting afterwards moves nothing
  already stamped and applies to the next; two devices → exactly one mark (parallel requests);
  job confirms at due date, records `auto_confirmed_at`, notifies both once; job re-run is a no-op.
- **Money: snapshot `escrow_entries`, `wallet_transactions`, `brands.wallet_balance`,
  `influencers.wallet_balance/pending_balance` before the plan and after auto-confirm — byte-equal.**
- Delayed: flagged the day after posting with the right stage; both told once; still plannable,
  agreeable, attendable, confirmable; set-expiry counts and `expired_at` unchanged; item 4 set
  counts unchanged.
- Privacy: another brand / another creator → 404 on every route; Remote → 422 `WRONG_MODE`.
- Needs You: four moves land on the right side; `forBrand` and `stepsForCreator` agree.
- `governance-check`, `compare.js before after` — no new failures.

### Figures

`npx jest --runInBand`, 18 September 2026, no code changed:

| | |
|---|---|
| Suites | 118 (45 failing) |
| Tests | **1330 — 1109 passed, 221 failed, 0 skipped** |
| Against item 9's post-deploy run (`after-item9.json`: 1324 tests, 222 failed) | **0 new failures**, 1 fixed, 6 new tests all passing, 0 gone |
| Saved as | session scratchpad `baseline_item10.json` — `compare.js baseline_item10.json <after.json>` is the no-regression proof for Phase 4 |

The 221 failures are the known pre-existing debt (food/meals, referrals, follower store, pricing,
`collab-terms-time` and `deliverables-when-buying-content` reference screens deleted on 10 Sep;
`brand.test.js` register 422 was already failing at item 9). None is in item 10's ground.

Suites nearest item 10, all **passing** today: `shoot-plan.test.js` (29 — mode resolution,
nothing born completed, who may mark, migration 164), `item7-agreement.test.js` (49),
`item8-pitch.test.js` (49), `item6-negotiation.test.js`, `negotiations.test.js`,
`contracts.test.js`, `cron-tranche3.test.js`. Failing and pre-existing, touching escrow:
`earnings.test.js` (3), `escrow-fee-tiers.test.js` (2), `admin-escrow.test.js` (4).
`shoot-plan.test.js` asserts the *agreement* fallback and the two-sided completion; the mode fix
in §4.3 must keep it green (set mode first, agreement second, remote last).

---

## 13. Questions for the founder

Each with my recommendation. Q1–Q3 change what gets built; the rest confirm assumptions.

**Q1 — The rules doc disagrees with itself in four places. Which wins?**
§11.1's new prose (creator marks attended, brand confirms, 3-day auto-confirm, stays in its set)
versus: the §11.1 flow diagram still reading "Up to two negotiation rounds" and "Brand marks
Shoot Completed"; §25 "Marking the shoot completed — No time limit. Store Visit: the Brand marks
it"; §25 "Content not live by the Posting Date → moved out of its Set"; and §12.1's flow listing
"Creator confirms the social post / Brand confirms … live" twice. **Recommend:** the new §11.1
prose is authority; I build to it and propose the four tidy-ups for v1.24.

**Q2 — Correct the six wrong shoot rows in production?**
All six set-first signed collaborations (five Remote/shipment sets, one Store Visit set, all
Kanchi Silks practice) hold a `remote` shoot row because of §4.3. Once the resolver is fixed,
new collaborations are right; these six stay wrong. **Recommend:** one-time `UPDATE
production_events SET mode = cs.shoot_mode` for exactly those six ids, behind `--fix-modes` on
the runner, dry-run printed first, with your go. No timestamps or money involved.

**Q3 — V10's "She didn't come — send a new time" after she has marked attended: what happens to
her mark?** The rules say nobody is blamed and the brand sends a new time. **Recommend:** the
move clears `influencer_completed_at` and `auto_confirm_due_at` (kept in the log), the thread
reopens with the new time, and she is told "Urban Threads asked to move the visit" — no dispute
state, no record against either.

**Q4 — A legacy zero-fee Pay for Content or Hybrid:** block (§10 says funds must be locked) or
open on signatures? None exists in production. **Recommend:** block; it cannot arise through
item 5.

**Q5 — Save the plan as a draft (F2) or send in one call (F2+F3 together)?** Item 5 sends
invitations as one all-or-nothing action. **Recommend:** one call; the V3 confirm is on the
phone; no half-plans on the server.

**Q6 — A branch with no street address.** All three practice brands have none, so the reveal in
V3/V5 would be empty. **Recommend:** F3 refuses with "Add the street address to {branch} first"
and a link to Branches; you add addresses to the practice branches before the walk.

**Q7 — Rounds after a reschedule.** The thread reopens; does the mover get the full round budget
again? **Recommend:** yes — counters are counted since the last agreement, the limit stays the
one stamped at the start.

**Q8 — Time picker:** the native one (in the binary, but guarded against by a Stage-4 test) or
the pure-JS chip picker (exists, orphaned)? **Recommend:** the JS one, restyled; 15-minute steps.

**Q9 — Marking attended early.** **Recommend:** allowed from 00:00 IST on the agreed day, not
before; the brand can still send a new time.

**Q10 — Minimum notice.** **Recommend:** none; only the past is refused.

**Q11 — Contact number prefill.** **Recommend:** prefill with the brand user's login number,
editable, validated as an Indian mobile.

**Q12 — Retire the website's shoot panel** (visit branch + the initialise/flip-to-remote
controls) in favour of a read-only card? **Recommend:** yes — it lets a brand pick a mode the set
already fixed, and it gates on the wrong test.

**Q13 — Delayed flag location:** `campaign_influencers.delayed_at/_stage` (recommended — the
collaboration is what §25 later moves, and item 12 will set the same flag for content) rather
than on the shoot row.

**Q14 — The legacy Label Fern visit** (no set, no posting date, shoot `proposed`): V1 would show
no countdown and no cap. **Recommend:** leave it; it is a pre-set-first record and carries no money.

**Assumptions 1–12 of the prompt:** all confirmed by the survey as stated, with the refinements
above (2 → one plan per collaboration already true structurally; 5 → no decline is a `can` flag
plus a missing route; 7 → reopen is new engine behaviour, shoot-anchor only; 9 → auto-confirm
reads the stamped days; 10 → flag on the collaboration, status untouched; 11 → proved by the
balance snapshot test).

---

## 14. Build order (for after approval — not started)

**2a** the gate on every path + the mode fix + migration 187 (+ Q2 data fix) → **2b** plan,
send, accept, third anchor, reschedule, attended, confirm, two jobs, admin number, notifications,
Needs You → **3** Brand V1–V3, V7, V10–V14; Creator V4–V6, V8, V9, V15 → **4** tests, checks
1–30, `compare.js`, governance check. Contract: `features/item10-store-visit/` (spec,
workflow, expected outputs, the locked mockups copied to `04-preview/`, impact, diff notes).

**Stopping here and waiting for approval.** Nothing has been built.
