# Item 5 — Choosing creators, terms and invitations: gap report (Phase 1)

Read-only survey against rules doc **v1.15** (§7A new; §4, §5, §5A, §5B, §6, §7, §8A, §9, §15, §15.1,
§21, §25, §28), the locked mockups **I1–I15** with their rules table, and the item 5 gap prompt. Code read
as it stands after item 4 (`5e5cfe0`, evidence commit `e8537a3`). Nothing was changed, sent, invited or
approved. Date: 12 September 2026.

Every `file:line` below is under `backend/`, `Packages/Mobile/src/` or `Packages/brand-web/` and was
re-read against the working tree. The offer engine is covered in full in
`Docs/OFFER_ENGINE_SURVEY.md`; this report cites it rather than repeating it.

---

## 1. Summary

| Area | Status | The gap in one line |
|---|---|---|
| The invitation row | Partial | 41 columns already carry fee, commission, selling scope, deliverables, offer and dates. Missing: sent/answered times, who sent it, where it came from, the personal note, usage rights, withdraw/remove marks. |
| Statuses | Partial | Twelve values exist and cover waiting, negotiating, accepted, signed, declined and expired. **No withdrawn, no removed.** The brand's cancel writes a value the enum rejects and always fails. |
| Terms validation | Missing | No numeric rule on fee or commission anywhere; no deliverables minimum before signing; no Hybrid fixed-fee rule; no note length. |
| Eligibility for a set | Partial | The item 2 check is complete and already reads the set's Aim, mode and branch city, but only one creator at a time. There is no batch check and no per-set check for a group. |
| Minimums | Ready on the server, invisible on the phone | Minimum fee per Aim and minimum commission per Aim and category exist; the warning codes exist; nothing shows them to the brand. |
| The picker | Ready to reuse | Discover already has a select mode with checkboxes, disabled rows and labels; the group add-creators screen is the template. |
| Sending | Partial | One creator per request, through a 400-line handler with every gate inline. Nothing sends N at once. |
| Locking the set on send | Ready, derived | Item 4 derives "live" and the lock from the existence of any invitation row, so the first send locks the set with no extra write. |
| Cutoff | Ready | Item 4 refuses invites after posting date − 3 days, India time, end of day. |
| Withdraw and remove | Missing | No working path. |
| Creator's side | Missing on the phone, legacy on the server | The Collabs tab is four empty states. Legacy inbox, accept, decline and counter endpoints exist and work, but the detail leaks the campaign brief and budgets. |
| Counter | Ready to hand off | A one-thread negotiation model exists with no round limit; item 5 only needs to know when Counter is allowed. |
| Contracts | Gap for item 7 | The contract copies fee and posting date only. Deliverables, usage rights, selling scope, note and offer cannot reach it today. |
| Offers | Ready, two fixes | Library or bespoke, snapshotted on attach, one offer per basket, commission on the discounted price. The sale forgets the offer; the start date is ignored. |
| Minimum shoppable posts | Missing entirely | No setting, no constant, no column, anywhere. |
| Notifications | Partial | New-invitation, accept and decline keys exist; the decline carries no reason; withdraw's notification is broken. |
| Websites | Confirmed off | Item 4's invite switch-off is in place; no website screen edits terms or cancels an invitation. |

**Verdict in one sentence.** The row, the eligibility rules, the picker, the offer engine and the set
lock are all there and reusable; what item 5 must build is a batch send with real terms validation,
withdraw and remove, and both phone surfaces, and it must add a handful of columns and two status
values first.

---

## 2. Requirement table

Status key: **E** exists, **P** partial, **M** missing, **C** conflicts with the code today.

### 2.1 The invitation row (D1)

| Field | St | Evidence | Proposed change |
|---|---|---|---|
| Set, campaign, creator | E | `set_id` NOT NULL → sets (`001_initial_schema.sql:232`); campaign through the set; `influencer_id` NOT NULL (`:233`). Production: 0 rows without a set | None |
| One row per creator per set | P | No unique index. Same-set duplicates are only refused by the cross-set query (`campaign.controller.js:1302-1311`) | Add a partial unique index on `(set_id, influencer_id) WHERE status NOT IN (dead)`; see §5 |
| Status | P | 12-value enum (`001:21-23`, `038:10-12`, `167:37`) | Add `withdrawn`, `removed`; see §9 |
| Invited at | P | Only `created_at` (`001:243`) | Add `invited_at` (the send moment; equals created_at for new rows) |
| Answered at | M | Nothing | Add `answered_at` |
| Invited by | M | Nothing | Add `invited_by uuid → users` |
| Source | M | Nothing | Add `source text` ∈ `brand_picker, group, pitch, open_group, legacy` |
| Group it came from | M | Nothing | Add `source_group_id uuid → influencer_groups ON DELETE SET NULL`, never in any creator payload |
| Personal note ≤ 300 | M | No column; the nearest is a post-hoc contract clause (`pdf.service.js:196-199`) | Add `brand_note text` with a 300-character rule in code |
| Withdrawn / removed at / by | M | No column, no status (`grep withdrawn\|removed` over migrations: none on this table) | Add `withdrawn_at`, `withdrawn_by`, `removed_at`, `removed_by` |
| Decline reason + text | P | `declined_reason varchar(100)` (`001:240`), `declined_note text` (`163:26`); codes `not_relevant, fee_too_low, schedule_conflict, already_partnered, other` (`offer.controller.js:68-74`); note sliced to 1000 (`:270`) | Adopt the five codes from the mockups (map old ones), cap text at 200 on the new path; see §9 |

Three columns have **no writer at all** and can be ignored: `post_date` (`002:26`, no reader either),
`contract_signed_at` and `brand_signed_at` on this table (`001:241-242`; the real values are on
`contracts`).

### 2.2 Terms by Aim (D2, D3, D4)

