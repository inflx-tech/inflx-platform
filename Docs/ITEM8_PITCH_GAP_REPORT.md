# Item 8 — the creator's pitch
## Phase 1 gap report

Read-only survey, 15 September 2026. Nothing was changed, no migration was run, no production row was
written, and nothing was created, sent, accepted or rejected anywhere. Sources, in order of authority:
rules doc **v1.21 §8** (rewritten) with §7B (amended), §8A, §5, §5B, §7, §7A, §9, §24, §25, §30, §31;
the **locked mockups T1–T14** and their rules table; and the item 8 gap-check prompt.

---

## 1. Summary

| Area | Status | The gap in one line |
|---|---|---|
| The pitch table | **P** | `influencer_proposals` exists with 31 columns and **zero rows in production**. It carries the money but not the mode as a requirement, and has no response deadline, no limits and no link to a pool entry. |
| Who may pitch | **E** | `canCreatorPitchBrand` is built, tested and already wired into the live send path. This is not a gap. |
| The pitch form | **M** | No screen. The only pitch affordance in either app is a disabled button that shows "Pitching brands is coming soon." |
| Limits (1 per Aim, 3 per brand) | **M** | Today's limits are different ones: 5 active, 3/day, 10/week, hardcoded in the service rather than read from settings. |
| The response period | **C** | `influencer_proposals.expires_at` is written at send and **read by nothing**. No job expires a pitch. A pitch occupies a slot forever. |
| Reminders at 7 and 21 days | **M** | No reminder exists on the pitch path at all. |
| The cooldown | **P** | `proposal_cooldowns` already exists with the right shape and is already written on rejection at 30 days. It needs to become admin-controlled and stamped. |
| Negotiation | **C** | Two engines. The pitch has its own per-side round cap in a second settings table; item 6's thread cannot attach to a pitch because `negotiations.campaign_influencer_id` is NOT NULL, UNIQUE and foreign-keyed. |
| Acceptance | **C** | Accepting a pitch creates a `collab_agreements` row, not a pool entry. The rules now say a pool entry and nothing else. |
| The pool | **P** | `brand_creator_pool` can already take a pitch-born entry with no migration — but it has no way to say the entry came from a pitch, which T11 requires. |
| The brief path | **C** | `invite` with an `agreement_id` **skips item 2's eligibility entirely** and can jump a creator to accepted with a contract on her signing queue in one call. This is the path item 8 replaces. |
| Her settings on the way back | **M** | §7B's new rule (her pitch outranks her own settings for a matching set) exists nowhere in code. |
| Admin numbers | **C** | Two parallel settings tables. Item 6's `platform_settings` has an admin page and an audit trail; `handshake_settings` has neither and **no editor at all**. |
| Notifications | **P** | Five `proposal.*` keys exist and all four of their deep-link screens were deleted. |
| Admin | **M** | A moderation queue exists in the backend with no page. |
| Production data | **E** | 0 pitches, 41 brand requests, 22 agreements, 8 invitations all born through the brief path, 0 pool entries, 0 negotiation threads. |

**The one-sentence verdict.** Item 8 is less a build than a consolidation: the front door is genuinely
missing, but almost everything behind it exists twice — two negotiation engines, two settings tables,
two cooldown tables, and a second route into a collaboration that bypasses the checks item 2 built.
The hard engineering question is a single database constraint, and the hard product question is what
happens to the eight invitations and twenty-two agreements that came through the door being closed.

---

## 2. Requirement table

Status: **E** exists · **P** partial · **M** missing · **C** conflicts.

