# Item 4 — Campaigns and Sets: gap report (Phase 1)

Read-only survey against rules doc **v1.14** (§4, §5, §5A, §5B, §6, §11.1, §19, §25, §27, §28, §31),
the locked mockups **C1–C11**, and the item 4 gap prompt. Nothing was changed. Date: 12 September 2026.

Order of authority followed: rules doc, then mockups, then prompt. Where the code disagrees with the
rules doc I have written it down rather than guessed, and every such case is a question in §12.

Reviewed line by line on 12 September 2026: every `file:line` citation below was re-read against the
working tree after the first draft, and the corrections from that review are recorded in §14.

---

## 1. Summary

| Area | Status | The gap in one line |
|---|---|---|
| Campaign table | Partial | Has name, brief and a status enum; missing `updated_at` and any link to a creator group. |
| Set table | Partial | Already has the posting date, the cutoff column and the Aim; missing a state, a branch, and both timestamps. |
| Set state machine | Missing | There is no state column and no code that derives one. |
| Posting-date rule | **Conflict** | Code enforces 5 days ahead; rules doc v1.14 says 7. |
| Invitation cutoff | Missing | `invites_close_at` is written by three code paths and read by none. |
| Locks after first invitation | Missing | `updateSet` has no guard at all. A live set's Aim, date and mode can be changed today. |
| Expiry of a set | Missing | No job, no code path, nothing reads a cutoff. |
| Duplicate a set | **Conflict** | The existing duplicate copies every creator. The rules doc says it must copy none. |
| Deletion | Partial | Draft-only on campaigns, but no guard at all on sets, and hard deletes that cascade into signed contracts. |
| Counts for the cards | Missing | Nothing computes invited, signed and waiting. |
| Branches | **Ready** | Table, service and picker endpoint all exist and return what C4 needs. |
| Creator groups | Partial | Groups exist; the campaign has nowhere to record which group it started from. |
| Brand app screens | Missing | The Campaigns tab is a placeholder. Every campaign screen was deleted on 10 Sep. |
| Date picker | **Ready** | A pure-JS month grid already exists and is unit-tested. No native module, so OTA is safe. |
| Websites | No breakage | The website stopped building campaigns and sets. Two side issues to note, neither blocking. |
| Tests | Baseline recorded | 229 failed / 901 passed / 1130. Item 4 must add no new failures. |

**Verdict in one sentence:** the data model is most of the way there and the business rules are barely
started. Item 4 is mainly a rules-and-state job on columns that already exist, plus a brand-app tab
built from components that already exist.

---

## 2. Requirement table

Status key: **E** exists and matches, **P** partial, **M** missing, **C** conflicts with the code today.

### 2.1 Data

