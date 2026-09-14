# Item 6 — Negotiation, and the pool: gap report (Phase 1)

Read-only survey against rules doc **v1.17** (§7B new; §7 and §25 amended; §4, §5, §5B, §6, §7A, §8,
§8A, §9, §15.1, §21, §24, §28, §31), the locked mockups **N1–N22** with their rules table, and the item 6
gap prompt. Code read as it stands after item 5 (`1dd3261`, live in production 13 Sep). Nothing was
changed, countered, invited or accepted. Date: 14 September 2026.

Every `file:line` is under `backend/`, `Packages/Mobile/src/` or `Packages/brand-web/` and was read
against the working tree.

---

## 1. Summary

| Area | Status | The gap in one line |
|---|---|---|
| The negotiation engine | Partial, keep and extend | A one-thread-per-invitation engine with turns, whose-move and WRONG_TURN exists and is tested. A turn carries fee, commission, a deadline and a note; **no deliverables, no usage rights, no round limit, no snapshot, no outcome, no `answered_at`**. |
| Rounds | Missing | Nothing counts turns. The only bound is the 48-hour clock plus walk-away. |
| Time | Conflicts | A 48-hour auto-decline runs twice an hour and declines the invitation with `declined_reason = 'other'`. v1.17 retires it; the set's cutoff becomes the only deadline. |
| Accepting a counter | Partial | Writes fee and commission onto the invitation and drafts a contract, but not `answered_at`, no notification, no deliverables or usage rights. |
| Declining | Partial | Walk-away declines the invitation as `declined / other` from either side. No brand reason, no creator reason from the five. |
| The move request | Partial, rebuild on the same columns | `POST /offers/:id/defer` and the four `deferred_*` columns exist, no screen calls them, and the brand has no way to answer (agree / keep / decline). |
| The pool | Missing | The only thing near it is the campaign-level "moved out" list. The pool is brand-level and needs a table. |
| The switch | Partial | `campaigns.allow_negotiation` exists, defaults on, is read by the negotiate gate and item 5's `canCounter`; **no screen sets it**, and the update endpoint only allows it on a draft campaign. |
| Admin settings | Missing the page and the three numbers | The admin site, its roles and a `settings` capability exist; two singleton config tables exist (`payment_config`, `system_settings`); **no generic platform settings, no audit log**. |
| Needs You | Partial | The creator's counters ignore negotiations; the brand has one flat count. Neither says whose move it is. |
| Item 5 links | Ready | Every negotiable term is a column on the invitation; the validator takes the full set per Aim; withdraw already refuses anything but `invited`. |
| Pitch negotiation (item 8) | Separate machine, leave alone | Its own tables, its own per-side round cap of two, no per-turn clock. |
| Production data | Empty | Zero negotiations, zero turns, zero deferred rows, all ten campaigns with the switch on. No backfill needed anywhere. |

**Verdict in one sentence.** Keep the engine's skeleton (one thread per invitation, turns, whose-move,
the routes and the tests), extend the turn into a full per-Aim snapshot with a kind and a stamped round
limit, retire the 48-hour job in favour of item 4's set expiry, rebuild the move request on the
`deferred_*` columns with a brand answer, add a brand-level pool table, a platform-settings table with an
audit log and its admin page, and put the switch on the campaign screen.

---

## 2. Requirement table

Status key: **E** exists, **P** partial, **M** missing, **C** conflicts with the code today.

### 2.1 The negotiation (D1)

| Field | St | Evidence | Proposed change |
|---|---|---|---|
| One negotiation per invitation | E | `campaign_influencer_id … UNIQUE` (`migrations/001_initial_schema.sql:284`); 409 on a second (`controllers/offer.controller.js:274-280`) | Keep |
| Round limit, stamped at start | M | No column, no count anywhere (grep `round|max_round` in `src`: only the pitch track) | Add `negotiations.round_limit int NOT NULL` written from the setting at insert |
| Counters used | M | Nothing counts turns | Derive: `count(turns where kind = 'counter')`. Never stored |
| Whose move | E (stored) | `current_turn turn_sender` (`001:287`), enforced as `WRONG_TURN` (`offer.controller.js:464-470`) | **Keep it stored.** It is already written on every turn, indexed, tested (`tests/negotiations.test.js:372-404`), and the item 8 machine does the same with `counter_by`. Deriving from the last turn would give the same answer and remove the tested guard for no gain |
| State | P | `negotiation_status`: open · awaiting_brand · awaiting_influencer · agreed · walked_away (`001:30-32`). `open` is never written | Add `outcome text` ∈ agreed · declined_by_creator · declined_by_brand · expired, and keep the enum as it is for whose-move. `walked_away` becomes legacy-readable |
| Started / ended / who ended | P | `created_at` (`001:290`); nothing on ending | Add `ended_at`, `ended_by uuid` |
| Never-used columns | — | `agreed_fee`, `agreed_deadline` (`001:288-289`) are written and read by nothing | Leave; the invitation is the record |

### 2.2 A turn (D2)

