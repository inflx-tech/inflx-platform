# Item 8 — impact

**One-line verdict:** production-impacting, moves no money, closes a real security gap
on the way in, and deletes seven live write endpoints that nothing on the phone calls.

---

## 1. Tests — the baseline, before and after (checks 32 and 38)

| Point | Failed | Passed | Total | Suites |
|---|---|---|---|---|
| After item 7 (the baseline) | 229 | 1024 | 1253 | 47 failed / 114 |
| After item 8, **before** deleting the two dead specs | 233 | 1067 | 1300 | 49 failed / 115 |
| After item 8, **after** deleting them | **222** | **1070** | **1292** | 46 failed / 114 |

**Zero new failures** against the item 7 baseline, test by test. **52 new tests, all
passing.** Compared with `scratchpad/compare.js`, which keys on file + full test name.

**The drop from 229 to 222 is a DELETION, not a fix.** `collab-diary.test.js` held nine
tests, of which **seven were already failing** before item 8 — it asserted the
brand-request conversation, a surface that stopped existing on 2 September. Removing it
removes seven red tests along with two green ones. Nothing was fixed and nothing was
weakened; a dead suite stopped being counted. Stating it plainly because a falling
failure count is exactly the shape a fake-green would take.

**The +4 in the middle row, named.** Three were `item2-settings-api.test.js` calling
`POST /influencers/me/proposals`, the door item 8 retired — rewritten to
`POST /influencers/me/pitches`, where item 2's rules still hold, and all three pass. One
was item 8's own check 37, written before the retirement it asserts; it passes now.

**Approval §2.3 — the two dead specs.** `backend/tests/collab-diary.test.js` asserted the
brand-request conversation, and `qa/unit/handshake-routes.spec.ts` asserted seventeen
routes that stopped existing on 2 September. Both are deleted. The deletion removes
tests, never a rule: everything either still asserted lives in `item8-pitch.test.js` or
in item 6's suite.

**No new failures against the baseline.** The ~229 pre-existing failures are the known
test-suite debt and are untouched by this item.

Mobile: **518 pass** (25 new; baseline 493). All 43 suites green.

---

## 2. Database — migration 184

Additive only. Nothing dropped, nothing rewritten, nothing backfilled.

| Part | What |
|---|---|
| A | `negotiations.campaign_influencer_id` becomes nullable; `pitch_id` added; the inline unique replaced by two partial uniques; a one-anchor CHECK |
| B | 10 columns on `influencer_proposals`, a 500-character CHECK, a closed-reason CHECK, one partial unique (one open pitch per brand per Aim) and two indexes |
| C | `brand_creator_pool.from_pitch_id` + `matched_shoot_mode` + a CHECK + an index |
| D | `pitch_response_days` (30) and `pitch_cooldown_days` (30) in `platform_settings` |

**Why part A is free:** production holds **zero** negotiation rows. The constraint that
blocked one engine has never had a row to protect.

**Reversibility.** Every column is additive and nullable; the two partial uniques and the
CHECK are the only things that could refuse a future write, and each was dry-run against
production first. The nineteen `ready` agreements and the eight invitations carrying an
`agreement_id` are untouched and still read correctly everywhere.

---

## 3. What stops working, honestly

**Seven write endpoints are gone**, not disabled:

```
POST /influencers/me/proposals
POST /influencers/me/proposals/:id/withdraw
POST /influencers/me/proposals/:id/respond-counter
POST /influencers/me/proposals/:id/counter
POST /brands/me/proposals/:id/accept
POST /brands/me/proposals/:id/reject
POST /brands/me/proposals/:id/counter
```

Nothing on any phone calls them: the pitch affordance on both apps was a disabled button
reading "coming soon" until this item. Their reads stay.

**`POST …/invite` with an `agreement_id` is refused** (Phase 2a, done before any new
feature). That path skipped item 2's eligibility entirely — her paused switch, her blocks,
her Aims, her modes, her categories and her minimums were all bypassed, so a creator who
blocked a brand *after* agreeing could still be put into a set by it. It could also land
her on her signing queue with a contract in one call. The eight invitations already
created that way keep working; every reader of `campaign_influencers.agreement_id` keeps
reading.

**Nine dead exports deleted** from `handshake.service`, plus five from `proposal.service`
and seven controller handlers. All had zero callers after the two closures above.

---

## 4. What still reads `handshake_settings`

**Nothing.** All ten remaining numbers — `creator_max_active`, `creator_max_per_day`,
`creator_max_per_week`, `brand_max_active`, `brand_max_per_day`, `brand_max_per_week`,
`request_ttl_days`, `decline_cooldown_days`, `broadcast_max_recipients` and
`agreement_expiry_days` — are now read by no running code. The only mentions left are two
comments in `jobs/handshake-expiry.job.js` describing what the expiry SQL used to consult;
that SQL reads `expires_at` columns stamped when the rows were created, not the settings.

`counter_rounds_per_side` is removed from the defaults map. The table and its columns
stay; folding it into `platform_settings` (retirement step 5) is deferred, because with
nothing reading it the fold is a tidy rather than a fix.

---

## 5. Where money is concerned

**Item 8 moves none.** Accepting a pitch writes one `brand_creator_pool` row and nothing
else — check 16 counts `campaigns`, `campaign_sets`, `campaign_influencers`, `contracts`,
`wallet_transactions`, `escrow_entries` and `collab_agreements` before and after, and every
count is unchanged. Money enters at item 7's signature, as it always did.

---

## 6. Behaviour changes a person will notice

| Who | What changes | Why |
|---|---|---|
| Creator | Her brand list gains **On cooldown** and **Being measured** beside the three old statuses | A pause with a date, and a number nobody has taken, are not refusals |
| Creator | "Pitch this brand" opens a real form | It was a coming-soon toast |
| Creator | A Pitches list with three live states and five endings | She had nothing |
| Brand | The Creators tab's Pitches segment is the real inbox | It was a placeholder |
| Brand | A pool entry can carry a **PITCH** tag | Two doors into one pool |
| Both | A pitch thread is item 6's thread | One negotiation machine |
| Admin | Two new numbers on the existing platform-settings page | The page is key-driven; no web change needed |

---

## 7. Risk

| Risk | Mitigation |
|---|---|
| The one-engine change touches item 6's live negotiation code | Item 6's 42 tests pass unchanged; the split falls where `loadContext` already flattened it |
| The round-limit arithmetic differs between a pitch and an invitation | Turn zero is explicitly excluded from `counters_used`; check 15 asserts a pitch gets the same two counters |
| Retiring seven endpoints breaks an app build in the field | None of them is called by any shipped screen; the reads stay |
| §7B's exemption is too wide | It skips exactly the five settings the rules name; paused and blocked are asserted to survive it (check 22) |
| The early close surprises a creator | Her own date drives it, the sentence names both dates, and the job is idempotent |