| ID | Requirement | St | Evidence | Proposed change | Risk |
|---|---|---|---|---|---|
| D1.1 | Campaign owner, name | E | `migrations/001_initial_schema.sql:200-202`, `name varchar(150)` | Cap at 60 in the service, leave the column | None |
| D1.2 | Description ≤ 200, never shown to creators | P | Column is `brief text` (`001_initial_schema.sql:203`). No length check. Not in any creator payload | Validate ≤ 200. Keep the column name | None |
| D1.3 | Started-from group | M | `campaigns` has no group column. Groups live at `/v1/brands/me/influencer-groups` (`routes/influencerGroup.routes.js:25-34`) over `influencer_groups` | Add `started_from_group_id uuid REFERENCES influencer_groups(id) ON DELETE SET NULL` | None |
| D1.4 | Created and updated timestamps | P | `created_at` exists (`001_initial_schema.sql:208`). **No `updated_at`** | Add `updated_at` plus a trigger | None. Required for "most recently updated first" |
| D1.5 | Campaign state Draft / Live / Completed / Expired | C | Enum `campaign_status` is `draft, pending_wallet, published, active, live, completed, cancelled` (`001_initial_schema.sql:15-17`). No `expired`. `pending_wallet`, `published` and `live` are never written by any code path | **Derive** the item 4 state from the sets. Do not extend the enum | Medium, two vocabularies coexist. See Q2 |
| D2.1 | Set name required, ≤ 60, shown to creators | P | `campaign_sets.name varchar(100) NOT NULL` (`001_initial_schema.sql:219`), required at `controllers/campaign.controller.js:706-708`, no length check | Validate ≤ 60 | None |
| D2.2 | Aim, one of three | E | `goal campaign_goal` enum (`001_initial_schema.sql:220`), validated at `campaign.controller.js:710-713` | None | None |
| D2.3 | Mode Store Visit or Remote, legacy value never offered | E | `shoot_mode text` with CHECK `visit, shipment, remote` (`165_set_carries_its_own_shape.sql:55, 78-84`). `SHOOT_MODES_OFFERED` already excludes `remote` (`Packages/Mobile/src/utils/setShape.js:29`) | None. Production has zero rows using `remote` | None |
| D2.4 | Branch, required for Store Visit, must be this brand's | M | **`branch_id` exists nowhere.** Zero hits across `backend/src` and all 180 migrations | Add `branch_id uuid REFERENCES brand_branches(id) ON DELETE RESTRICT` | Low |
| D2.5 | Posting date at least 7 days ahead | C | `go_live_date date` (`165_set_carries_its_own_shape.sql:54`). Rule enforced at `services/setShape.model.js:128-137`, but the constant is **5** at `setShape.model.js:70` and `Packages/Mobile/src/utils/setShape.js:45` | Change both to 7 together, plus the test that pins them | Medium, changes shipped behaviour. See Q1 |
| D2.6 | Cutoff is posting date minus 3 days | P | `invites_close_at date` exists (`165_set_carries_its_own_shape.sql:56`) with a CHECK that it is on or before the posting date (`165:88-95`). The 3-day gap is enforced nowhere | **Always calculate it.** Keep writing the column for display and for the job's index | Low. See Q3 |
| D2.7 | Set state Draft / Live / Completed / Expired | M | No state column on `campaign_sets` | Derive Draft and Live. **Store `expired_at`**, because expiry is an event, not a derivation | Medium |
| D2.8 | Set created and updated timestamps | M | Neither exists | Add both | None |
| D3 | Counts: invited, signed, waiting | M | Nothing computes them | One grouped query per list. See §8 | Low |
| D4 | State rules | M | See D2.7 | See §8 | Medium |
| D5 | Locks after the first invitation | M | `updateSet` (`campaign.controller.js:800-860`) has no status guard and no invited-creator guard. `invite` notes the absence at `:1204-1208`; `services/publishGate.service.js:231-235` calls inviting into a running campaign a real existing workflow | Enforce in `updateSet` for every caller | **High.** The change most likely to surprise a live user |
| D6 | Expiry job | M | Nothing reads `invites_close_at`. 15 jobs exist in `src/jobs/index.js` | New hourly job. See §7 | Low |
| D7 | Deletion rules | P | Campaign delete is draft-only (`campaign.controller.js:580`). **Set delete has no guard** beyond "keep at least one" (`:872`) and cascades into contracts | Add a "nothing sent" guard to both, and refuse politely where a foreign key would otherwise throw a 500 | Medium |
| D8 | Duplicate copies settings only | C | `duplicateSet` copies **every creator row** (`campaign.controller.js:917-945`), and separately drops `channels_json` and every allocation field | Stop copying creators. Start copying `channels_json` and `branch_id` | Medium, changes a shipped endpoint |
| D9 | Past-date draft cannot invite | M | Nothing checks it | Derive the flag, refuse the invite on the server | Low |
| D10 | Time and dates | E | `backend/src/utils/indiaDay.js` already provides `todayInIndia`, `calendarDay`, `addDays`, `daysBetween`, `startOfIndiaDay`, `endOfIndiaDay` | Reuse unchanged. A cutoff passes at the **end** of the cutoff day, India time | None |
| D11 | Who may create | P | `requireApproved` guards create (`routes/campaign.routes.js:13`). No branch precondition anywhere | Require a branch with a recognised city only for a Store Visit set | Low. One production brand has a branch with no city |
| D12 | Legacy data | E | See §5 | Show as-is, backfill nothing | None |

### 2.2 API