| ID | Requirement | St | Evidence | Proposed change | Risk |
|---|---|---|---|---|---|
| D1.1 | Creator, brand, Aim on a pitch | **E** | `migrations/025_influencer_proposals.sql:44-48` | keep | — |
| D1.2 | Terms per Aim, item 5's shapes and validator | **P** | `proposed_fee`, `proposed_commission_pct`, `proposed_deliverables` (`025:49-51`); validated by a **second** model, `collabTerms.model`, not `invitationTerms.validateTerms` | route the pitch through `invitationTerms.validateTerms(goal, terms, {mode:'strict'})` — it is a pure function with no database, no set and no cutoff, so it works unchanged | Low |
| D1.3 | When she could post | **P** | `proposed_posting_window_start/_end` (`025:52-53`) — a window, not a date | replace with one `proposed_go_live_date date NOT NULL` | Low |
| D1.4 | How she'd work | **P** | `shoot_mode text CHECK IN ('visit','shipment')` (`169:109-112`) — added by item 2 and deliberately left **optional** "until item 8 makes it mandatory" | make it NOT NULL on new rows | Low |
| D1.5 | Message, required, ≤ 500 | **P** | `pitch_message text NOT NULL` (`025:47`) — no length rule anywhere | add a CHECK and the exact message | Low |
| D1.6 | `response_due_at` stamped at send | **C** | `expires_at timestamptz NOT NULL` is written (`proposal.service.js:273`) from a hardcoded `PROPOSAL_TTL_DAYS = 7` and **read by nothing** | rename in meaning: stamp from the new admin number, and enforce it | Medium |
| D1.7 | Status vocabulary | **P** | `status text NOT NULL DEFAULT 'sent'`, **no CHECK**, vocabulary in a comment (`025:55-56`) | add the CHECK with the seven states the rules name | Low |
| D1.8 | Answered at / by | **P** | `brand_response_at` exists; there is no "by" | add `answered_by uuid` | Low |
| D1.9 | Rejection reason + cooldown end | **P** | `brand_response_message` holds the reason; `proposal_cooldowns.cooldown_until` holds the date, in a separate table | keep the table, stamp the date on the pitch too so one read serves the screen | Low |
| D1.10 | The pool entry acceptance created | **M** | acceptance writes `collab_agreements`, not a pool entry | add `pool_entry_id uuid` on the pitch | Medium |
| D2 | What a pitch may contain, per Aim | **P** | the columns exist; nothing enforces "no follower offer, no usage rights, no deliverables on Hybrid" | item 5's validator already refuses deliverables on Hybrid and never reads an offer | Low |
| D3 | Who may pitch, checked on send | **E** | `collabEligibility.canCreatorPitchBrand` (`collabEligibility.service.js:271`), already called at `proposal.controller.js:149-154` | keep; make `mode` required | — |
| D3b | Only the Aims and modes that brand accepts, offered on the form | **P** | `pitchSummaryFor` (`collabEligibility.service.js:460`) already returns them, and the brand overview already shows them | expose on the form endpoint | Low |
| D4.1 | One open pitch per brand per Aim | **M** | nothing enforces it | a partial unique index does it in the database | Low |
| D4.2 | At most three open to one brand | **M** | today's limit is 5 active **across all brands** (`proposal.service.js:101`) | one counting query at send | Low |
| D5.1 | Response period, admin, 30 days | **C** | 7 days, hardcoded (`proposal.service.js:26`), unenforced | new `platform_settings` key | Medium |
| D5.2 | Reminders at 7 and 21 days | **M** | none | two nullable stamps plus a job lane, exactly as item 6's silence reminders | Low |
| D5.3 | Early close when her date nears | **M** | none | item 4's floor already exists — `setShape.earliestGoLiveDay` and `campaignState.INVITE_CUTOFF_DAYS = 3`; the pitch rule is a different seven-day number and needs naming | Medium |
| D5.4 | Withdraw at any time | **E** | `POST /influencers/me/proposals/:id/withdraw` | keep | — |
| D6 | Negotiation is item 6's engine | **C** | `negotiations.campaign_influencer_id` is `NOT NULL`, `UNIQUE`, FK `ON DELETE CASCADE` (`001:284`) — a pitch thread cannot be inserted at all | see §5 | **High** |
| D7 | Acceptance creates a pool entry and nothing else | **C** | `handshake.acceptIntoAgreement` writes `collab_agreements` (`handshake.service.js:407-418`) | replace with `pool.create` | Medium |
| D8 | Cooldown, admin, stamped, per brand | **P** | `proposal_cooldowns (influencer_id, brand_id, cooldown_until, reason)` with a composite primary key — exactly the right shape; written at `proposal.service.js:335-341` from a hardcoded 30 | make the number an admin setting and stamp it | Low |
| D9 | Her settings not applied against her for a matching set | **M** | nothing implements it | a flag on the pool entry plus one branch in item 5's send | Medium |
| D10 | Privacy | **E** | three coarse reason codes only (`collabEligibility.service.js:32-36`); thresholds never leave the server, proved by `item3-privacy.test.js` | keep | — |
| D11 | Legacy data | **P** | see §12 | no backfill | Medium |