| Field | St | Evidence | Proposed change |
|---|---|---|---|
| Commission % required, > 0, ≤ 100, one decimal | P | `commission_pct numeric(5,2)` (`001:238`); **no numeric validation anywhere** in `invite` or `updateInfluencer`; no ceiling enforced | Validate in one terms validator; the column allows two decimals, round to one |
| Selling scope | E | `alloc_scope` + `alloc_category_node_id` + `alloc_category` + `alloc_product_ids` (`148:60-67`), validated by `resolveAllocation` (`campaign.controller.js:1043-1096`): scope vocabulary, node exists, products owned and pushed to store | Reuse. The "empty list" messages from §7 are new |
| Follower offer | E | see §8 | Reuse |
| Minimum shoppable posts, read-only | M | Does not exist: no setting, constant or column (`grep` across `backend/` for `min_posts\|MIN_SHOPPABLE\|shoppable` finds only a discovery filter, `influencer.controller.js:692`). Audits agree (`Docs/BACKEND_DB_AUDIT_2026-09-09.md:156`) | Show a code constant of 1 now; the admin setting is a later item. Q4 |
| Fee required, whole rupees, > 0 | P | `agreed_fee numeric(10,2)` (`001:235`); written at invite (`:1402`) and **not editable by `updateInfluencer`** (`:1622-1645` has no `agreed_fee`); no validation | Validate; make the new send path the only writer |
| Deliverables ≥ 1 row, type ∈ 5, count 1–20, no duplicate type | P | Per-creator `formats_json` (`166:55`), shape `[{type,count}]`, types `reel, post, story, youtube_video, youtube_short` (`campaign.controller.js:678`), `assertValidFormats` (`:679-692`) checks type and count ≥ 1 only. **No minimum-one rule until brand-sign** (`contract.controller.js:582`), no maximum, no duplicate check | Enforce all four rules at send for Pay for Content |
| Note ≤ 300 | M | see D1 | `brand_note` |
| Usage rights (off; duration 30/60/90/forever; ≥ 1 place) | M | No column on the row or the contract. Only `collab_agreements.terms_json.usage {commercial, extra}` (`collabTerms.model.js:196-209`), which nothing copies forward | Add `usage_rights_json` `{ on, duration_days \| null, places[] }` |
| Payment split 25/25/50 | E | `payment_config.tranche_1_pct / tranche_2_pct / tranche_3_pct` (production row present); the brand-sign lock and tranches at `contract.controller.js:491-561`, `tranche-3-release.job.js:62` | Read for display; never write |
| Hybrid: fixed fee > 0 plus every Pay for Sale field | P | The row can hold both `agreed_fee` and `commission_pct`; nothing validates the pair. Production has hybrid sets but no hybrid rows | One validator, one rule set per Aim |

### 2.3 The rest of §4

| ID | Requirement | St | Evidence | Proposed change |
|---|---|---|---|---|
| D5 | Follower offer: none / saved snapshot / special | E | `resolveOfferAttachment` (`campaign.controller.js:981-1027`) copies type and config from `brand_offers` onto the row; inline offers run the same validator (`offerConfig.validator.js:262-297`) | Reuse. Gaps A and B in §8 |
| D6 | Groupings | P | Statuses map cleanly except withdrawn/removed. See §9 | Two new values |
| D7 | Counts | E | `campaignState.countsForSets` (`campaignState.service.js:76-96`), one grouped query; invited counts everyone, signed by both signatures, waiting = `invited, applied, accepted, negotiating, deferred` and unsigned, declined = `declined, expired` | Reuse unchanged. Withdrawn/removed fall into invited only, which matches item 4's line |
| D8 | Decline reason required, text optional, both visible to the brand | P | Reason required and validated (`offer.controller.js:263-267`); note stored; brand sees them only through `SELECT ci.*` (`campaign.controller.js:426, 629`); the decline notification omits both (`offer.controller.js:314-322`) | New codes, 200-character cap, surface both in A9/A10 and the notification |
| D9 | Withdraw / remove | M | `cancelInfluencer` (`campaign.controller.js:2359-2451`) writes `'cancelled'` at `:2403`, a value the enum does not contain, so it **always fails**. Its notification passes `user_id` where the service wants `userId` (`:2438` vs `notification.service.js:26`). A decline deletes an unsigned contract deliberately (`offer.controller.js:291-297`) | Replace with withdraw and remove; see §7 |
| D10 | Terms never edited after send; the set locks on first send | P | `updateInfluencer` is draft-campaign-only (`:1535-1537`) but still lets a brand edit a sent row on a draft campaign, and silently NULLs nine fields it does not receive (`:1654-1656`). The set lock is derived: `describeSet` calls a set live and locked when any row exists (`campaignState.service.js:126-131, 147`) and `assertSetEditable` refuses the four fields (`:200-209`) | Refuse edits on any sent row; keep the derived lock |
| D11 | Who may be picked, and when | P | Eligibility is per pair (`collabEligibility.service.js:340-404`) and reads `set.goal`, `set.shoot_mode`, `set.branch_id` (`:351, :355, :373`). The cutoff refusal exists (`campaignState.assertCanInvite`, called at `campaign.controller.js:1163-1166`) but is **skipped for a set with no date** (`:1163`). Re-invite after a dead row is allowed by `NON_BLOCKING_STATUSES` (`campaignState.service.js:60`) | Batch check; add withdrawn/removed to the non-blocking list; require a date for every new send |
| D12 | Batch semantics | M | Nothing sends more than one | §7 |
| D13 | Copy terms to everyone; draft location | M | Nothing; the deleted wizard's in-memory draft survives as `utils/campaignDraft.js` (`setCreatorTerms :159`, `invitePayload :271`) | App-only draft; §10 |
| D14 | Privacy | C | The creator's legacy detail returns `c.brief`, `c.total_budget`, `cs.set_budget`, `cs.per_influencer_budget`, `cs.coupon_prefix` (`offer.controller.js:1029-1051`) at any status; the inbox returns `cs.budget` and `cs.per_influencer_budget` (`:104-118`). Brand-facing eligibility returns coarse codes only (`collabEligibility.service.js:44-53`); blocked and paused are indistinguishable (`:345-348`) | New creator endpoints with a clean payload; patch the two legacy leaks. Q7 |
| D15 | Legacy data | E | See §5 | No backfill |