| ID | Endpoint | St | What exists today | Change |
|---|---|---|---|---|
| A1 | Campaign list with state, set count, next posting date, counts | P | `GET /v1/campaigns` → `list` (`campaign.controller.js:389-398`) returns bare campaign rows | Add state filter, paging, sets count, next posting date and the three counts |
| A2 | Create campaign with optional group | P | `POST /v1/campaigns` (`:347-387`) takes name, brief, budget, dates | Add `started_from_group_id`. Validate name ≤ 60 and brief ≤ 200 |
| A3 | Update campaign | P | `PATCH /v1/campaigns/:id` (`:544-574`), allowlist `name, start_date, brief, allow_negotiation` | Add the two length checks |
| A4 | Delete campaign, only while every set is an untouched draft | P | `DELETE /v1/campaigns/:id` (`:576-586`) is draft-only by campaign status | Re-base the rule on "no set has ever sent an invitation" |
| A5 | Campaign detail with sets split into current and past | P | `GET /v1/campaigns/:id` (`:400-542`) returns a deep hierarchy including every creator | Add state, cutoff, counts, and the current/past split. Keep the existing payload for the website |
| A6 | Create set | P | `POST /v1/campaigns/:id/sets` (`:680-798`) | Add branch, the 7-day rule, the computed cutoff, name length |
| A7 | Update set, rejecting locked fields | P | `PATCH /v1/campaigns/:id/sets/:sid` (`:800-860`) | Add the lock. This is D5 |
| A8 | Delete set, draft only | P | `DELETE /v1/campaigns/:id/sets/:sid` (`:862-881`) | Add the guard |
| A9 | Duplicate set | C | `POST /v1/campaigns/:id/sets/:sid/duplicate` (`:887-949`) | Stop copying creators |
| A10 | Set detail with lock flags and "can I invite" | M | Not present. `getSets` (`:592-617`) returns rows plus creators | New endpoint |
| A11 | Branches for the picker | **E** | `GET /v1/brands/me/branches` (`routes/discovery.routes.js:25`, `controllers/discovery.controller.js:106-109`) returns id, name, cityId, cityName, stateId, stateName, isMain, ordered main first (`services/brandBranches.service.js:48`) | **None** |
| A12 | Earliest allowed posting date from the server | P | `earliestGoLiveDay()` exists (`services/setShape.model.js:154`) but is not exposed over HTTP | Return a `dateRules { earliestPostingDate, cutoffDaysBefore }` block on the responses of A2, A5 and A10. C4 opens straight after A2 returns, so the new-set screen always has it without a second call |
| A13 | Expiry job | M | Not present | See §7 |

---

## 3. What already exists, in detail

### 3.1 Campaigns

`campaigns` has 16 columns (`001_initial_schema.sql:199-213` plus `036_allow_negotiation_flag.sql` and
`037_l2_escrow_fee_tiers.sql`). Only index: `idx_campaigns_brand (brand_id, status)`.

Endpoints live entirely in `controllers/campaign.controller.js` behind `/v1/campaigns`
(`routes/index.js:160`). Create, list, detail, update, delete, publish, cancel, end, publish-check,
preview-basket, live hierarchy and products. There is **no admin route for campaigns or sets**.

Three enum values, `pending_wallet`, `published` and `live`, are read in places but written by nothing:
publish jumps straight from `draft` to `active` (`campaign.controller.js:1963, 1973`).

### 3.2 Sets

`campaign_sets` has 25 columns. Seven are dead or write-only: `assignment_mode`, `budget`,
`open_group_slots`, `filters_json` are never touched; `content_start_date` and `content_end_date` are
read by `services/production.service.js` but written by nothing, which migration 165 records in a
comment; `invites_close_at` is written and validated but never acted on.

**`campaign_sets` has no index at all.** Not even on `campaign_id`, which is the only way anything ever
looks a set up. Every set list in the product is a sequential scan today. That is fine at nine rows and
is the first thing to fix before the counts land.

The set rules that do exist live in `services/setShape.model.js`, mirrored on the phone at
`Packages/Mobile/src/utils/setShape.js`, and the mirror carries a comment saying the two constants must
stay equal or the picker will offer a day the server refuses. That mirror is the reason the 5-versus-7
change has to be made on both sides in one go.

### 3.3 Invitations and signatures

`campaign_influencers` carries the per-creator state in a 12-value enum: `invited, accepted,
negotiating, contracted, active, completed, declined, expired, applied, rejected_by_brand,
slots_filled, deferred`.

Both signatures are read from `contracts`, and the canonical predicate already exists at
`services/collabState.js:57`:

```
con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NOT NULL
```

Note that `campaign_influencers.contract_signed_at` and `.brand_signed_at` exist as columns, are read in
two places, and are **written by nothing**. They are always null. Item 4 must use the `contracts` table.

Three code paths insert an invitation: the open-group broadcast inside publish
(`campaign.controller.js:255-260`), `duplicateSet` (`:922-945`), and `invite` (`:1347-1392`).

### 3.4 Duplicate, as it actually behaves