---

## 3. What already exists, in detail

### 3.1 The tables — five of them, and a sixth for the diary

| Table | Rows in production | What it is |
|---|---|---|
| `influencer_proposals` | **0** | the creator's pitch — 31 columns, added by migration 025 and grafted by 138, 152 and 169 |
| `brand_collab_requests` | **41** (22 agreed, 5 declined, 14 expired) | the brand's mirror-image approach to a creator |
| `collab_agreements` | **22** (19 ready, 2 consumed, 1 expired) | what accepting either of the above produces |
| `proposal_cooldowns` | 0 | her cooldown after a rejection, `(influencer_id, brand_id)` |
| `brand_request_cooldowns` | 1 | the mirror |
| `handshake_settings` | 1 | a second settings singleton — eleven numbers, no admin page |

### 3.2 The half that is already dead
The brand→creator side of this machine **was disconnected on 2 September** in the THE CUT work:
`src/routes/handshake.routes.js` and `src/controllers/handshake.controller.js` no longer exist. The
service, the tables, the cron and the settings survived. Nine of `handshake.service.js`'s fourteen
exports now have no caller at all. Its live surface is three functions: `termsFromProposal`,
`acceptIntoAgreement` and `consumeAgreement`.

### 3.3 The pitch's own negotiation — the second engine
A per-side round cap, two counters and a `counter_by` column live on `influencer_proposals`
(`152:121-125`). The cap comes from `handshake_settings.counter_rounds_per_side`, default 2, enforced
at three places. It is a different number, in a different table, from item 6's
`platform_settings.negotiation_rounds`, and item 6 does not read it.

**Two asymmetries worth recording.** The brand's counter on a pitch never validates against the
creator's requirements, while her counter-back does. And a pitch's `expires_at` is written at send and
read by nothing: there is no job, no query and no status transition. A pitch sits open forever and
permanently occupies one of her five active slots.

### 3.4 The brief path — the one item 8 replaces
`POST /campaigns/:id/sets/:sid/invite` with an `agreement_id` does four checks — the agreement exists
and belongs to this brand, it is for this creator, it is still `ready`, and its Aim matches the set —
and then **skips item 2's eligibility entirely**. I verified the code:

> `// ── Item 2 eligibility — skipped for a briefed agreement (settings are never retroactive). ──`
> `if (!agreement_id) { … canBrandInviteCreator … }`

So with an agreement, her paused switch, her blocks, her accepted Aims and modes, her brand categories
and her minimums are all bypassed. A creator who blocked the brand *after* agreeing can still be
briefed into a set.

Then, if nothing drifted from the agreed terms, `readyToSignIfSettled` creates the contract
`{ ready: true }` and writes `status = 'accepted'` on the invitation. That is the only place in the
product where a creator lands on her signing queue with no brand send step.

**All eight invitations in production came through this door** — every one has an `agreement_id` and
`source = 'pitch'`.

### 3.5 Keep, rewire, retire

| Part | Verdict |
|---|---|
| `influencer_proposals` | **rewire** — the table is right in shape and empty in production, so it can be reshaped freely |
| `brand_collab_requests`, `brand_request_cooldowns`, the dead half of `handshake.service` | **retire** — already unreachable over HTTP |
| `collab_agreements` | **retire as a destination**; the pool replaces it. Seven live readers branch on `campaign_influencers.agreement_id` and need a plan |
| `handshake_settings` | **retire** into `platform_settings`, which has the page and the audit |
| the per-side round cap | **retire** → item 6's stamped `round_limit` |
| the pitch's unenforced `expires_at` | **rewire** into a real response deadline |
| `proposal_cooldowns` | **keep** — right shape, right key, already written |
| item 2's settings, blocks and eligibility | **keep** — built and tested |
| `collab_events` (the diary) and `/v1/collab-diary/*` | **keep**, re-anchored |
| the brief path | **retire** — see §6 |

---

## 4. Link readiness