| Field | St | Evidence | Proposed change |
|---|---|---|---|
| Who, when | E | `sent_by turn_sender`, `created_at` (`001:297, 301`) | Keep |
| Terms snapshot | C | Only `proposed_fee`, `proposed_deadline`, `note` (`001:298-300`) and `proposed_commission_pct` (`018_commission_negotiation.sql:8-9`). `proposed_deadline` is written (`offer.controller.js:372, 510`) and never read | Add `terms_json jsonb NOT NULL` — the whole negotiable set for the Aim (§7); keep the old columns mirrored for legacy readers |
| Note ≤ 300 | P | `note text`, no cap | Cap in code with item 5's message |
| Kind | M | Every row is a counter; accept and decline write nothing to `negotiation_turns` (`:535-594`) | Add `kind text` ∈ counter · accept · decline, so the thread shows every ending |
| Decline reason | M | Walk-away writes `declined_reason = 'other'` on the invitation (`:589-593`) and nothing on the turn | Creator: one of item 5's five codes on the turn and on the invitation. Brand: `decline_note ≤ 200` on the turn, shown to the creator |

### 2.3 What is negotiable (D3)

| Aim | Today | Change |
|---|---|---|
| Pay for Sale | commission (gated by `payment_config.allow_commission_negotiation`, `offer.controller.js:337-347, 484-494`) | commission only; the gate is not in v1.17 (§7 "Commission % — Yes") — retire it, see Q5 |
| Pay for Content | fee only | fee + deliverables (`formats_json`) + usage rights (`usage_rights_json`) |
| Hybrid | fee + commission | fixed fee + commission; no deliverables, no usage rights |
| Never | the engine never touched scope or offer | Aim, offer, scope, shoppable posts, date, mode stay locked; the validator's strict mode already drops them for the wrong Aim |
| A counter that changes nothing | M | no comparison anywhere | Refuse with "Change something before you send this." after normalising both sides |

### 2.4 Accepting, rounds, time, the move, the pool, the settings, the switch (D4–D10)

| ID | Requirement | St | Evidence | Proposed change |
|---|---|---|---|---|
| D4 | Accept rewrites the invitation, sets `answered_at`, closes as agreed, notifies | P | Writes `status = 'accepted'`, `agreed_fee`, `commission_pct` only (`offer.controller.js:566-573`); no `answered_at`; **no notification on accept** (only `negotiation.turn` on counter, `:611`); drafts a contract outside the transaction (`:600-608`) | Rewrite every term from the accepted turn's `terms_json` (fee, commission, `formats_json`, `usage_rights_json`), `answered_at = now()`, `outcome = 'agreed'`, `ended_at`, notify the other side. Keep the draft contract for handpick, the same as item 5's plain accept (`services/invitationAnswer.service.js:95-106`) |
| D5 | Rounds: admin number, default 2, range 1–5, stamped at start; after the last counter only accept or decline | M | No limit; every counter allowed while it is your turn (`:499-533`) | `round_limit` on the negotiation; refuse the (limit + 1)th counter with "There are no counters left. You can accept or decline." |
| D6 | No 48-hour auto-decline; the cutoff is the only deadline | C | `expires_at = now() + 48h` on start (`:356`) and on every counter (`:523`); the job at `jobs/negotiation-expiry.job.js:22-66` walks the thread away and **declines the invitation as `other`**; scheduled `7,37 * * * *` (`jobs/index.js:67`); backfilled by `017_observability_and_sla.sql:22-25` | Stop scheduling the job, stop writing `expires_at`; the set-expiry job closes open threads with `outcome = 'expired'` when it expires the set's invitations. See §9 |
| D7 | The move request: date and/or mode, note ≤ 300; brand answers agree / keep / decline; not a counter | P | `POST /offers/:id/defer` (`offer.controller.js:189-257`) writes `status = 'deferred'` + the four columns from `167_deferred_creators.sql:41-45` at once — **the invitation ends the moment she asks**, and there is no brand answer. Nothing on the phone calls it (`api.js:463` unused) | Rebuild on the same columns: asking sets `deferred_go_live_date / deferred_shoot_mode / deferred_note` and a new `move_requested_at`, leaves the status alone; the brand's answer writes `move_answer` (agreed · kept · declined) and `move_answered_at`; only **agreed** flips the status to `deferred` and creates the pool entry. See §8 |
| D8 | The pool: brand-level, agreed terms snapshot, what she asked for, provenance, lifetime, state | M | Only `GET /campaigns/:id/deferred` (`campaign.controller.js:646-663`), campaign-level, unindexed, no caller | New table `brand_creator_pool`. See §8 |
| D9 | Three admin settings, never retroactive, every change logged | M | `payment_config` (`006:50-63`, cached 60 s in `services/paymentConfig.service.js:15-38`, `updated_by`) and `system_settings` (`041:189-214`, marketing scraper) are singletons with fixed columns; **no audit table** exists (grep migrations for audit / change_log / admin_actions: none) | New `platform_settings` (key → value, min, max, unit) + `platform_settings_audit`; cached like payment config. See §10 |
| D10 | The switch, on by default, changeable any time, governs new counters only, hides the button | P | `036_allow_negotiation_flag.sql:6` default true; written by create (`campaign.controller.js:386`) and update (`:568`) — but update refuses it unless the campaign is a draft (`:556-559`); read by the negotiate gate (`offer.controller.js:305`) and `canCounter` (`services/invitationRows.service.js:221`); **no screen writes it** (grep Mobile and brand-web: none) | Lift the draft-only guard for this one field; add it to N18 and the campaign ⋯ menu; keep the read sites |
| D11 | Groupings: Your move first, then Negotiating, then item 5's groups | P | Item 5 groups `negotiating` as one bucket (`invitationRows.service.js:28-36`) and has no "your move" | Derive `yourMove` per row: an open negotiation with `current_turn = 'brand'`, or an unanswered move request; a new first group; counts line unchanged |
| D12 | Privacy | P | The legacy thread read returns the raw negotiation with `initiated_by` and every turn to both sides (`offer.controller.js:697-700`) — no brand-internal field exists on a turn today, so nothing leaks yet; the creator's item 5 detail never selects the brand's warnings | The new thread endpoints select per side; the brand's minimum warning is computed, never stored |
| D13 | Legacy data | E | Production: 0 negotiations, 0 turns, 0 deferred rows, 10 campaigns all `allow_negotiation = true`, 0 `negotiation.*` notifications ever sent | No backfill. `round_limit` is `NOT NULL` with no default and the table is empty in production; the test database is rebuilt from migrations |