`duplicateSet` (`campaign.controller.js:887-949`) copies 17 set columns, then copies **every**
`campaign_influencers` row into the new set with the status forced to `invited`. The rules doc says the
opposite: "Only the settings are copied, never Creators, invitations or agreements."

Three further defects in the same function, worth fixing while it is open:

1. `channels_json` is not copied, so the duplicate reads as "this set never stated a channel expectation".
   The same function goes out of its way to preserve the per-creator override three lines later.
2. Every allocation field is dropped, so on a Pay for Sale set each copied creator lands with no
   allocation, which `publishGate` then blocks and which `invite` itself refuses.
3. It never recomputes the campaign rollup, unlike create, update and delete.

### 3.5 Open group

Two paths exist. `POST /v1/campaigns/:id/sets/:sid/publish-open` is notify-only, has no frontend caller
and, notably, notifies **every approved creator on the platform** with no filter. The real path is
`materialiseOpenGroupInvites` inside publish (`campaign.controller.js:182-278`). Item 4 does not touch
either, but the same missing status filter described in §4 appears in the second one at `:226-231`.

### 3.6 Deletion, as it actually behaves

Everything is a hard delete. Campaign delete is draft-only. **Set delete has no campaign-status guard
and no membership guard**, so a set inside a live campaign holding contracted creators can be deleted,
taking their contracts, deliverables and negotiations with it through cascades.

What accidentally prevents disaster is a set of foreign keys with no cascade clause:
`escrow_entries.campaign_influencer_id`, `follower_transactions.set_id` and `campaign_offers.set_id`.
Those raise a raw Postgres error rather than a readable refusal. A set whose creators are contracted but
not yet funded deletes cleanly and destroys signed contracts.

### 3.7 Brand app

The Campaigns tab is `ComingSoonScreen` wired straight into the tab navigator at
`Packages/Mobile/src/navigation/BrandNavigator.js:89`. It is a bare screen, not a stack, so item 4
adds a stack alongside the two that exist.

Every campaign and set screen was deleted on 10 September in commit `5e04e1c` ("profile-only apps").
The prior art is recoverable with `git show 5e04e1c^:...`. The API client still carries 25 campaign and
set methods; **none of them is called from any screen**.

---

## 4. Link readiness

| Link | Verdict | Evidence |
|---|---|---|
| Item 3 branches, table and endpoint | **Ready** | `brand_branches` from `172_item3_brand_branches.sql:30-48`, unique main per brand. `services/brandBranches.service.js:47` returns city and state names joined, main first. A11 needs no work |
| Item 3 branches, registration seeds the first one | **Ready, already done** | `controllers/brand.controller.js:223` calls `ensureMainFromBrandRow` after register, best-effort so it never blocks. Production agrees: 9 brands, 9 branches, none missing. The prompt's "if it doesn't, fix that here" does not apply |
| Item 3 creator groups | **Not ready** | Groups exist and work. `campaigns` has no column to hold one, so G10 has nowhere to land |
| Item 3 Discover | Ready, nothing to do | Item 5's picker reuses `DiscoverList`. Item 4 does not touch it |
| Item 2 eligibility | **Partly ready** | `canBrandInviteCreator` (`services/collabEligibility.service.js:340`) reads the Aim from `set.goal` (`:351`) and the mode from `set.shoot_mode` (`:355`), but takes the Store Visit city list from **every branch the brand owns** (`:241-242, 370-376`), because a set has no branch today. Once `branch_id` exists this must compare against that one branch's city |
| Item 5 invitations | Blocked on item 4, plus a live bug | Detail below |
| Item 8 pitches | **Ready** | An accepted pitch produces a `collab_agreements` row; the brand then invites with `agreement_id` in the body and the agreement is consumed in the same transaction (`campaign.controller.js:1395-1406`). That path deliberately skips the eligibility gate (`:1152`). Item 4's set fields fit it unchanged |
| Item 9 money | **Confirmed clean** | Nothing in campaign or set creation charges anything. The escrow fee locks at publish, in a separate endpoint |
| Items 10–12 shoot | Feeds forward | Shoot addresses are free text on `production_events` (`visit_address`, `visit_city`, `visit_pincode`). A set's `branch_id` would give the Store Visit shoot plan a real address to start from, which it does not have today |
| Item 19 Home | Serve from the same query | The counts A1 computes are exactly what Home will need. Build them grouped, never per row |
| Websites | No breakage. See §9 | |
| Production data | See §5 | |

### The cross-set bug item 5 asked about

`controllers/campaign.controller.js:1268-1277`:

```sql
SELECT ci.id FROM campaign_influencers ci
 JOIN campaign_sets cs ON cs.id = ci.set_id
 WHERE cs.campaign_id = $1 AND ci.influencer_id = $2
```

**There is no status predicate.** A brand is refused when the creator's earlier row is `declined`,
`expired`, `rejected_by_brand`, `slots_filled` or `deferred`, as well as when it is genuinely live.
The `deferred` case is the sharpest: migration 167 exists precisely so a creator who asked for a
different day can be put in a second set, and this check forbids exactly that.

The same omission appears in the open-group broadcast at `:226-231`. Meanwhile `duplicateSet` creates
the very state these two guards exist to prevent. The fix is one line: exclude the dead statuses, for
which the list already exists at `services/collabOwedItems.service.js:34`.

---

## 5. Production data

| Thing | Count |
|---|---|
| Campaigns | 10, of which 6 draft and 4 active |
| Campaigns with zero sets | 2 |
| Sets | 9 |
| Sets with at least one invitation | 5 |
| Invitations | 8, being 3 active, 2 invited, 2 contracted, 1 completed |
| Contracts | 6, of which 1 signed by both sides |
| Invitations with no contract row | 2 |
| Brands and branches | 9 and 9, no brand without a branch |
| Branches with no city | 1, named "Main Branch" |

Legacy health of the nine sets, which is the D12 answer:

| Check | Result |
|---|---|
| Posting date null | **9 of 9** |
| Mode of work null | **9 of 9** |
| Cutoff null | **9 of 9** |
| `shoot_mode = 'remote'` | 0 |
| Posting date in the past | 0 |
| Name missing, or longer than 60 | 0 |
| Aim missing | 0 |
| Campaign brief longer than 200 | 0. No campaign has a brief at all |

**No backfill is needed and none should be attempted.** Every set predates the date model, so all nine
are drafts with no date. They will show as drafts with a "Choose a posting date" prompt, which is
honest. All of it is practice data with names like "Testaaaaa" and "Campaign creation test11".

---

## 6. Proposed migrations

One migration, number **180**, additive only, no backfill.

| Change | Why |
|---|---|
| `campaigns.updated_at timestamptz NOT NULL DEFAULT now()` plus a trigger | The list orders by it |
| `campaigns.started_from_group_id uuid REFERENCES influencer_groups(id) ON DELETE SET NULL` | G10 |
| `campaign_sets.branch_id uuid REFERENCES brand_branches(id) ON DELETE RESTRICT` | D2.4. RESTRICT so a branch in use cannot vanish under a live set. `brandBranches.service.remove` (`:153-159`) must then refuse politely with a message, or the brand sees a raw database error when deleting a branch a set still names |
| `campaign_sets.created_at`, `campaign_sets.updated_at` plus a trigger | Ordering and audit |
| `campaign_sets.expired_at timestamptz` | Expiry is an event and must be recorded, not recomputed |
| `CHECK (branch_id IS NOT NULL OR shoot_mode IS DISTINCT FROM 'visit')` as NOT VALID, then VALIDATE | Nine existing rows have a null mode, so they pass |
| `CREATE INDEX idx_campaign_sets_campaign ON campaign_sets (campaign_id)` | The table has no index at all today |
| `CREATE INDEX idx_campaign_sets_due ON campaign_sets (invites_close_at) WHERE expired_at IS NULL` | The expiry job's scan |
| `CREATE INDEX idx_ci_set_status ON campaign_influencers (set_id, status)` | The counts query |

Dry-run checks the runner should print before applying: row counts for both tables, how many sets would
fail the new branch CHECK (expected zero), and confirmation that the two new indexes do not already
exist. Prod is 10 campaigns and 9 sets, so the whole migration is instant.

---

## 7. The expiry job

New file `backend/src/jobs/set-expiry.job.js`, registered in `src/jobs/index.js` on `40 * * * *` with
the India timezone, following `social-measure.job.js` as the template. Four steps are needed to
register a job here: write the module exporting `run`, import it, schedule it, and add it to
`module.exports` so tests can call it directly.

What it does, in one transaction per set:

1. Select sets where the cutoff day has ended in India time, `expired_at IS NULL`, and the set has at
   least one invitation ever sent.
2. For each, ask whether any creator in that set has a contract signed by both sides, using the
   canonical predicate from `services/collabState.js:57`.