| Link | Ready? | Detail |
|---|---|---|
| **Item 2: the brand's pitch settings** | **Ready** | `brand_pitch_settings` holds all nine controls. `canCreatorPitchBrand({influencerId, brandId, aim, mode})` returns `{ok, reason}` with exactly three coarse codes, and the past-creator bypass skips only the private filters, never paused or blocked. It is already called on send. |
| **Item 2: her invitation settings** | **Ready** | `GET /influencers/me/invitation-settings` already returns `minFeeEngagement`, `minFeeHybrid` and every `minCommissions` row, so the pitch form's hints need no new endpoint. One caveat: picking the commission that applies to a particular brand needs `minCommissionFor`, which is server-side only, so item 8 either exposes it or resolves it on the form endpoint. |
| **Item 3: the brand list** | **Ready, with a duplication to fix** | `GET /influencers/me/find-brands` already returns a per-brand status of `OK` / `NOT_ACCEPTING` / `NOT_MATCHING` and already defaults `canPitchOnly` to true. But that status is a **SQL reimplementation** of `canCreatorPitchBrand` inside the list query, and the service header says so. Two implementations of one rule set is exactly the drift item 8 should not add to. |
| **Item 3b: her numbers** | **Ready, not wired** | `socialAccounts.brandView(influencerId)` is precisely the brand-facing, privacy-filtered shape T5 and T6 need. No pitch payload attaches it today. Note "not measured" has three different renderings in the codebase — null in the metrics layer, omitted in the brand view, coerced to 0 in eligibility. T5 needs the dash. |
| **Item 6: the negotiation engine** | **Not ready** | The single blocker in §5. |
| **Item 6: the old pitch negotiation** | **Not ready** | It is a parallel machine, described in §3.3. Retiring it touches three enforcement sites, one settings table and one cron. |
| **Item 6: the pool** | **Almost ready** | `pool.create` already treats all three provenance columns as optional, so a pitch can deposit into the pool today with no migration. What it cannot do is *record* that the entry came from a pitch — there is no `from_pitch_id` and no source discriminator, so T11's **PITCH** tag has nothing to read. `markUsed` requires an invitation id, which is correct: exit is always via an invitation. |
| **Item 6: platform settings** | **Ready** | Five keys, a 60-second cache, one audit row per changed key, and an admin page that is entirely data-driven — adding a number is a migration insert plus two entries in the service, with no page edit. |
| **Item 5: the send path** | **Ready** | `campaign_influencers.source` already allows `pool`. It also allows `pitch`, but that value currently means "briefed agreement" and sits on the eight legacy rows, so reusing it would blur the reporting. |
| **Item 5 / 7: the brief path** | **Not ready** | §3.4 and §6. |
| **Item 7: the agreement** | **Ready** | An invitation born from a pool entry is an ordinary invitation. Item 7 reads the invitation and nothing else, so nothing changes. |
| **Item 24: Needs You** | **Not ready** | The creator's `counters_to_answer` inner-joins `campaign_influencers` and filters `status = 'negotiating'`, so a pitch thread would be silently invisible. The brand's `pending_negotiations` reaches the brand only through the campaign, so a pitch thread would never be counted. Both need explicit widening. |
| **Notifications** | **Partly ready** | Five `proposal.*` keys exist, and **all four of their deep-link screens were deleted** — a pitch notification today opens nothing. No reminder or expiry key exists on the pitch path. |
| **Admin** | **Not ready** | Two admin endpoints exist for a moderation queue with no page. |
| **Existing production data** | See §12 | |

---

## 5. The one-engine question

This is the heart of the item, so here it is precisely.

### What blocks it
`negotiations.campaign_influencer_id` is `uuid NOT NULL`, foreign-keyed to `campaign_influencers`
with `ON DELETE CASCADE`, and `UNIQUE`. **A pitch-anchored thread cannot be inserted at all today.**
I confirmed all three properties against production.

### What is already generic
The turn mechanics do not care what the thread hangs off. `negotiation_turns` references only
`negotiation_id`. So do `normalizeSnapshot`, `canon`, `termsLine`, `changesBetween`, `turnsOf`,
`roundLimitOf`, `endThread`, both turn inserts, the turn-order guard, the round derivation and the
whole turn-shaping block that builds the thread response. Item 5's terms validator is a pure function
that needs only the Aim string — and `influencer_proposals.goal` already carries the same three values.

### What is invitation-specific
`loadContext` is the choke point: one query with five inner joins, reaching the brand only through the
campaign. Everything downstream consumes the flat object it returns. Ten of the fields it supplies
have no pitch equivalent, and three of those change behaviour rather than merely display:

- **the set's posting date**, which is the only input to the cutoff;
- **the campaign's negotiation switch**, which a pitch has no campaign to read;
- **the open-group flag**, which carves out a whole branch.