### 2.5 API (§5)

| ID | Endpoint | St | Today | Change |
|---|---|---|---|---|
| B1 | Creator counters | P | `POST /offers/:id/negotiate` (`offer.controller.js:264-407`): eight gates, fee or commission only, opens the thread, sets `negotiating`, 48 h | New `POST /influencers/me/invitations/:ciId/counter` with the full snapshot; the legacy route stays for old builds and gains the same rules |
| B2 | Creator asks to move | P | `POST /offers/:id/defer` ends the invitation | New `POST /influencers/me/invitations/:ciId/move-request`; legacy defer repointed to it |
| B3 | Creator's thread | P | `GET /negotiations/:id`, `GET /negotiations/by-ci/:ciId` (`negotiation.routes.js:10-11`, handlers `:657-785`): turns oldest first, derived original/current fee | New `GET /influencers/me/invitations/:ciId/thread` — newest first, the invitation as the last card, whose move, rounds, what she may do |
| B4 | Creator accepts / declines from the thread | P | `POST /negotiations/:id/respond { action }` for both sides (`:414-650`) | New `…/thread/accept`, `…/thread/decline { reason }` reusing `invitationAnswer` |
| B5 | Brand's thread | P | same legacy read | New `GET /campaigns/:id/sets/:sid/invitations/:ciId/thread` with the minimum warnings |
| B6 | Brand accepts | P | respond `accept` | New `…/thread/accept` |
| B7 | Brand counters back | P | respond `counter` | New `…/thread/counter` with the same validation + rounds |
| B8 | Brand declines a counter | P | respond `walkaway` → `declined / other` | New `…/thread/decline { note? }` → `rejected_by_brand`, note shown to her |
| B9 | Brand answers a move | M | nothing | New `…/invitations/:ciId/move-answer { answer: agreed | kept | declined }` |
| B10 | The pool | M | `GET /campaigns/:id/deferred` is per campaign | New `GET /brands/me/pool?aim=` grouped by request |
| B11 | Remove / leave | M | | `DELETE /brands/me/pool/:entryId`; `DELETE /influencers/me/pool/:entryId` |
| B12 | Start a set from the pool | M | | `POST /brands/me/pool/set-defaults { entryIds }` → `{ goal, shoot_mode, branch_id?, go_live_date, creators: [{ influencerId, terms }] }` |
| B13 | Pool in the picker | M | item 5's `pickable` has tabs all / worked | `pickable?tab=pool` rows with `pool { entryId, terms, wants }` |
| B14 | The switch | P | create + update (draft only) | Lift the guard; expose on `GET /campaigns/:id/summary` |
| B15 | Admin settings | M | `GET/PATCH /admin/config/payments` is the pattern (`admin.routes.js:80-81`) | `GET /admin/platform-settings`, `PATCH /admin/platform-settings { key: value }` with audit rows |
| B16 | Jobs | P | set-expiry (item 4) closes invitations, not threads; 48 h job to retire | Extend set-expiry; add pool-expiry to the same hourly tick |

---

## 3. What already exists, in detail

### 3.1 The negotiation engine — keep, extend
Tables from `001:282-302` plus `expires_at` (`017:18`) and `proposed_commission_pct` (`018:8`). Two
partial indexes on `expires_at` and `status` (`017:27-33`); **none on `negotiation_turns`**. The creator
opens a thread through `POST /offers/:id/negotiate` (eight gates in order: ownership, no second thread,
`invited` only, no briefed agreement, the campaign switch, not open-group, fee or commission present, the
commission gate), then one transaction inserts the negotiation `awaiting_brand`, the first turn and flips
the invitation to `negotiating` (`offer.controller.js:349-383`). Both sides then use
`POST /negotiations/:id/respond` with counter / accept / walkaway; the turn owner is enforced with
`WRONG_TURN` (`:464-470`). The engine is covered by `tests/negotiations.test.js` (duplicate 409, wrong turn
both ways, alternation, closed thread) and `tests/contracts.test.js:129` (a contract when agreed).

**Keep:** the two tables, the unique constraint, whose-move as stored `current_turn`, `WRONG_TURN`, the
legacy routes for old app builds. **Extend:** the turn (kind, snapshot, decline fields), the negotiation
(round limit, outcome, ended at / by), the gates (rounds, cutoff, no-change), accept (full rewrite +
`answered_at` + notification), decline (reasons). **Retire:** the 48-hour clock and its job, the
`allow_commission_negotiation` gate (Q5), the never-read `proposed_deadline` as an input.

### 3.2 The defer path — rebuild on its columns
`POST /offers/:id/defer` (`offer.controller.js:189-257`) accepts a date and/or a mode plus a note,
validates the date with the set-shape rule, and in one UPDATE sets `status = 'deferred'` and the four
columns from migration 167. The brand is told (`offer.deferred`, `:247`) but has no endpoint to answer;
`GET /campaigns/:id/deferred` lists a campaign's deferred rows for a screen that no longer exists.
Item 5 already groups `deferred` as "Asked for another date", keeps it out of waiting, out of the expiry
job and out of the live unique index (`181:50-54`).