3. If none has: set `expired_at = now()`, and move every open invitation in that set to `expired`.
   Open means `invited`, `applied`, `accepted`, `negotiating` or `deferred`.
4. If at least one has: leave the set alone. The existing `offer-expiry` job already expires the
   individual unanswered invitations on their own clock, which is exactly the rules-doc behaviour.

**Why it is idempotent.** The selection predicate requires `expired_at IS NULL`, and step 3 sets it, so
a second run selects nothing. The invitation update is bounded by status, so re-running cannot move a
row twice. Running it twice in the same minute is safe because each set is handled in its own
transaction with `SELECT ... FOR UPDATE SKIP LOCKED`, the pattern item 3b already uses.

It logs one line per changed set and a summary count, matching the other 15 jobs.

---

## 8. Counts, states and list queries

**Definitions.** Against one set:

| Number | Definition |
|---|---|
| Invited | Every `campaign_influencers` row for the set, whatever its status. This matches the mockups, where the bar fills to the invited count |
| Signed | Rows whose contract has both signatures |
| Waiting | Every live row that is not yet signed by both sides: `invited`, `applied`, `accepted`, `negotiating` and `deferred`. `accepted` belongs here because the creator has said yes but nothing is signed, and the brand is still waiting on that signature |

Dead statuses, `declined`, `expired`, `rejected_by_brand` and `slots_filled`, are neither signed nor
waiting. Whether they still count as "invited" is a genuine open point: in every mockup the three
numbers sum exactly (14 = 9 + 5 on C1, 5 = 3 + 2 on C6 and C8), which reads as invited excluding the
dead rows, but the examples may simply contain none. This is Q9.

**States.** Draft means no invitation has ever been sent for that set. Live means at least one has, and
the set is neither expired nor completed. Expired means `expired_at` is set. Completed is the hard one.

**On "Completed", plainly.** It is not derivable today. `campaign_influencers.status = 'completed'` is
written in exactly one place, `jobs/tranche-3-release.job.js:99`, and only when every escrow entry for
that creator has been released. A Pay for Sale collaboration has no escrow entries, so it can never
reach `completed`. There is no `ended_at` anywhere, on any table. The nearest workable rule, and my
recommendation, is: a set is Completed when it has at least one invitation, is not expired, and every
row is in a terminal status, meaning `completed`, `declined`, `expired`, `rejected_by_brand` or
`slots_filled`. That is honest for Pay for Content today and will start being right for Pay for Sale as
soon as the completion rule from §19 is built. This is Q4.

**The list query.** One grouped query per list, never per row:

```sql
SELECT s.campaign_id, s.id,
       count(ci.id)                                            AS invited,
       count(*) FILTER (WHERE k.influencer_signed_at IS NOT NULL
                          AND k.brand_signed_at    IS NOT NULL) AS signed,
       count(*) FILTER (WHERE ci.status IN ('invited','applied','accepted','negotiating','deferred')
                          AND NOT (k.influencer_signed_at IS NOT NULL
                               AND k.brand_signed_at    IS NOT NULL)) AS waiting
  FROM campaign_sets s
  LEFT JOIN campaign_influencers ci ON ci.set_id = s.id
  LEFT JOIN contracts k             ON k.campaign_influencer_id = ci.id
 WHERE s.campaign_id = ANY($1)
 GROUP BY s.campaign_id, s.id
```

The campaign card rolls the same rows up by `campaign_id`. Both need the two new indexes from §6.

---

## 9. Websites and admin

**The brand website no longer builds campaigns or sets.** The "New campaign" button is an alert telling
the brand to use the phone (`Packages/brand-web/app/dashboard/campaigns/page.js:463-469`). Confirming
it, `go_live_date`, `shoot_mode` and `invites_close_at` appear **zero times** in the whole of
`Packages/brand-web`. Fifteen campaign and set functions in its API client are dead wrappers with no
call site.

**No admin screen reads or writes a set.** Admin sees campaign aggregates only.

**Would the new server rules break a website screen? No submit path breaks**, because the website is
already out of set authoring. Two exposures should be recorded as open items:

1. **The invite modal silently locks a draft set.**
   `app/dashboard/influencers/[id]/page.js:222` sends only `{ influencer_id }` and lets the brand pick
   any set of any non-completed campaign, shown as a bare name. Under item 4 that one click freezes the
   set's Aim, posting date, mode and branch, and the brand then meets refusals back in the phone
   builder. The modal gives no warning, and its copy still points at a web wizard that no longer exists.