Beyond that, four write-backs assume an invitation row exists: the counter's status change, the
accept's four-column rewrite onto the invitation, the decline's two status writes, and the contract
auto-create. And two whole functions — the move request and the move answer — are meaningless without
a set to move away from.

There is also a quiet trap. The cutoff guard returns early when there is no posting date, so **a pitch
thread would pass every deadline check and stay open forever**, and neither the expiry job nor the
reminder job could ever see it: both inner-join the invitation.

### The options

**A. Generalise the anchor.** One migration: make `campaign_influencer_id` nullable, add `pitch_id`,
replace the inline unique with two partial unique indexes, add a CHECK that exactly one anchor is set.
Then a sibling `loadPitchContext` returns the same field names with the invitation-only ones null, and
a small strategy object handles the four write-backs. The move request and the two jobs stay
invitation-only; the pitch gets its own expiry lane off its own deadline.

*Cost:* one migration on a table with **zero production rows**; one new context loader; four branches;
widening two Needs You counters. Roughly 60% of the engine is reused untouched.

**B. A parallel pitch thread.** Two engines, which the rules explicitly forbid: "Pitch negotiation
uses the same mechanism as an invitation."

**C. Create a placeholder invitation for every pitch.** Needs a set, which needs a posting date, which
is the thing the brand has not decided yet. It also puts a creator into a campaign before anyone
agreed to one. Wrong on the product as well as the plumbing.

**Recommendation: A.** It is the only one the rules allow, the table is empty in production so the
migration is free, and the split falls along a line the code already has — everything downstream of
`loadContext` consumes a flat object and does not know where it came from.

---

## 6. The retirement plan

In this order, because each step removes the reason for the next.

1. **Stop the brief path creating invitations.** The moment the pitch flow deposits into the pool,
   nothing new needs `agreement_id`. Switch the door off with a message, as item 4 did with the invite
   button and item 7 did with Approve & Send.
2. **Retire the pitch's own negotiation** — the per-side cap, the two round counters and `counter_by`
   — once threads attach to a pitch.
3. **Retire `collab_agreements` as a destination.** Acceptance writes a pool entry instead. The 19
   `ready` rows stay exactly where they are.
4. **Retire `brand_collab_requests` and `brand_request_cooldowns`** — already unreachable, nothing to
   switch off.
5. **Fold `handshake_settings` into `platform_settings`**, which has the page and the audit.
6. **Delete the dead half of `handshake.service`** — nine exports with no caller.

### What breaks, honestly
Seven live readers branch on `campaign_influencers.agreement_id`, and they keep working for the eight
existing rows. What stops happening for *new* rows:

- the refusal that stops a creator re-negotiating terms she already agreed;
- the contract's production mode being pre-filled from the agreed mode — this was a real bug once and
  a contract exists for its fix;
- the publish-gate blockers that check an agreement is live;
- the settled-terms line on her invitation.

Each needs a pool-entry equivalent, and the pool entry carries the same agreed terms, so each is a
rewire rather than a loss.

Four QA specs and one jest suite assert the brief path's exact source text and will need rewriting to
the new truth. One spec — the handshake routes one — has been red since 2 September and asserts
seventeen routes that no longer exist.

---

## 7. Proposed migrations

**Next free number: 184.** The highest applied is 183 (item 7, live).