### 2.4 API (§5)

| ID | Endpoint | St | Today | Change |
|---|---|---|---|---|
| A1 | Pickable creators for a set | P | `GET /brands/me/discover-creators` (`discovery.routes.js:21`, `discovery.service.js:109-185`) returns rows with a **brand-level** status only; its header says set-level rules are item 5's (`discovery.service.js:17`) | New overlay endpoint under the set; see §6 |
| A2 | Worked-with for a set | P | `GET /brands/me/worked-with` (`discovery.controller.js:55-89`), derived from contracts signed by both, no eligibility on rows | Same overlay |
| A3 | Group members checked against a set | M | `GET /brands/me/influencer-groups/:id` (`influencerGroup.controller.js:206-235`) computes the same brand-level status; no set check anywhere | New |
| A4 | Batch eligibility with warnings | M | One pair at a time (`collabEligibility.service.js:340`) | New `canBrandInviteMany` |
| A5 | Saved offers for the picker | E | `GET /brands/me/offers` (`brandOffer.controller.js:41-71`) | Reuse; add a one-line summary in the app |
| A6 | Offer preview | E | `POST /campaigns/preview-basket` (`campaign.controller.js:1741-1817`) takes an unsaved offer, a commission and up to 20 products, returns shopper pays and creator earns | Reuse unchanged |
| A7 | Create a saved offer | E | `POST /brands/me/offers` (`brandOffer.controller.js:80-124`) | Reuse |
| A8 | Send invitations | M | `POST /campaigns/:id/sets/:sid/invite` sends one (`campaign.controller.js:1119-1524`) | New batch endpoint wrapping the same gates; §7 |
| A9 | Set with its creators, grouped | P | `GET /campaigns/:id/sets/:sid/summary` (item 4) has counts and state, no creators; `GET /campaigns/:id/sets` has raw rows | Extend the set summary with a `creators` block |
| A10 | One invitation, brand view | M | Nothing shaped for it | New |
| A11, A12 | Withdraw, remove | M | `cancelInfluencer` broken | New |
| A13 | Creator's invitations list | P | `GET /offers/inbox` (`offer.controller.js:83-125`) exists, legacy shape, leaks budgets, unwhitelisted `status` filter can 500 | New clean endpoint |
| A14 | One invitation, creator view | P | `GET /offers/:id` (`:1025-1092`) leaks the brief and budgets | New clean endpoint |
| A15 | Accept | E | `POST /offers/:id/accept` (`:131-222`): `invited` only, auto-creates a draft contract on handpick, notifies the brand | Reuse behind the new path; add `answered_at`, the cutoff refusal and the exact messages |
| A16 | Decline | P | `POST /offers/:id/decline` (`:228-326`) | Same, with the new codes and cap |
| A17 | Counter hand-off | E | `POST /offers/:id/negotiate` (`:418-561`) opens the one thread; refuses when an agreement exists, negotiation is off, or open group | Placeholder screen; expose `canCounter`; write nothing. §7 |

---

## 3. What already exists, in detail

### 3.1 The invitation row
`campaign_influencers` has 41 columns from twelve migrations. Everything item 5 needs to *price* a
collaboration is already there: `agreed_fee`, `commission_pct`, the four `alloc_*` columns, `offer_type`
and `offer_config_json` with `brand_offer_id`, `offer_valid_from/until`, per-creator `formats_json` and
`channels_json`, `posting_date`, `coupon_code`, `agreement_id` for the pitch path, and the four
`deferred_*` columns. What is not there is everything about the *invitation as an event*: when it was
sent, by whom, from which door, the note, the answer time, and the two brand-side exits.

### 3.2 Every door that creates a row
`grep "INSERT INTO campaign_influencers"` finds two in production code and two in seed scripts.

1. **`invite`** (`campaign.controller.js:1119-1524`). Fourteen gates in order: ownership, creator id, the
   item 4 cutoff (skipped for a dateless set), channels and formats, eligibility (skipped when an
   `agreement_id` is briefed), agreement validity, allocation, the selling-set allocation gate,
   engagement purity, conversion needs offer or allocation, creator exists, the cross-set guard with
   `NON_BLOCKING_STATUSES`, the engagement budget, coupon. Then the insert with status `invited`, an
   optional ready-to-sign shortcut that creates a contract and sets `accepted` (`:1482-1498`), the
   `offer.invited` notification (`:1501-1515`) and the rollup. **No numeric validation of fee or
   commission anywhere in it.**
2. **Open-group broadcast** inside publish (`:185-268`): writes five columns, runs no eligibility, no
   cutoff, no allocation gate. Out of scope for item 5, listed because it bypasses every rule below.
3. **Pitch (item 8):** accepting a pitch no longer creates a row. It creates a `collab_agreements` row,
   and the brand later invites with `agreement_id`, which consumes the agreement in the same transaction
   (`:1432`). In production **all eight rows carry an `agreement_id`**: this was the only door in use.
4. Seeds: `seed-fashion-test-world.js:208`, `seed-practice-world.js:362`. Dev only.

### 3.3 The creator's actions today
Under `/offers` (`routes/index.js:161`), creator role: inbox, detail, accept, decline, defer, negotiate.
Accept flips `invited → accepted` (or `applied` for open groups) and auto-creates a draft contract on
handpick. Decline needs a valid reason code, stores an optional note up to 1000 characters, and deletes
an unsigned contract. Defer records a counter-day or mode and sets `deferred`. Negotiate opens the single
thread and sets `negotiating`. None of them checks the set's cutoff. None of them writes an answer time.