**Reuse:** the four columns, the `deferred` status as the terminal "moved to the pool" state, item 5's
group. **Add:** `move_requested_at`, `move_answer`, `move_answered_at`, and the brand's three answers.
**Retire:** the instant status flip on asking, the campaign-level list's role (kept readable).

### 3.3 The expiry job — retire
`jobs/negotiation-expiry.job.js` selects open threads past `expires_at` (`:22-44`), and per row walks the
thread away and declines the invitation as `other` (`:55-66`), then tells both sides "within 48 hours"
(`:75-93`). Scheduled at `jobs/index.js:67`. No test exercises it. Retiring it affects: the schedule line,
the two `negotiation.expired` keys, the partial index on `expires_at` (harmless), the 48-hour copy in
`offer-expiry.job.js:72` and the open-group broadcast's `offer_expires_at` (`campaign.controller.js:270`,
unreachable per item 5), and nothing else.

### 3.4 The switch — surface
`campaigns.allow_negotiation` default true (`036:6`); create writes it (`campaign.controller.js:386`);
update allows it in the whitelist (`:568`) but only on a draft (`:556-559`); readers are the negotiate
gate and `canCounter`. Item 5's invitation screen already hides Counter when `canCounter` is false
(`screens/influencer/InvitationScreen.js:115`) and has no "not taking counters" line yet.

### 3.5 Item 5, as item 6 finds it
Every negotiable term is a column on the invitation and is written by one place
(`services/invitationSend.service.js` `insertOne`): `agreed_fee`, `commission_pct`, `formats_json`,
`usage_rights_json`; never negotiable: `alloc_*`, the offer snapshot, `brand_note`. The validator
`services/invitationTerms.service.js` `validateTerms(goal, terms, { mode })` takes the whole set for the
Aim (strict refuses a missing fee, commission or deliverables) — exactly what a full-snapshot counter
needs; it cannot validate a partial set, and does not need to. `answered_at` is written by accept and
decline (`invitationAnswer.service.js:79-84, 119-124`), not by the legacy negotiate. Withdraw is refused
for anything but `invited` (`invitationSend.service.js` `withdraw`), so a counter already makes the
invitation unwithdrawable. `canCounter` (`invitationRows.service.js:221`) is computed and only decides
whether the button renders.

---

## 4. Link readiness