### 184 — the pitch, the thread anchor, and the two admin numbers
```
-- A. The thread can hang off a pitch (the one blocker).
ALTER TABLE negotiations ALTER COLUMN campaign_influencer_id DROP NOT NULL;
ALTER TABLE negotiations ADD COLUMN pitch_id uuid REFERENCES influencer_proposals(id) ON DELETE CASCADE;
ALTER TABLE negotiations DROP CONSTRAINT negotiations_campaign_influencer_id_key;
CREATE UNIQUE INDEX uq_neg_ci    ON negotiations (campaign_influencer_id) WHERE campaign_influencer_id IS NOT NULL;
CREATE UNIQUE INDEX uq_neg_pitch ON negotiations (pitch_id)               WHERE pitch_id IS NOT NULL;
ALTER TABLE negotiations ADD CONSTRAINT negotiations_one_anchor
  CHECK ((campaign_influencer_id IS NOT NULL) <> (pitch_id IS NOT NULL));

-- B. The pitch as item 8 needs it.
ALTER TABLE influencer_proposals
  ADD COLUMN proposed_go_live_date date,
  ADD COLUMN response_due_at       timestamptz,
  ADD COLUMN response_days         int,
  ADD COLUMN reminder_7d_sent_at   timestamptz,
  ADD COLUMN reminder_21d_sent_at  timestamptz,
  ADD COLUMN answered_by           uuid REFERENCES users(id),
  ADD COLUMN cooldown_until        timestamptz,
  ADD COLUMN cooldown_days         int,
  ADD COLUMN pool_entry_id         uuid REFERENCES brand_creator_pool(id) ON DELETE SET NULL,
  ADD COLUMN closed_reason         text;
ALTER TABLE influencer_proposals ADD CONSTRAINT proposals_message_len
  CHECK (char_length(pitch_message) <= 500) NOT VALID;

-- One OPEN pitch per brand per Aim; three per brand is a counting query.
CREATE UNIQUE INDEX uq_pitch_open_per_aim ON influencer_proposals (influencer_id, brand_id, goal)
  WHERE status IN ('sent', 'viewed', 'countered');
CREATE INDEX idx_pitch_due ON influencer_proposals (response_due_at)
  WHERE status IN ('sent', 'viewed', 'countered');

-- C. The pool learns where an entry came from (T11's tag).
ALTER TABLE brand_creator_pool
  ADD COLUMN from_pitch_id uuid REFERENCES influencer_proposals(id) ON DELETE SET NULL,
  ADD COLUMN matched_shoot_mode text;

-- D. The two admin numbers join item 6's page.
INSERT INTO platform_settings (key, value, min_value, max_value, unit, label) VALUES
  ('pitch_response_days',  30, 7, 90, 'days', 'Pitch response period'),
  ('pitch_cooldown_days',  30, 0, 90, 'days', 'Pitch rejection cooldown')
ON CONFLICT (key) DO NOTHING;
```

**Dry-run checks to print:** pitches by status; brand requests by status; agreements by status;
invitations with an `agreement_id`; invitations by source; negotiation threads and turns; pool entries
by state; **and whether any brand-and-creator-and-Aim triple already has two open pitches**, since the
new unique index would fail on one. Production has zero pitches, so it will not.

**No backfill.** Nothing is invented for an old row, and the twenty-two agreements are left untouched.

---

## 8. Proposed endpoints

| ID | Method and path | Status | Notes |
|---|---|---|---|
| E1 | `GET /influencers/me/find-brands` | **extends** | Add a cooldown end date per brand. The status chip already exists. |
| E2 | `GET /brands/:id/pitch-form` | **new** | The Aims and modes that brand accepts, plus her own minimums resolved for this brand's categories. |
| E3 | `POST /influencers/me/pitches` | **replaces** `POST /influencers/me/proposals` | Validates settings, limits, cooldown and terms through item 5's validator; stamps `response_due_at`. |
| E4 | `GET /influencers/me/pitches` | **replaces** the list | Grouped with the deadline, the state, the reason and the cooldown date. |
| E5 | `POST /influencers/me/pitches/:id/withdraw` | **extends** | Keep; no cooldown. |
| E6 | `GET /brands/me/pitches` | **replaces** | Grouped New / Talking, with her numbers from `socialAccounts.brandView`. |
| E7 | `GET /brands/me/pitches/:id` | **replaces** | Her profile, numbers, terms, message, deadline, what it can do now. |
| E8 | `POST /brands/me/pitches/:id/accept` | **rewires** | Creates a pool entry and nothing else. |
| E9 | `POST /brands/me/pitches/:id/reject` | **extends** | Optional reason ≤ 200, stamps the cooldown, tells her the date. |
| E10 | `…/pitches/:id/thread`, `/counter`, `/accept`, `/decline` both sides | **extends item 6** | The same service, with a pitch as the subject. |
| E11 | job: reminders at 7 and 21 days, expiry, early close | **new lane** | Hourly, modelled exactly on item 6's silence reminders. `:50` and `:20` are taken; `:35` is free. |
| E12 | the two admin numbers | **extends** | Item 6's page is data-driven; no page edit. |

Error codes: none new. `VALIDATION_ERROR`, `NOT_ACCEPTING`, `NOT_MATCHING`, `NOT_FOUND`, `FORBIDDEN`,
`LOCKED` cover every message in §7 of the prompt.

---

## 9. The limits and the cooldown, in one query each