### 3.4 Negotiation, for item 6
One thread per row, enforced by a UNIQUE constraint (`001:284`). Turns hold fee, commission, deadline
and a note only (`001:294-302`, `018:9`). Both sides respond with counter / accept / walkaway
(`offer.controller.js:568-804`); a 48-hour clock is reset on every counter and the expiry job closes a
silent thread as declined (`negotiation-expiry.job.js:41-65`). **There is no two-round limit** anywhere;
the "two rounds" in the rules doc is not implemented. Item 5 should not touch any of this.

### 3.5 Contracts, for item 7
`contract.service.autoCreate` (`contract.service.js:51-187`) writes ten columns and copies exactly two
terms from the row: the fee and the posting date. Commission, scope, offer, deliverables, channels and
dates are re-joined at read time, not snapshotted. Item 5's new terms would not reach a contract at all:
no column for a deliverables list, usage rights, selling scope, the personal note or the offer snapshot.

### 3.6 Eligibility and minimums
`canBrandInviteCreator` (`collabEligibility.service.js:340-404`) is exactly the §8A rule set: paused or
blocked → `NOT_ACCEPTING` (indistinguishable), Aim, mode, brand category and, since item 4, the set's own
branch city → `NOT_MATCHING`; then the two soft warnings. Minimum fee lives per Aim on
`creator_invitation_settings.min_fee_engagement / min_fee_hybrid`; minimum commission per Aim and brand
category on `creator_min_commissions (influencer_id, aim, category_code, pct)` with `ALL` as the
fallback row (`169_item2_pitch_invitation_settings.sql:77`), matched to the brand's sub-categories by
`minCommissionFor` (`:415-426`, lowest matching rate wins). The brand app never shows any of it: the only
outward signal is `eligibility_warnings` on the invite response (`campaign.controller.js:1523`), which
no screen reads, and the profile's `inviteSummary` deliberately carries no numbers
(`influencer.controller.js:921-966`).

### 3.7 The picker components
`DiscoverList` has a documented select mode (`components/discovery/DiscoverList.js:68-71, 111-123`) with
`selectedIds`, `disabledIds`, `disabledLabel` and `capacityLeft`, rendering `CheckboxRow` + `MemberRow`.
`BrandGroupAddCreatorsScreen.js:73-74` uses it with two tabs and a footer button. That screen is the
template for I1. Group member status for I2 comes from the same brand-level CTE the group screen already
uses (`influencerGroup.controller.js:213-232`).

### 3.8 The set as item 4 left it
`describeSet` (`campaignState.service.js:122-157`) returns state, lock flags, cutoff, days to cutoff and
`canInvite {ok, reason, message}`; `assertCanInvite` (`:220-224`) refuses with the exact messages;
`countsForSets` gives the four counts; `set-expiry.job.js:48-53` flips every `OPEN_STATUSES` row to
`expired` at the cutoff. The set detail screen's "Add creators" is a "Coming soon" toast
(`BrandSetDetailScreen.js:104, 122`) and does not yet read `set.canInvite`.

**What item 5 keeps:** all of §3.1, §3.6, §3.7, §3.8, the offer engine, the accept/decline handlers'
internals, and the negotiation model untouched. **What it extends:** the row (columns and two statuses),
the send path (batch, validation, event columns), the set summary (creators block). **What it leaves
alone:** the open-group broadcast, the pitch consume path, contracts, negotiation, publish.

---

## 4. Link readiness