2. **The website's branch editor writes to the wrong place.**
   `app/dashboard/settings/profile/page.js:320-333` saves branches into `brands.listing_data.branches[]`.
   Migration 172 states that item 3 stopped reading that column. A brand that adds a branch on the
   website therefore gets no row in `brand_branches`, and a branch-required Store Visit set would refuse
   it with no way to fix it from the web.

Neither is caused by item 4 and neither blocks it.

---

## 10. Frontend plan

**Navigator.** Replace the bare `ComingSoonScreen` at `BrandNavigator.js:89` with a
`CampaignsStackScreen` holding: `BrandCampaigns` (C1, C2), `BrandCampaignNew` (C3), `BrandSetNew` (C4,
C5), `BrandCampaignDetail` (C6), `BrandSetDetail` (C7, C8, C9). C10 and C11 are sheets, not screens.

**The date picker is settled, and no native module is needed.**
`Packages/Mobile/src/components/DateField.js` is already a full pure-JS month grid: it renders the
seven-column calendar, honours `minDate` and `maxDate`, greys out and blocks earlier days, navigates
months, emits `YYYY-MM-DD`, and is unit-tested at `src/components/__tests__/dateField.test.js`. It needs
one change, a token pass from the older `ig` palette to `settingsTokens`, plus the cutoff line under the
calendar. Its floor comes from `earliestGoLiveDay()`, which already exists on both sides.

For completeness: `@react-native-community/datetimepicker` is in `package.json` and is autolinked into
the APK, so it would in principle work over the air. It is still the wrong choice, because `DateField`
needs nothing from the binary at all and is already written.

**Components reused as-is**, all from items 2 and 3, all pure JS:

| Need | Component |
|---|---|
| Live / Drafts / Past | `components/shell/SegmentedControl.js:10` |
| Screen header | `Header` from `screens/brand/BrandPitchSettingsScreen.js:228` |
| Rows, chips, buttons, empty state, banners | `components/settings/primitives.js` |
| Bottom sheets, confirm sheet, the ⋯ menu | `Sheet`, `ConfirmSheet`, `ActionSheet` in `components/settings/sheets.js` |
| Save bar, toast, skeleton, couldn't-load | `components/settings/feedback.js` |
| State chips | `settingsTokens.state` in `theme/tokens.js:515-523` |
| Set rules and the picker floor | `utils/setShape.js` |

**To build:** `components/campaigns/copy4.js` holding `MSG4` and `C4`, following the `copy3b.js` pattern;
a shared text field with a character counter, of which three private copies exist today; and a campaign
list card. Item 3's `C3.comingSoon.brandCampaigns` and its three campaign "coming soon" toasts get
deleted rather than duplicated.

**No new native module, so this ships over the air.**

---

## 11. Tests

Baseline, full backend suite, 12 September 2026: **229 failed, 901 passed, 1130 total**, in 110 suites.
The 229 are the long-standing debt. Item 4 must add none.

Existing coverage that item 4 will touch: `backend/tests/campaigns.test.js` holds 49 tests over campaign
and set CRUD, invite, offers, wallet and publish. `cron-campaign-status.test.js` covers the campaign
status cron. `contracts.test.js` covers signing.

**One existing conflict to decide.** Those tests assert **403** when a brand touches another brand's
campaign (`campaigns.test.js:209, 256, 313, 327, 383, 436, 483, 658`). The prompt asks for **404**.
Changing it rewrites eight assertions. This is Q7.

Tests to add: the 7-day rule on create and its rejection when posted straight to the API; the computed
cutoff; each locked field refused after the first invitation while rename still works; delete refused
for a set with invitations and for its campaign; the three counts against handmade data; the expiry job
in both directions, nobody signed and somebody signed; idempotency by running it twice; duplicate
copying settings and no creators; the past-date invite refusal; and another brand getting the chosen
status code on all ten endpoints.

---

## 12. Questions for the founder

Each has my recommendation. The first three change behaviour that is live today.

**Q1. Seven days or five?** The rules doc says a posting date must be at least 7 days ahead. The code
says 5, on both the server and the phone, deliberately kept equal.
*Recommendation: move to 7*, because the rules doc is the authority and 7 is what the mockups tell the
brand. It is a one-line change on each side plus one test. No production set has a date, so nothing is
grandfathered.

**Q2. Two state vocabularies.** Campaigns already carry a 7-value status used by publish, wallet and
escrow. Item 4 needs Draft, Live, Completed, Expired.
*Recommendation: derive item 4's four states from the sets and leave the old column alone.* Adding
`expired` to the old enum would leak into the money code for no gain.