- **One open pitch per brand per Aim** — the partial unique index above. The database refuses it; the
  service catches the violation and returns the exact message. No read needed.
- **Three open per brand** — one `count(*)` over the same partial-index predicate at send.
- **The cooldown** — `proposal_cooldowns` is keyed `(influencer_id, brand_id)`, so it is a primary-key
  lookup. Stamping the date on the pitch as well lets the list screen show it without a second query.
- **What happens when a brand blocks or unblocks after a rejection:** blocking is checked first and
  reports `NOT_ACCEPTING`, so the cooldown becomes invisible while a block stands and reappears
  afterwards if it has not lapsed. That is the right behaviour and needs no extra code.

---

## 10. Frontend plan

**Creator.** The Pitches segment makes no API call today and renders a "Pitch a brand" card whose
button already navigates to a screen that exists. The pitch button on the brand overview is disabled
and shows a "coming soon" toast. New: a three-step pitch form (T2, T3, T4), a pitch card, her pitches
list (T13, T14), and the green line on the invitation (T12). The thread (T10) is item 6's screen
unchanged.

**Brand.** The Pitches segment is one line rendering a hardcoded empty state. New: the pitches list
(T5), one pitch (T6), the accept confirm (T7) and the reject sheet (T8). The thread (T9) and the pool
(T11) are item 6's screens, the pool needing only a provenance tag and a "Not available" group.

**Reused, all of it already built:** brand and creator cards, the three-number stat tile, the
deliverables editor, the date field, turn cards and the round pill, state boxes, the base sheet and
confirm sheet, chips, skeletons, empty and error states, the text field with a counter, checkbox rows,
and item 5's terms-draft state machine, which is the right shape for a pitch form's terms block.

**Genuinely new:** the pitch form, the pitch card, the cooldown box and the provenance tag. Four small
things.

**No native module.** Item 8 is forms and lists; everything ships over the air. Item 7's file-viewing
limitation is untouched and unaffected.

---

## 11. Test baseline and what item 8 adds

**Measured after item 7 shipped: 229 failed / 1024 passed / 1253.** No backend source has changed
since, so this is current.

Existing suites that touch this ground: `brief-to-signing.test.js` (asserts the brief path's exact
source text, so it changes when the path is retired), `collab-diary.test.js` (**already dead** — it
drives endpoints deleted on 2 September), `collab-spine.test.js`, `collab-terms-time.test.js`,
`item2-eligibility.test.js` and `item2-settings-api.test.js` (both keep working),
`item6-negotiation.test.js` (its `negRow` helper addresses threads by invitation id and will need a
pitch sibling), and `item5-invitations.test.js`, which asserts **globally** that no negotiation row
exists in one test — that breaks the first time a pitch thread is created in the same world.

**The creator-pitch HTTP surface has zero jest coverage today.** Seventeen endpoints, none tested
outside `qa/`.

New: `backend/tests/item8-pitch.test.js` for checks 1–32, with weight on the limits, the cooldown, the
one-engine thread, and the proof that accepting creates a pool entry **and nothing else** — no
campaign, no set, no invitation, no contract, no money. Plus `item8Creator.test.js` and
`item8Brand.test.js` for the screens.

---

## 12. Production data, and what legacy rows will show

| Fact | Value |
|---|---|
| pitches (`influencer_proposals`) | **0** |
| brand requests | 41 — 22 agreed, 5 declined, 14 expired |
| agreements | 22 — 19 ready, 2 consumed, 1 expired |
| negotiation threads / turns | **0 / 0** |
| invitations with an `agreement_id` | **8** |
| invitations by source | 8, all `pitch` |
| pool entries | **0** |
| cooldown rows | 0 creator-side, 1 brand-side |
| `brand_pitch_settings` rows | 0 — every brand is on defaults |
| `creator_invitation_settings` rows | 1 |

**What this means.** The creator-pitch table is empty, so item 8 can reshape it freely and the new
unique index cannot fail. Item 6's negotiation engine has never been used in production, so
generalising its anchor is free. The pool is empty, so a new provenance column starts clean.

**The nineteen `ready` agreements are the only real legacy question.** They are terms two parties
agreed and nobody briefed. On the new screens they would show nowhere, because the brand's
ready-to-brief list was already deleted and the pool will not contain them. Three honest options: leave
them to expire on the existing ninety-day clock, show them read-only somewhere, or convert them to pool
entries. **Recommendation: leave them.** Converting invents a pool entry nobody asked for, with a
lifetime nobody agreed to, out of an agreement that may be months old. See Q6.