| Link | Verdict | Evidence and what item 5 must do |
|---|---|---|
| Item 2 eligibility | **Ready per creator, not per batch** | Service and codes in §3.6. Reads the set's Aim, mode and branch city. No list function: `discovery.service.statusForCreators` (`:89`) is brand-level and says so. Item 5 adds `canBrandInviteMany(brandId, set, [{influencerId, terms}])` returning per creator `{ok, reason, warnings, minimums}`. Blocked and paused already look identical to the brand |
| Item 2 minimums | **Ready to read** | Tables in §3.6. Item 5 exposes them through A4 only, to the brand, never to the creator |
| Item 3 Discover | **Ready** | Endpoint, filters, sort, paging and select mode in §3.7. Select mode needs one more disabled reason ("Can't invite") beside "Invited"; both map onto `disabledIds` + `disabledLabel` if the list accepts a per-row label |
| Item 3 Worked with | **Ready** | `GET /brands/me/worked-with`, contracts signed by both (`discovery.controller.js:64-71`). Rows carry no eligibility; the overlay adds it |
| Item 3 groups | **Partial** | Tables and member endpoint exist; the per-member status is brand-level (`influencerGroup.controller.js:213-232`). I2 needs the set-level batch check applied to the member list |
| Item 3b social numbers | **Ready** | Discover rows already carry `instagram`, `youtube`, `engagement`, `measuredAt` (`discovery.service.js:188-211`); "—" is the app's job |
| Item 4 the set | **Ready** | Everything in §3.8. The lock is derived from row existence, so the first send locks the set with no extra write, and every door that inserts a row locks it, including the open-group broadcast |
| Item 4 cutoff | **Ready** | `cutoffFor` (`campaignState.service.js:34`), `assertCanInvite` (`:220`), `indiaDay.js` helpers (`:128-139`). One hole: `invite` skips the check for a dateless set (`campaign.controller.js:1163`). The new send path must require a posting date |
| Item 4 cross-set | **Confirmed** | `NON_BLOCKING_STATUSES = ['declined','expired','rejected_by_brand','slots_filled','deferred']` (`campaignState.service.js:60`), used at `campaign.controller.js:1302-1311` and `:231-236`. Item 5 adds `withdrawn` and `removed` to the same list |
| Item 4 expiry job | **Ready, one question** | Flips `invited, applied, accepted, negotiating, deferred` to `expired` (`set-expiry.job.js:48-53`). Item 5's statuses fit. Open point: a `deferred` creator is also "moved out"; expiring her may be wrong. Q5 |
| Item 6 negotiation | **Ready to hand off** | §3.4. Hand-off: the new creator detail returns `canCounter` computed from the four existing refusals (`agreement_id`, `campaigns.allow_negotiation`, `influencer_mode`, an existing thread); the Counter button opens a placeholder; item 5 writes nothing to `negotiations`. Deliverables, usage rights and scope are **not counterable** today, because turns carry fee, commission, deadline and note only |
| Item 7 agreement | **Gap named** | §3.5. Five item 5 terms cannot reach a contract: deliverables list, usage rights, selling scope, personal note, offer snapshot. Item 7 must add them or read them from the row at generation |
| Item 8 pitches | **Diverges, unchanged** | An agreed pitch becomes a `collab_agreements` row and is briefed into a set through `invite` with `agreement_id`, which **skips eligibility** by design (`campaign.controller.js:1178-1182`) and can jump straight to `accepted` with a contract (`:1482-1498`). It satisfies the cutoff and cross-set rules, bypasses the terms rules item 5 adds unless the batch send is also the brief door. Recommend: keep the legacy single invite for briefing only, and route it through the same terms validator. Q6 |
| Item 9 / 21 money | **Confirmed clean** | Nothing in invite, accept, decline, defer, negotiate or cancel moves money. Publish checks a balance only (`campaign.controller.js:1980-1983`). The only lock is brand-sign (`contract.controller.js:491-517`). Split from `payment_config` |
| Items 15 / 15.1 offers | **Ready, two fixes** | `Docs/OFFER_ENGINE_SURVEY.md` §2–§4; fixes in §8 below |
| Items 13 / 20 shoppable posts | **Missing** | No minimum anywhere (§2.2). Constant 1 shown read-only; admin setting later |
| Item 19 Home | Serve from `countsForSets` | Already grouped per set; a per-brand roll-up is `sumCounts` |
| Notifications | **Partial** | One `send()` writes in-app plus push; SMS is a deliberate no-op (`notification.service.js:157-163`). Keys: `offer.invited` (`campaign.controller.js:1501`), `offer.accepted` / `offer.declined` (`offer.controller.js:187, 314`), `negotiation.turn`. Missing: a working withdraw key, a removal key, the reason on the decline |
| Websites | **Confirmed off** | `false && showInvite` present once in `app/dashboard/influencers/[id]/page.js`. No website screen edits terms or cancels an invitation; offers are edited only on the Products → Offers tab |

---

## 5. Production data (read 12 September 2026)

| | Count |
|---|---|
| Invitation rows | **8**: 3 active, 2 invited, 2 contracted, 1 completed |
| Rows without a set | 0 |
| Rows with terms but no contract | 2 (both `invited`) |
| Accepted rows with no contract | 0 |
| Rows created through the pitch/brief path (`agreement_id` set) | **8 of 8** |
| Rows with a library offer, a promoted list, an inline offer | 0, 0, 0 |
| Rows with a selling scope | 6 (5 store, 1 category) |
| Rows with deliverables (`formats_json`) or channels | 0, 0 |
| Decline reasons or notes | 0 |
| Rows whose set is expired | 0 |
| Contracts | 6: 5 `active`, 1 `pending_brand`; **only 1 signed by both** (seeded rows carry `active` without signatures) |
| Negotiations / turns | 0 / 0 |
| Deliverables rows | 1 |
| Creator invitation settings rows | 1 (one creator has ever set them) |
| Agreements (`collab_agreements`) | 19 ready, 2 consumed, 1 expired |
| Library offers | 2, both store-wide percentage discounts, unattached |
| Notification types ever sent | `offer.invited` 3, `collab_request.*` 60, contract keys 3 |

Legacy consequence (D15): every existing row would read as an invitation with terms but no note, no
deliverables and no offer, in the grouping its status implies. Six sets have no posting date, so their
rows cannot expire and the picker cannot open on them until a date is chosen (item 4 already shows that).
No backfill is needed and none is proposed. The 'cancelled' bug has never fired in production because
no one has used the brand-side cancel.

---

## 6. Proposed endpoints

New endpoints answer 404 for another brand or another creator (item 4 rule); existing ones keep their
codes. All under `/v1`.

| ID | Method and path | Notes |
|---|---|---|
| A1, A2 | `GET /campaigns/:id/sets/:sid/pickable?tab=all\|worked&search&filters…&page` | Runs the item 3 query for the tab, then overlays per row `canInvite`, `reason` (coarse), `inSet` (`none \| live \| dead`). The overlay is the batch check on the page's 20 ids |
| A3 | `GET /campaigns/:id/sets/:sid/group-check/:groupId` | `{ can: [...], cannot: [{ creator, label }], counts: { can, cannot, total } }` with the three labels |
| A4 | `POST /campaigns/:id/sets/:sid/eligibility` `{ creators: [{ influencerId, fee?, commissionPct? }] }` | Per creator `{ ok, reason, warnings, minimums: { fee, commissionPct } }`. Minimums go to the brand only |
| A5, A7 | existing `/brands/me/offers` | unchanged |
| A6 | existing `POST /campaigns/preview-basket` | unchanged; the app picks the example product |
| A8 | `POST /campaigns/:id/sets/:sid/invitations` `{ creators: [{ influencerId, terms, offer, note }], sourceGroupId? }` | One action; §7 |
| A9 | extend `GET /campaigns/:id/sets/:sid/summary` with `creators: { waiting[], negotiating[], accepted[], signed[], declined[], expired[], withdrawn[] }` | Rows carry name, avatar, a terms summary, the date, the chip and `actions: { withdraw, remove, viewTerms }` |
| A10 | `GET /campaigns/:id/sets/:sid/invitations/:ciId` | Full terms as sent, offer snapshot, note, timeline |
| A11 | `POST /campaigns/:id/sets/:sid/invitations/:ciId/withdraw` | `invited` only → `withdrawn` |
| A12 | `POST /campaigns/:id/sets/:sid/invitations/:ciId/remove` | any pre-signed status → `removed`; refused once both signatures exist |
| A13 | `GET /influencers/me/invitations?tab=invites\|done` | Clean payload: brand, campaign and set names, Aim, mode, city, date, money line, cutoff, days left, status |
| A14 | `GET /influencers/me/invitations/:ciId` | Set block, personal block, deliverables, usage rights, offer name, note, cutoff, `canCounter`. **Never** brief, budgets, group, warnings |
| A15, A16 | `POST /influencers/me/invitations/:ciId/accept` and `/decline` | Wrap the existing handlers' internals, add the cutoff refusal, `answered_at`, the new decline codes |
| A17 | none | Counter opens a placeholder; `canCounter` from A14 |