| Link | Verdict | What item 6 must do |
|---|---|---|
| Item 5: the invitation | **Ready** | Rewrite `agreed_fee`, `commission_pct`, `formats_json`, `usage_rights_json` from the accepted snapshot; nothing else changes. All four are plain columns with no trigger or CHECK beyond the note length |
| Item 5: the validator | **Ready** | Call `validateTerms(set.goal, snapshot, { mode: 'strict' })` on every counter from either side; the same messages; then compare the normalised result with the current terms to refuse a no-change counter |
| Item 5: `answered_at` | **Ready, one write to add** | The new counter endpoint writes `answered_at = now()` on the first counter; withdraw already refuses non-`invited` rows |
| Item 5: statuses | **Confirmed** | invited · applied · accepted · negotiating · contracted · active · completed · declined · expired · rejected_by_brand · slots_filled · deferred · withdrawn · removed. `negotiating` is waiting (`campaignState.service.js:54`), open for the expiry job, live in the unique index. `rejected_by_brand` is dead and groups under Declined — the right home for a brand-declined counter |
| Item 4: the cutoff | **Ready** | `cutoffFor`, `describeSet`, `assertCanInvite` (`campaignState.service.js`), `indiaDay.js`; item 5's `assertNotClosed` (`invitationAnswer.service.js`) already refuses accept and decline after it — reuse for counter and move-answer |
| Item 4: the expiry job | **Extend** | `set-expiry.job.js` closes `OPEN_STATUSES = invited · applied · accepted · negotiating`; it must also set `outcome = 'expired'`, `ended_at` on the open thread and tell both sides; it already leaves `deferred` alone |
| Item 4: the campaign screen | **Extend** | N18 on `BrandCampaignNewScreen` (posts `started_from_group_id` today, `:34`) and a row on the detail ⋯ menu (`BrandCampaignDetailScreen.js:75-79`); the update guard lifted for this field |
| Item 4: the new-set screen | **Ready to prefill** | `BrandSetEditScreen` takes `route.params.set` as initial values (`:29-39`) and `suggestedName`; pass a `prefill { goal, shoot_mode, branch_id, go_live_date, fromPool: { names, date } }` the same way the group banner is passed to New campaign |
| Item 4: the deferred list | **Keep the columns, add a table** | See §8 |
| Item 2: minimums and eligibility | **Ready** | `canBrandInviteCreator` returns `warnings` and `minimums` outside the invite path (item 5 added `minimums`); the pool send goes through item 5's batch send, which re-checks eligibility |
| Item 7: the agreement | **Confirmed** | `contract.service.autoCreate` copies fee and posting date (`contract.service.js:58-90`); an accepted counter leaves the invitation `accepted` with the rewritten columns, so item 7 reads the invitation as planned |
| Item 8: pitch negotiation | **Separate, unchanged** | Its own tables and diary (`152_collab_diary_and_pitch_rounds.sql:45-131`), a per-side cap `counter_rounds_per_side = 2` (`handshakeSettings.service.js:39`), a 7-day pitch TTL, no per-turn clock. Divergences: per-side cap vs one shared limit; latest terms vs an append-only thread; agreement row vs invitation rewrite. Item 6 changes nothing there; the admin rounds setting could later feed both, see Q9 |
| Item 24: Needs You | **Partial** | Creator: `collabCounts.forCreator` counts `invited` rows only (`collabCounts.service.js:195-196`); `collabStep` files `negotiating` under the creator's turn regardless of `current_turn` (`collabStep.service.js:131-137`). Brand: one flat `pending_negotiations` (`brandInbox.controller.js:143-147`). Item 6 adds a `counters_to_answer` term on each side driven by `current_turn`, and the set's "Your move" group |
| Notifications | **Partial** | Existing: `negotiation.turn`, `negotiation.expired` (to retire), `offer.deferred`. Needed: counter received (reuse `negotiation.turn`), `negotiation.agreed`, `negotiation.declined` (with the reason), `pool.entered`, `pool.closing` (7 days), `pool.closed`, `pool.invited` (item 5's `offer.invited` with the pool line) |
| Admin website | **Ready to add one page** | Next.js under `Packages/brand-web/app/admin/`, edge middleware + client role check + server capabilities (`middleware/auth.js:123-149`); capability `settings` exists (`config/adminCapabilities.js:66`); precedent `admin/settings/payments/page.js` with `adminApi.getPaymentConfig / updatePaymentConfig` (`lib/api.js:652-653`) |
| Production data | **Empty** | 0 negotiations · 0 turns · 0 `negotiating` · 0 `deferred` · 10 / 10 campaigns switch on · 0 `negotiation.*` notifications · 1 `payment_config` row |

---

## 5. Proposed migration 182 (additive)

```sql
-- negotiations
ADD round_limit int, outcome text CHECK (outcome IN ('agreed','declined_by_creator','declined_by_brand','expired')),
    ended_at timestamptz, ended_by uuid REFERENCES users(id) ON DELETE SET NULL;
-- negotiation_turns
ADD kind text NOT NULL DEFAULT 'counter' CHECK (kind IN ('counter','accept','decline')),
    terms_json jsonb, decline_reason text, decline_note text;
CREATE INDEX idx_negotiation_turns_neg ON negotiation_turns (negotiation_id, created_at);
-- campaign_influencers (the move request)
ADD move_requested_at timestamptz, move_answer text CHECK (move_answer IN ('agreed','kept','declined')),
    move_answered_at timestamptz;
-- the pool
CREATE TABLE brand_creator_pool (
  id uuid PK, brand_id → brands, influencer_id → influencers, goal text NOT NULL,
  agreed_terms_json jsonb NOT NULL, wants_go_live_date date, wants_shoot_mode text, note text,
  from_campaign_id, from_set_id, from_ci_id (ON DELETE SET NULL),
  lifetime_days int NOT NULL, created_at, expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting','used','removed_by_brand','removed_by_creator','expired')),
  used_ci_id uuid, state_changed_at timestamptz, state_changed_by uuid);
CREATE INDEX idx_pool_brand_state ON brand_creator_pool (brand_id, state, expires_at);
CREATE INDEX idx_pool_due ON brand_creator_pool (expires_at) WHERE state = 'waiting';
-- platform settings
CREATE TABLE platform_settings (key text PK, value int NOT NULL, min int, max int, unit text, label text, updated_at, updated_by);
INSERT ('negotiation_rounds', 2, 1, 5), ('pool_lifetime_days', 30, 7, 90), ('min_shoppable_posts', 1, 1, 10) ON CONFLICT DO NOTHING;
CREATE TABLE platform_settings_audit (id, key, old_value, new_value, changed_by → users, changed_at);
```
`round_limit` stays nullable at the column level (legacy threads are none in production, but the test
database may hold rows written by the legacy route); code treats null as "the setting at the time it is
read" and the new start path always writes it. Dry run prints negotiation / turn / deferred counts and the
three seeded settings; nothing to backfill.

---

## 6. Proposed endpoints

All new; another brand's set, another creator's invitation, another admin's page → 404. Error codes:
`VALIDATION_ERROR` with the exact §7 message and `field`; `WRONG_TURN` (existing) for "You've already sent
your counter…"; `NO_ROUNDS_LEFT`; `INVITE_CLOSED` (existing) for the cutoff; `NEGOTIATION_OFF` for the
switch; `LOCKED` for "The terms are agreed…"; `CONFLICT` for a second move request.

| ID | Method and path | Body → response |
|---|---|---|
| B1 | `POST /influencers/me/invitations/:ciId/counter` | `{ terms, note? }` → the thread. Gates in order: hers, `invited` or `negotiating`, cutoff, switch (new thread only), agreement absent, not open-group, her turn, rounds left, validator, changed something. First counter creates the negotiation with `round_limit` from the setting and writes `answered_at` |
| B2 | `POST /influencers/me/invitations/:ciId/move-request` | `{ goLiveDate?, shootMode?, note? }` → the invitation. Once per invitation; open invitation (`invited` or `negotiating`); no round consumed; not governed by the switch (Q6) |
| B3 | `GET /influencers/me/invitations/:ciId/thread` | `{ negotiation: { roundLimit, countersUsed, whoseMove, outcome, endedAt }, turns: [newest first, each { by, at, kind, terms, changes: [{ term, from, to }], note, declineReasonLabel, declineNote }], invitation: { terms as sent }, moveRequest, can: { accept, counter, decline } }` |
| B4 | `POST …/thread/accept`, `POST …/thread/decline { reason, note? }` | reuse `invitationAnswer` after the turn is recorded |
| B5 | `GET /campaigns/:id/sets/:sid/invitations/:ciId/thread` | same shape plus `warnings` and `minimums` (brand only) |
| B6–B8 | `POST …/thread/accept`, `…/thread/counter { terms, note? }`, `…/thread/decline { note? }` | brand side; decline → `rejected_by_brand`, note stored on the turn |
| B9 | `POST …/invitations/:ciId/move-answer { answer }` | agreed → pool entry + `deferred`; kept → answer recorded, nothing else; declined → `rejected_by_brand` |
| B10 | `GET /brands/me/pool?goal=` | `{ groups: [{ key: 'date:2026-10-27' | 'mode:shipment', title, rows: [{ entryId, creator, goal, termsLine, terms, daysLeft, closingSoon }] }], total }` |
| B11 | `DELETE /brands/me/pool/:entryId`, `DELETE /influencers/me/pool/:entryId` | state removed_by_* |
| B12 | `POST /brands/me/pool/set-defaults { entryIds }` | refuses mixed Aims with the exact message; returns `{ goal, shoot_mode, branch_id, go_live_date, creators: [{ influencerId, name, terms, entryId, agreedAt }] }` |
| B13 | `GET …/pickable?tab=pool` | item 5 rows + `pool { entryId, terms, wants }`; item 5's send accepts `poolEntryId` per creator and marks the entry used on insert |
| B14 | `PATCH /campaigns/:id { allow_negotiation }` at any status; `GET /campaigns/:id/summary` carries `allowNegotiation` | |
| B15 | `GET /admin/platform-settings` → `{ settings: [{ key, value, min, max, unit, label, updatedAt, updatedBy }], lastChange }`; `PATCH /admin/platform-settings { key: value, … }` → out of range 422 "Enter a number between {min} and {max}."; one audit row per changed key | `requireAnyAdminRole` to read, `requireCapability('settings')` to write, as payment config |
| B16 | jobs | set-expiry: close threads with the invitations; pool-expiry (same hourly tick): `waiting` past `expires_at` → `expired`, notify; a 7-day "closing" notification once |

**Callers affected.** The legacy `/offers/:id/negotiate`, `/negotiations/:id/respond` and `/offers/:id/defer`
have no phone or website caller (grep); they are kept, gain the rounds and cutoff gates, and lose the 48 h
write. `tests/negotiations.test.js` and `tests/contracts.test.js:129` drive them and will need the new
gates reflected (fixture drift: a set with a date; assertion drift: no `expires_at`).

---

## 7. The turn snapshot, and how accepting rewrites the invitation

`terms_json` is item 5's normalised shape for the Aim, and nothing else:

| Aim | `terms_json` |
|---|---|
| conversion | `{ commissionPct }` |
| engagement | `{ fee, deliverables: [{ type, count }], usageRights: { on, durationDays, places } | null }` |
| hybrid | `{ fee, commissionPct }` |

The invitation's own values form the implicit turn zero (`invitation` in the thread response), so the
first counter's changes are computed against the row. Each turn's `changes` are derived on read by
comparing with the previous snapshot, never stored. Accept records a turn `kind = 'accept'` whose
`terms_json` is a copy of the accepted counter, then in one transaction: `UPDATE campaign_influencers SET
agreed_fee, commission_pct, formats_json, usage_rights_json, status = 'accepted', answered_at = now()`;
`UPDATE negotiations SET outcome = 'agreed', ended_at, ended_by, current_turn = NULL`; after commit the
draft contract for handpick (as item 5's accept does) and `negotiation.agreed` to the other side. The
agreement (item 7) reads the invitation.

---

## 8. The pool: a table beside the deferred columns

**Recommendation: a new brand-level table, with the existing `deferred_*` columns kept for the request
itself.** The four columns are the right place for "what she asked for" on the invitation (they already
carry date, mode, note and a timestamp), and item 5 already groups and protects the `deferred` status.
But a pool entry outlives the campaign, is read across campaigns, carries a lifetime and a state, is used
by a different set, and must never block anything — none of which fits a column on one campaign's row.
Extending the columns would mean every pool read scans `campaign_influencers` across all of a brand's
campaigns for `deferred` rows and reinventing lifetime, state and provenance on the invitation.

Flow: **ask** (B2) writes `deferred_*` + `move_requested_at`, status untouched → the brand's "Your move".
**Agree** (B9) writes `move_answer = 'agreed'`, flips the invitation to `deferred` (terminal for the set;
counts stay honest, the expiry job and the unique index already skip it), and inserts the pool entry with
the agreed terms snapshot (the current invitation columns, in the turn shape), the request, provenance,
`lifetime_days` and `expires_at` from the setting. **Keep** writes `move_answer = 'kept'`; she still
accepts, counters or declines. **Decline** → `rejected_by_brand` with `move_answer = 'declined'`.
**Use**: item 5's batch send accepts `poolEntryId` per creator; `insertOne` marks the entry `used` with
`used_ci_id` in the same transaction; the new invitation carries `source = 'pool'` (one more value in the
source CHECK) so N17 can print its line. Terms are only pre-filled when the new set's Aim equals the
entry's Aim (B12 and the picker enforce it; the server ignores an entry of another Aim). **Expiry**:
hourly, `waiting` past `expires_at` → `expired`, the creator told; a "closing soon" notification once when
seven days remain.

---

## 9. Rounds and time

**Stamping.** `platformSettings.get('negotiation_rounds')` is read once when the first counter creates the
negotiation and written to `round_limit`; every later check reads the row, never the setting. A legacy
thread with `round_limit` null reads the setting at check time (none exist in production).

**Counting.** `countersUsed = count(turns where kind = 'counter')`. The (round_limit + 1)th counter is
refused with "There are no counters left. You can accept or decline."; the thread response carries
`countersUsed`, `roundLimit`, `isLastRound` so both apps print "ROUND 2 OF 2 · YOUR LAST" before sending.

**Retiring the 48-hour clock.** Remove the schedule at `jobs/index.js:67` and the import; delete
`negotiation-expiry.job.js`; stop writing `expires_at` at `offer.controller.js:356` and `:523`; leave the
column and its partial index (harmless, no reader). The `negotiation.expired` keys go with it; the
set-expiry job gains `UPDATE negotiations SET outcome = 'expired', ended_at = now(), current_turn = NULL
WHERE campaign_influencer_id IN (the rows it just expired) AND outcome IS NULL` and one notification per
side ("Invitations for this set closed on {date}, so this negotiation ended unfinished."). The thread stays
readable. Nothing else assumes the clock: the two other 48-hour strings are the open-group broadcast
(unreachable, item 5) and copy in `offer-expiry.job.js:72`.

**Needs You.** Creator: a `counters_to_answer` term (`negotiations.current_turn = 'influencer'` on an open
thread) in `collabCounts.forCreator`, and `collabStep` reading `current_turn` instead of assuming the
creator owes. Brand: the set's "Your move" group and the existing `pending_negotiations` count switched to
`current_turn = 'brand' AND outcome IS NULL`. Reminders are notifications on a cadence; recommend one at
48 hours of silence and one at 7 days, without any automatic decline (Q10).

---

## 10. Admin settings

**Table.** `platform_settings` keyed rows (three today) rather than three more columns on
`payment_config`: the page lists settings generically, ranges live with the value, and the audit references
a key. **Cache.** The same pattern as `paymentConfig.service.js:15-38`: one in-process map, 60-second
TTL, busted on write; a job or a request reads the cached map, never a query per request. **Audit.**
`platform_settings_audit (key, old_value, new_value, changed_by, changed_at)`, one row per changed key per
PATCH; the page's foot line reads the latest row joined to the admin's name. **Never retroactive** by
construction: `round_limit` and `lifetime_days` are copied onto the row they govern; `min_shoppable_posts`
is read at send and written… nowhere today (item 5 prints the constant). Item 6 makes
`config/platformRules.MIN_SHOPPABLE_POSTS` a getter over the setting with the constant as fallback and
stamps `min_shoppable_posts` onto the invitation row (one more column, so later changes never move a live
collaboration).

**Page.** `Packages/brand-web/app/admin/settings/platform/page.js`, modelled on `settings/payments`: three
rows (name, value field, unit, plain description with the range and the never-retroactive sentence), Save,
the audit line. Nav entry under SETTINGS (`admin/layout.js:55-59`) with `cap: 'settings'`. Routes: read on
`requireAnyAdminRole`, write on `requireCapability('settings')` — the existing catalog entry
(`config/adminCapabilities.js:66`) covers it; its label should mention platform settings.

---

## 11. Frontend plan

**Creator app** (Collabs stack): N1 `CounterChoiceSheet6` (two options + the counters-left line); N2/N3
`CounterScreen` keyed by Aim, reusing `LockedSetCard5`, `NumberField`, `DeliverablesEditor5`, the usage
chips and `TextField4`, with a new `ChangeLine6` (old struck → new); N4 `MoveRequestScreen` with
`DateField` (earliest offered date = today + 7, item 4's rule, Q7), the two "what doesn't suit" options,
the verbatim explanation; N5/N6 `ThreadScreen` with a new `TurnCard6` (mine grey surface, theirs
outlined), `RoundPill6`, the state box, the invitation as the last card, Accept / Decline; N12 three more
states on `InvitationCard5` (agreed-waiting, kept = your move, closed); N17 the pool line on
`InvitationScreen`; N19 the "aren't taking counters" line when `canCounter` is false for that reason.
`CounterSoonScreen` is deleted.

**Brand app** (Campaigns stack): N7 `BrandThreadScreen` (same `TurnCard6`, Accept / Counter back /
Decline, the hint); N8 `BrandCounterSheet6` with the minimum box (`MinBox5`) and the last-counter line; N9
decline confirm with the optional reason (`ConfirmSheet` + `TextField4`); N10/N11 the move request in the
thread with three buttons and the confirm listing the three consequences; N13 the pool row at the top of
`BrandCampaignsScreen` (`:41-44`); N14 `BrandPoolScreen` grouped, selectable, Aim-mismatch greyed, days
left, "closing soon" amber under 7 days (Q8); N15 `BrandSetEditScreen` with a `prefill` param and the
banner; N16 `BrandCreatorTermsScreen` with the green "Filled in from what you agreed" line and the hint;
N18 `SwitchRow` on `BrandCampaignNewScreen` and a row in the campaign ⋯ menu; N20 the "Your move" group
first in `BrandSetDetailScreen`; N21 the four endings as a sentence on the thread.

**Admin web:** N22 as in §10.

**New components:** `TurnCard6`, `ChangeLine6`, `RoundPill6`, `StateBox6`, the pool list row, the
move-request screen. **Reused unchanged:** everything from items 2–5. **No native module.**

---

## 12. Test baseline and the tests to add

Baseline after item 5 (one clean full run, 13 Sep): **229 failed / 940 passed / 1169** (47 failed suites of
112). Mobile 459 / 459. Item 6 must add none. Suites touching this ground: `negotiations.test.js`,
`contracts.test.js` (auto-create on agreed), `item5-invitations.test.js` (deferred grouping, Counter
hidden), `item4-campaigns-sets.test.js` (expiry job, cross-set with deferred), `collab-spine.test.js`
(`pending_negotiations`), `campaigns.test.js:292` (`allow_negotiation` on PATCH).

Tests to add (backend): the snapshot per Aim through the validator from both sides with item 5's messages;
no-change refused; rounds: limit 2 → third counter refused, last-round flags; the stamped limit survives a
setting change; accept rewrites all four columns, `answered_at`, outcome, notification, draft contract;
creator decline with the five reasons, brand decline with the note the creator sees; the switch: off →
counter refused and `canCounter` false, open thread continues, back on works; cutoff: counter and accept
refused after it, set-expiry closes the thread with `expired` and both notified, thread still readable;
move request: once, no round, allowed with the switch off, kept leaves the invitation acceptable, agreed
→ `deferred` + pool entry, counts honest; the pool: brand-level across campaigns, grouped, mixed Aims
refused, set-defaults, send from the pool marks used and re-checks eligibility, expiry and the 7-day
notice, remove / leave; admin settings: ranges, audit rows, cache bust; Needs You one side per thread;
404 for another brand / creator / non-admin; privacy regex on every creator payload. Mobile: the thread
renders newest first with the invitation last and change lines; the last-round warning; the counter
choice; the move screen; the pool screen; the switch; N19.

---

## 13. Questions for the founder

Each with my recommendation. Q1–Q4 shape the migration.

**Q1. Reuse `deferred` as the terminal "moved to the pool" status, or add `pooled`?** *Recommendation:
reuse `deferred`.* Item 5 already made it a non-waiting, never-expired, non-blocking group named "Asked
for another date"; the only change is the label ("Moved to your pool") and that it is now written when the
brand agrees, not when she asks. A pending request keeps her current status and appears under "Your move".

**Q2. Whose move: keep it stored.** The engine already stores `current_turn` and enforces it with a tested
`WRONG_TURN`; deriving it would remove a working guard for no benefit. *Recommendation: keep stored,
written on every turn.*

**Q3. Where does the brand's decline of a counter leave the invitation?** *Recommendation:
`rejected_by_brand`* (exists, dead, groups under Declined) with the brand's note on the turn; the creator's
decline stays `declined` with one of the five reasons. Both are re-invitable before the cutoff.

**Q4. A move request while already negotiating?** *Recommendation: allowed once per invitation from
`invited` or `negotiating`*; it does not touch the thread. If the brand agrees while a thread is open, the
thread ends as `expired`-style "moved to the pool" — propose a fifth outcome `moved`.

**Q5. Retire `payment_config.allow_commission_negotiation`?** v1.17 §7 says commission is negotiable; this
platform-wide gate (`018:12-13`) would let the admin contradict it. *Recommendation: stop reading it in
the counter path; leave the column.*

**Q6. The switch does not govern the move request.** *Recommendation: agreed with the prompt.* It is not a
counter and changes nothing in the set.

**Q7. Earliest date offered on the move request.** *Recommendation: today + 7 in India* (item 4's lead
time), since the brand will build a set for it; dates before the current posting date are allowed.

**Q8. Pool entries with fewer than 7 days left.** *Recommendation: an amber "Closing in {n} days" line and
one notification to both sides at 7 days*; nothing else.

**Q9. Should the admin rounds setting also drive pitch negotiation's `counter_rounds_per_side`?** The
rules say pitches use the same general model, but the pitch cap is per side and lives in handshake
settings. *Recommendation: not in item 6; note it for item 8.*

**Q10. Reminders for a waiting reply (§25 "Needs You with reminders").** *Recommendation: one reminder at
48 hours of silence and one at 7 days, notifications only, never a decline*; the cadence is not in the
rules and is mine.

**Q11. Should the accepted-counter path keep drafting a contract?** Item 5's plain accept does.
*Recommendation: yes, the same call, so item 7 finds the same thing whichever way the terms were agreed.*

**Q12. Minimum shoppable posts stamped on the invitation.** To make the setting non-retroactive it must be
copied at send. *Recommendation: one more column `min_shoppable_posts` on the invitation, written at send,
read by the creator's screen; item 7 copies it into the agreement.*

### The twelve assumptions from the prompt
1. A counter is an answer — holds; withdraw already refuses it; `answered_at` to be written. 2. One
negotiation per invitation, thread kept — holds (unique constraint; nothing deletes turns). 3. Whole
snapshot per turn — holds by design (§7). 4. Accepting rewrites the invitation; the agreement reads it —
holds (§7; item 7 confirmed). 5. Limit stamped at start — holds (§9). 6. A move costs no round and is not
governed by the switch — holds; Q6. 7. Pool is brand-level and blocks nothing — holds; the entry is a row in
its own table and nothing in the send path reads it as a block. 8. Always a fresh invitation with
eligibility re-checked — holds; item 5's batch send is the only door. 9. Entries expire at the lifetime and
the creator is told — holds (§8). 10. The 48-hour auto-decline is retired — holds (§9). 11. Scope, offer,
Aim and shoppable posts never negotiable — holds; the validator drops them. 12. Nothing moves money —
holds; no write touches wallets or escrow.

---

## 14. Phase 2 in one line

Migration 182, the platform-settings service and page, the snapshot and rounds on the engine, the six
thread endpoints, the move request and answer, the pool with its send hook, the switch on the screens,
the job changes and the seven notification keys; then the creator and brand screens; then tests.