**No backfill anywhere**, and nothing invented.

---

## 13. Questions, each with a recommendation

**Q1. Generalise the thread anchor?** §5 recommends option A — nullable `campaign_influencer_id` plus
a `pitch_id`, two partial uniques and a one-anchor CHECK. **Recommendation: yes.** The rules require
one engine, the table is empty in production, and the split falls along a line the code already has.

**Q2. What is a pitch thread's deadline?** An invitation thread ends at the set's cutoff. A pitch has
no set, and the cutoff guard returns early when there is no posting date — so a pitch thread would
stay open forever and no job could see it. **Recommendation: the pitch's own `response_due_at` is the
thread's deadline too**, and the early close when her proposed date nears applies to the thread as
well. Otherwise a brand can counter once and freeze her indefinitely.

**Q3. What does "negotiation off" mean for a pitch?** The campaign switch has no campaign to live on.
**Recommendation: the switch does not apply to a pitch.** A brand that does not want pitches pauses
pitches; that control already exists and is the right one.

**Q4. Reuse `source = 'pitch'` on the invitation, or add a new value?** `pitch` already exists and
already means "briefed agreement" on the eight legacy rows. **Recommendation: keep `pool` for an
invitation sent from a pool entry — it is the truth — and record the pitch provenance on the pool
entry**, which is where T11 reads it. That leaves the eight legacy rows unambiguous.

**Q5. Retire the brief path, or switch it off?** The prompt's check 28 asks which. **Recommendation:
switch it off with a message, do not delete it.** The eight existing invitations keep working, seven
readers keep reading, and the code stays available if the twenty-two agreements need handling later.
Deleting it is a separate, later cleanup.

**Q6. What happens to the nineteen ready agreements?** **Recommendation: leave them to expire.** See
§12. If you would rather they were honoured, say so and I will convert them to pool entries with a
fresh lifetime, but that invents terms nobody re-agreed.

**Q7. `handshake_settings` — fold it in or leave it?** Eleven numbers, no admin page, no audit, and
one of them duplicates item 6's round limit. **Recommendation: move the two numbers item 8 needs into
`platform_settings` and leave the rest of the table alone for now**, dead but harmless. Folding all
eleven is a bigger job than item 8.

**Q8. The brand list's duplicated eligibility rule.** The pitch status on the brand list is a SQL
reimplementation of `canCreatorPitchBrand`, and the service says so itself. Item 8 makes that list the
front door, so the drift matters more. **Recommendation: leave the SQL for the list, add a test that
pins the two implementations to the same answer for a set of fixtures.** Rewriting the list to call
the function per row would be an N+1 on a paged list.

**Q9. The five `proposal.*` notifications deep-link to four screens that no longer exist.**
**Recommendation: retire those five keys and add a `pitch.*` namespace** — `pitch.sent`,
`pitch.countered`, `pitch.agreed`, `pitch.rejected`, `pitch.withdrawn`, `pitch.reminder`,
`pitch.expired`, `pitch.closed` — pointing at the new screens, following the `noun.verb_past`
convention every other namespace uses.

**Q10. The admin moderation queue has a backend and no page.** `GET /admin/proposals` and the
suspension endpoint exist. **Recommendation: out of scope for item 8, flagged.** The flagging path
still works; nobody can see it.

**Q11. Where does the pitch's seven-day early close come from?** Item 4's floor is a posting date at
least seven days ahead, and the invitation cutoff is posting minus three. The pitch rule is a third
seven. **Recommendation: reuse item 4's `earliestGoLiveDay` constant** so a pitch can never propose a
date a set could not be built for, rather than introducing a fourth number.

**Q12. Confirming §11's twelve assumptions.** All twelve are consistent with the rules and with what
the code can support. The two that need your explicit yes are number 2 (the brief path is retired —
see Q5, where I recommend switching off rather than deleting) and number 3 (pitch negotiation is item
6's engine, which costs the migration in §7).

---

## 14. What I have not done

No code was changed, no migration was run, no production row was written, and nothing was created,
sent, accepted or rejected. The only production access was read-only `SELECT` for the counts in §12.

**Stopping here for your approval**, as the prompt requires.