**Callers affected.** Nothing on the websites calls any of these. The legacy `invite` keeps its callers
(the pitch brief path and 15 test suites). `cancelInfluencer` has no live caller and can be repointed at
withdraw. The mobile client gains the new methods; the legacy `influencerApi.getOffers…` block has no
caller today.

**Error codes.** `VALIDATION_ERROR` with `field` and the exact §7 message; `INVITE_CLOSED` for the three
set-level refusals; `NOT_ACCEPTING` / `NOT_MATCHING` (403, existing) for ineligible; `CONFLICT` for a
live duplicate; `LOCKED` for edits to a sent row; `NOT_FOUND` for another brand or creator.

---

## 7. Send design

**One request, all or nothing.** "Send 3 invitations" is one action on the mockup and one toast
afterwards. The recommendation is a single transaction: revalidate everything first, and if anything
fails, write nothing and return the full list of per-creator problems so the brand can fix them on
Review and press Send again.

1. **Set-level, once:** the set must have a posting date, must not be expired, must not be past its
   cutoff (`assertCanInvite`, India end of day). Failure refuses the whole batch with the exact message.
2. **Per creator, all collected before any write:** approved and active; passes `canBrandInviteMany`
   for this set (a creator who became ineligible since picking → "{Name} can no longer be invited to
   this set."); no live row in this set or, per the cross-set rule, elsewhere in the campaign ("{Name}
   is already in this set."); terms valid for the set's Aim with the §7 messages; offer valid through
   the existing validator; note ≤ 300.
3. **Write, in one transaction:** one row per creator through a single extracted service function that
   the legacy `invite` also calls, so the fourteen gates live once. Set `invited_at`, `invited_by`,
   `source`, `source_group_id`, `brand_note`, `usage_rights_json`, the offer snapshot, and status
   `invited`. The first row makes the set live and locked by derivation; nothing else is written to the
   set. Recompute the rollup once.
4. **After commit:** one `offer.invited` notification per creator, then return `{ sent: n, rows: [...] }`.
5. **Cutoff passing mid-request:** the set-level check runs inside the transaction with the set row
   locked `FOR UPDATE`, so a batch that started before the end of the cutoff day and commits after it is
   refused whole. The window is minutes at most, and the message is the normal one.

Why not partial: a half-sent batch leaves the brand unsure which creators were told, the review screen
has no state for "3 sent, 1 failed", and re-sending the failed one is exactly what happens anyway after
fixing. Why not one request per creator from the app: the set-level checks would run N times and the
lock semantics of "the first invitation" become racy.

**Withdraw** (`A11`): allowed only while the row is `invited`; sets `withdrawn`, `withdrawn_at`,
`withdrawn_by`, `answered_at` untouched; no contract exists at that status; notifies the creator with no
reason. **Remove** (`A12`): allowed while no contract has both signatures; sets `removed`; deletes an
unsigned contract the way decline already does (`offer.controller.js:291-297`); refuses with "{Name} has
signed, so she can't be removed here." once both signatures exist. Neither touches money: escrow exists
only after brand-sign. Both are new writes; the broken `cancelInfluencer` is retired.

**Edits after send:** the new path never updates a sent row. The legacy `updateInfluencer` should also
refuse any row that has `invited_at`, with the §7 message, so no door can edit sent terms.

---

## 8. Offer design

The engine is used as it is (`Docs/OFFER_ENGINE_SURVEY.md`).

- **None:** nothing stored.
- **Saved offer:** `brand_offer_id` on the send; the server snapshots type and config onto the row
  (`campaign.controller.js:1003-1005`). Confirmed a snapshot, not a reference: later edits to the library
  change nothing live; the id is kept for reporting.
- **Special offer:** inline `offer_type` + `offer_config_json`, validated by the same validator. Three
  kinds only: `discount` (pct or flat), `volume` (spend or quantity tiers), same-product `bogo`. The
  "applies to" control is hidden for bogo because the engine ignores scope for it (survey §2). Start date
  → `offer_valid_from` defaulting to the posting date; end → `offer_valid_until` or null. "Also save to
  my offers" → `POST /brands/me/offers` first, then attach by id.
- **Preview:** `POST /campaigns/preview-basket` serves I6 and I7 unchanged. It takes the unsaved offer,
  the commission and product ids, and returns `shopper_pays` and `creator_earns`. The app supplies one
  example product from the brand's catalogue.
- **Gap A, the sale forgets the offer:** select `ci.brand_offer_id` in `validateTracking`
  (`transaction.service.js:147-157`) and write it through at `transaction.controller.js:1462-1463`;
  the winning offer's id is already in the resolver result. Two lines, no migration.
- **Gap B, the start date is ignored:** add `offer_valid_from` to `creatorOfferExpired`
  (`offerResolution.service.js:101-103`) and to the two queries that feed it. Ride-along fix, no migration.
- Scope per type, no stacking, and commission on the discounted price are all confirmed in the survey
  (`offer.service.js:141-395`, `offerResolution.service.js:20`, `transaction.controller.js:1403-1409`).

---

## 9. Status map

| Grouping (I9 order) | Existing statuses | Note |
|---|---|---|
| 1 Waiting to answer | `invited`, `applied` | `deferred` too, if she is treated as still in the set. Q5 |
| 2 Negotiating | `negotiating` | item 6 |
| 3 Accepted, waiting for the agreement | `accepted`, and `contracted` / `active` / `completed` **without** both signatures | signature read from `contracts` |
| 4 Signed | any status **with** both signatures (`SIGNED_CONTRACT_SQL`, `collabState.js:57`) | |
| 5 Declined | `declined`, `rejected_by_brand` | |
| 6 Expired | `expired`, `slots_filled` | |
| 7 Withdrawn / removed | **new `withdrawn`, new `removed`** | |

**Two new enum values.** `ALTER TYPE campaign_influencer_status ADD VALUE` cannot run inside a
transaction, so migration 181 does it outside the `BEGIN` block, before the column adds. Every list that
must learn them: `DEAD_STATUSES` (`collabOwedItems.service.js:34`), item 4's `NON_BLOCKING_STATUSES`
and `TERMINAL_STATUSES` (derive from DEAD, so automatic), `familyOf` (`collabState.js:25-38` → ended),
the dead list in `collabStep.service.js:118` (which today names two phantom values), `publishGate`'s
exclusion (`publishGate.service.js:85`), `follower.service.ACTIVE_CI_QUERY` (unaffected: it lists live
statuses), and the offer-expiry job (unaffected: `invited` only). The 'cancelled' write at
`campaign.controller.js:2403` becomes `withdrawn`.

**Decline codes.** Mockup chips: fee too low, dates don't suit, not my kind of brand, too much work,
other. Mapping onto the existing column: `fee_too_low` (same), `schedule_conflict` → "Dates don't suit",
`not_relevant` → "Not my kind of brand", new `too_much_work`, `other` (same); `already_partnered` stays
readable for legacy rows and is no longer offered. Text capped at 200 on the new endpoint; the brand sees
both on A9 and A10 and in the decline notification body.

---

## 10. Frontend plan

**Brand app.** Under the existing Campaigns stack (item 4):

| Mockup | Screen | Built from |
|---|---|---|
| I1 | `BrandSetPickCreatorsScreen` | `BrandGroupAddCreatorsScreen.js` as the template: `SegmentedControl` for the three tabs, `DiscoverList` in select mode on A1, the worked-with list on A2, a groups list opening I2. Needs a per-row disabled label ("Can't invite" vs "Invited") and a footer "Next: terms for {n} creators" |
| I2 | `BrandGroupInviteCheckScreen` | A3 → summary card, `AvatarStack`, the cannot list with `MemberRow` |
| I3–I5 | `BrandCreatorTermsScreen` | One screen keyed by the set's Aim. Locked set card (item 4 pattern), `NumberField` for ₹ and %, `Chip` rows, `PickerSheet` for categories, a product picker (recover `ProductPicker.js`), a **new** deliverables editor, `SwitchRow` for usage rights and for "use for everyone", `TextField4` for the note, a **new** stepper header. Draft lives in app state |
| I6, I7 | `OfferSheet5`, `SpecialOfferSheet5` | Recover `CreatorOfferSheet.js` and `OfferBuilderSheet.js` (its `inline` mode returns a config without saving), restyle to `settingsTokens` as `DateField` was, limit the kinds to three, hide scope for bogo, use `DateField` for the dates, call `previewBasket` for the box |
| I8 | `BrandReviewSendScreen` | Locked set card, warning `Banner`, one row per creator with an "OK / Below min" chip from A4, `PrimaryButton` "Send {n} invitations" → A8 |
| I9 | extend `BrandSetDetailScreen` | The grouped creators block from A9 under the existing counts; hide "Add creators" once `set.canInvite.ok` is false (the screen ignores it today) |
| I10 | `ActionSheet` + `ConfirmSheet` | Existing sheets; a small terms-sent sheet from A10 |

**Creator app.** `CollabsScreen` Invites tab becomes real (A13) with a new `InvitationCard`; `Done`
receives expired and withdrawn cards after a rule (recommend: 7 days after the state change);
`InvitationScreen` (I12, I13) from A14 with two blocks, the fee split from `payment_config`, Accept via
`ConfirmSheet`, Decline via a new `DeclineSheet5` with reason chips, Counter → a placeholder screen. New
route entries in the Collabs stack (`InfluencerNavigator.js:33-43`).

**Reused unchanged:** primitives, sheets, feedback, `SegmentedControl`, `DiscoverList`, `CheckboxRow`,
`MemberRow`, `AvatarStack`, `NumberField`, `DateField`, `bits4` chips and counts, `groupIndian` /
`fmtRupees`. **New:** stepper, deliverables editor, invitation card, decline sheet, per-row disabled
label in select mode. **No native module.** Everything ships over the air.

Housekeeping to do while in the client: `brandApi` declares `listGroups`, `createGroup`,
`renameGroup` and `deleteGroup` twice (`api.js:198-202` and `:234-239`); the later, legacy versions win.

---

## 11. Tests

Baseline, full backend suite after item 4: **229 failed / 914 passed / 1143 total** (47 failed / 64
passed / 111 suites). Item 5 must add none. Whole mobile suite 441 / 441.

Suites that touch this ground and may need fixture or assertion updates: `campaigns.test.js` (invite
tests), `offer-attach.test.js`, `item2-eligibility.test.js`, `item2-settings-api.test.js` (its A7 tests
invite through the legacy path), `negotiations.test.js`, `contracts.test.js` (decline deletes a contract),
`brief-to-signing.test.js`, `collab-spine.test.js`, `item4-campaigns-sets.test.js` (counts and expiry).

Tests to add: the terms validator per Aim with every §7 message; the batch send as one transaction,
including the mid-request cutoff and the became-ineligible case; the derived lock after the first send;
withdraw only while unanswered, remove until both signatures, never after, contract never destroyed;
re-invite after withdrawn; group check labels; batch eligibility with minimums for the brand only; the
creator list and detail payloads containing none of the forbidden fields at any status; accept and
decline with the cutoff refusal and the new codes; Gap A and Gap B; 404 for another brand and creator on
every new endpoint.

---

## 12. Questions for the founder

Each with my recommendation. Q1–Q4 change how the row is stored and should be answered before Phase 2.

**Q1. Two new status values, `withdrawn` and `removed`?** The alternative is reusing `declined` with a
marker column, which would put the brand's actions into the creator's "Declined" group everywhere.
*Recommendation: add both.* Nine lists learn them (§9); the migration adds them outside a transaction.

**Q2. Send as one all-or-nothing action?** *Recommendation: yes*, per §7. The brand fixes the named
creators on Review and sends again.

**Q3. Replace the decline reasons with the five on the mockup?** Today's five differ (§9).
*Recommendation: yes*, keep the old values readable on legacy rows, cap the text at 200.

**Q4. Minimum shoppable posts.** It does not exist anywhere. *Recommendation: a code constant of 1 shown
read-only now*, and an admin setting in the admin-parameters item later, exactly as the audit planned.

**Q5. Deferred creators and the set expiry.** A creator who deferred is "moved out", yet item 4's job
expires her with the set and she counts as waiting. *Recommendation: exclude `deferred` from the expiry
job's open list and from the waiting count*, and show her under the campaign's "Moved out" (item 4's
`GET /campaigns/:id/deferred`) rather than in the set. Small change to item 4's lists.

**Q6. The pitch brief door.** Briefing an agreed pitch skips eligibility by design and can create a
contract instantly. *Recommendation: leave its skip, but route it through the same terms validator* so a
briefed row can never carry invalid terms.

**Q7. The legacy creator endpoints leak the brief and budgets.** They have no app caller today.
*Recommendation: build the new clean endpoints and also strip the five fields from the legacy detail
and inbox*, since it is a privacy rule and a two-line change.

**Q8. Commission ceiling.** Nothing caps it today. *Recommendation: 0 < x ≤ 100 with one decimal*, as the
prompt says; no lower business cap exists in the code to honour.

**Q9. "Use these terms for everyone" copies what?** *Recommendation: money, selling scope, deliverables,
usage rights and a saved-offer choice; never a special offer*, which stays with the creator it was made
for. Each creator can still be changed.

**Q10. The `deferred` and `applied` rows the brand cannot cancel today.** `CANCELLABLE` omits them
(`campaign.controller.js:2383`). *Recommendation: withdraw covers `invited` only, as the rule says;
remove covers every pre-signed status including these two.*

**Q11. Item 7's missing columns.** Deliverables, usage rights, scope, note and offer cannot reach a
contract. *Recommendation: item 5 stores them on the row now, in the shapes above, so item 7 only has to
read them.* Nothing to decide for item 5 itself, but you should know the agreement will need them.

**Q12. Contracts marked active without signatures.** Five seeded contracts say `active` with one or no
signatures. *Recommendation: ignore for item 5*, since signed is always read from the two timestamps.

### The twelve assumptions from the prompt

All twelve hold against the code and the plan above. Three carry a caveat:

1. One invitation per creator per set, re-invitable after a dead row. Holds; the partial unique index
   in §5 makes it a guarantee rather than a query.
2. Terms never editable after sending. Holds once `updateInfluencer` refuses sent rows (§7).
3. A saved offer is snapshotted at send. Confirmed in code.
4. Copy-to-everyone never copies a special offer. Recommended in Q9.
5. The multi-creator draft lives in the app. Recommended; the deleted wizard's draft utility exists.
6. The shoppable-post minimum is a platform setting shown read-only. **It does not exist**; a constant
   stands in. Q4.
7. Usage rights are Pay-for-Content only. Holds; the column is nullable and the validator refuses it on
   the other Aims.
8. India time, end of day. Holds; item 4's helpers.
9. Decline reason required, text optional, brand sees both. Holds after Q3.
10. Withdrawn and removed creators are told plainly, never destroying a contract. Holds by design in §7;
    **the current cancel cannot do any of it** and is retired.
11. Counter routes to a placeholder, no negotiation logic. Holds; `canCounter` is computed from existing
    refusals, and nothing writes to the negotiation tables.
12. Accepting commits nobody. Holds; escrow locks only at brand-sign.

---

## 13. Proposed migration 181 (additive, no backfill)

Outside a transaction: `ALTER TYPE campaign_influencer_status ADD VALUE IF NOT EXISTS 'withdrawn'`, and
`'removed'`.

Inside: on `campaign_influencers` add `invited_at timestamptz`, `answered_at timestamptz`, `invited_by
uuid REFERENCES users(id) ON DELETE SET NULL`, `source text CHECK (source IN
('brand_picker','group','pitch','open_group','legacy'))`, `source_group_id uuid REFERENCES
influencer_groups(id) ON DELETE SET NULL`, `brand_note text`, `usage_rights_json jsonb`, `withdrawn_at`,
`withdrawn_by`, `removed_at`, `removed_by`; a partial unique index on `(set_id, influencer_id)` for rows
whose status is not dead, withdrawn or removed; an index on `(set_id, created_at)` for the set screen.
Dry run prints row counts and confirms the unique index has no violators (production: 8 rows, none
duplicated). Nothing on `contracts`, `brand_offers` or `negotiations`.

---

## 14. Phase 2 in one line

Migration 181, the terms validator and the extracted single-row service, the batch send with withdraw and
remove, the batch eligibility and group check, the two clean creator endpoint families with accept and
decline, the set summary's creators block, the two offer fixes, three notification keys. Then the phone
screens I1–I15, then tests.