**Q3. Store the cutoff or always calculate it?** The column exists and is written but read by nobody.
*Recommendation: always calculate it from the posting date, and keep writing the column* so the expiry
job can index on it and the website can display it. Calculated wins any disagreement.

**Q4. What does Completed mean, honestly?** It is not derivable today, as §8 explains.
*Recommendation: a set is Completed when it has invitations, is not expired, and every creator row sits
in a terminal status.* Revisit when the §19 completion rule is built.

**Q5. Duplicate currently copies creators.** The rules doc says it must not.
*Recommendation: follow the rules doc and stop copying them.* Nobody can be relying on the current
behaviour: the endpoint has no caller in either app, and the state it produces is the one `invite`
refuses.

**Q6. Should item 4 fix the cross-set bug?** It is item 5's problem but it lives in code item 4 opens.
*Recommendation: fix it here, in one line*, using the dead-status list that already exists.

**Q7. 403 or 404 for another brand's campaign?** The prompt says 404, the code and eight tests say 403.
*Recommendation: adopt 404 for the new endpoints only and leave the existing ones at 403*, so no test
is rewritten and no website call changes. Say the word if you would rather have it uniform.

**Q8. Set delete can currently destroy signed contracts.** No guard exists.
*Recommendation: fix it inside item 4*, since item 4 is writing the delete rule anyway.

**Q9. Does "invited" include creators who declined or expired?** Every mockup shows the three numbers
summing exactly, which suggests it does not, but the examples may simply have no refusals in them.
*Recommendation: invited counts every creator ever sent an invitation, including those who declined or
expired*, because that is what the word means and because the bar then shows honestly that some people
said no. If you would rather the bar always fill completely, say so and invited becomes signed plus
waiting.

### The eight assumptions from the prompt, confirmed

All eight are sound and I have built the plan on them. Two carry a caveat:

- **Timezone.** India time throughout, and a cutoff passes at the end of that day. The helpers already
  exist in `backend/src/utils/indiaDay.js`, so this costs nothing.
- **Legacy sets are shown as-is and never auto-changed.** Agreed, and it is easy here: all nine
  production sets have no date and no mode, so they simply read as drafts that need a date.
- **Past tab holds completed and expired together.** Agreed.
- **Live sets can be renamed, ⋯ offers Rename and Duplicate only.** Agreed.
- **Campaign delete is blocked by any set that ever sent an invitation, even an expired one.** Agreed,
  and note this is a different rule from the code's current draft-only check, which looks at the
  campaign's own status instead.
- **Set names suggested as Set A, Set B.** Agreed. The existing duplicate already names copies this way,
  using a count rather than a maximum, so it can produce a duplicate name. Worth fixing in passing.
- **A campaign started from a group keeps the link, hidden from creators.** Agreed, and it needs the new
  column from §6.
- **Aim, mode, date and branch lock on the first invitation.** Agreed. This is the highest-risk change
  in the item, because today nothing is locked at all.

---

## 13. Phase 2 in one line

Migration 180, the state and lock rules, endpoints A1 to A10, the expiry job and the count queries.
Then the brand app screens C1 to C11, then tests. Nothing here is blocked except by the answers above.

---

## 14. Review record

The first draft was assembled from four parallel code surveys. Every citation in it was then re-read
against the working tree, one line at a time, before this version was published. The findings, the
production counts, the rules-doc conflicts and the link verdicts all held. Four things changed:

| Where | Was | Now | Why |
|---|---|---|---|
| §8 counts | `accepted` counted as neither waiting nor signed | `accepted` counts as waiting | The creator has said yes but nothing is signed. Under the old definition an accepted creator vanished from the bar entirely |
| §8 counts and Q9 | "Invited includes declined and expired" stated as settled | Raised as Q9 with a recommendation | Every mockup shows the three numbers summing exactly, which is evidence the other way. That is the founder's call, not mine |
| A12 | Serve the earliest date on A5 and A10 | Serve it on A2, A5 and A10 | The new-set screen opens straight after create-campaign returns, and A10 is a set that does not exist yet |
| §6 branch column | `ON DELETE RESTRICT` alone | Plus a note that the branch delete service must refuse politely | Otherwise a brand deleting a branch a set still names gets a raw database error |

One citation was off by one line (`collabOwedItems.service.js:33` → `:34`). No finding was withdrawn.
