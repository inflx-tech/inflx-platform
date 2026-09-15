# Item 8 — the creator's pitch: what was built

15 September 2026. Rules v1.21 §8 (rewritten) and §7B (amended). Mockups T1–T14, locked.
Contract: `features/item8-pitch/`. **LIVE — deployed 15 September 2026.**

---

## 1. In one paragraph

A creator can now propose a deal to a brand. The brand accepts, counters or rejects.
**Accepting agrees the money and creates nothing else** — she joins the brand's pool and
waits for a set, beside the creators who asked to be moved in item 6. From there it is the
ordinary path: item 4's set, item 5's invitation, item 7's agreement. Item 8 added a front
door and no new machinery.

The rest of the work was taking machinery away. Two negotiation engines became one. Two
routes into a collaboration became one. Seven write endpoints, five service functions,
nine dead exports and two dead test specs are gone.

---

## 2. The order it was done in, and why

The founder's instruction was **"the bypass closes first, before any new feature."**

**Phase 2a — the door.** `POST …/invite` with an `agreement_id` skipped item 2's
eligibility entirely. A creator who blocked a brand *after* agreeing terms with it could
still be put into one of its sets, and the same call could land her on her signing queue
with a contract. That refusal was written and proved before a single line of item 8's
feature code.

**Phase 2b — migration 184.** The thread anchor, the pitch's columns and limits, the
pool's provenance, the two admin numbers. Additive only.

**Phase 2c — the flow.** One service, one controller, one route file, one job.

**Phase 2d — the retirements**, in the gap report's own order.

**Phase 3 — the screens.** Four new components, six new screens, two placeholders replaced.

**Phase 4 — the tests.** 49 backend, 25 mobile.

---

## 3. The five decisions worth recording

**One engine, and turn zero is not a round.** Her pitch is *stored* as the opening counter
so both sides see the previous value beside the proposed one on every line — but it is the
opening position, not a round spent. Counting it would silently have given a pitch one
counter where an invitation gets two. `counters_used` subtracts it.

**The clock governs the first answer only** (your answer to Q2). Making `response_due_at`
the thread's deadline had an unfairness in it: the brand counters on day 28, she has two
days, and the whole thing dies through no fault of hers. So once the brand has answered,
the clock has done its job, and the conversation runs to the early close instead.

**Her date is the real constraint.** A pitch closes when her proposed posting date comes
within item 4's seven-day floor, because no set can be built for it after that. A creator
who wants thirty days of consideration proposes a date thirty-seven days out.

**§7B's exemption is exactly five settings.** The rules name them: Aim, mode, city,
category and minimums. Two always survive it — "a Creator who has since paused invitations,
or who has since blocked that Brand, cannot be invited." The code branches on exactly those
five and no more.

**A number nobody has measured is not a judgement.** See §5.

---

## 4. Deployed

| | |
|---|---|
| Commit | `d06111a` |
| Migration | **184 applied to production** — all 21 objects present, `platform_settings` now 7 keys, **row counts unchanged** (0 pitches, 22 agreements with 19 ready and untouched, 0 threads, 8 briefed invitations, 0 pool entries), no backfill |
| Render | proved by route existence: `/v1/influencers/me/pitches` and `/v1/brands/me/pitches` answer **401** (auth runs first, so the routes exist); the control path answers **404**. Three probes — cold start |
| OTA | **brand 218**, **influencer 205**, both manifests verified |
| Websites | the push redeploys Vercel, but item 8 changed no brand-web file. The admin settings page is key-driven, so both new numbers appear on it with no web change |
| Money | **none moved, and none can.** Item 8 writes one pool row on acceptance and nothing else |

The seven retired write endpoints are **gone in production**, and `invite` with an
`agreement_id` is refused there. Nothing on any shipped phone called them: the pitch
affordance on both apps was a disabled "coming soon" button until this release.

---

## 5. The null-to-zero coercion, reported (your §2.1)

You asked for a fourth reason code on her own screen, and for a report of anywhere else
the same coercion decides something.

**Where it was.** `collabEligibility.creatorFacts` and the brand-list SQL both coerce a
never-measured follower count or engagement rate to `0`. That is **right** for the
comparison — she cannot be admitted on a number nobody has — and **wrong** for the
sentence, because "you don't meet what they're looking for" and "we haven't measured you
yet" are different things and only the second one she can wait out.

**What changed.** A fourth code, `BEING_MEASURED`, on `canCreatorPitchBrand` and on the
brand-list SQL, with the sentence "Your numbers are still being measured." It is returned
only by the creator-side question, so the brand's three coarse codes are unchanged. Check
41 pins the function and the SQL together across eleven cases, so they cannot drift.

**Everywhere else the same coercion decides something — the full list:**

1. `creatorFacts.followersYoutube` — `COALESCE(youtube_subscribers, 0)`. Now reported.
2. `creatorFacts.followersInstagram` — `COALESCE(followers_count, 0)`. Now reported.
3. `creatorFacts.engagementRate` — `COALESCE(engagement_rate, 0)`. Now reported.
4. The brand-list CTE's `ig`, `yt` and `er`. Now reported.
5. **`discoverCreators`' sort and filters** — a brand searching by minimum followers
   sees an unmeasured creator ranked as though she had none. This is the brand's side, so
   the fourth code does **not** apply; the honest fix there is a "not measured yet" chip
   on the creator card, which item 3b already shows on the profile but not in the list.
   **Left alone, reported here.**

Nothing else coerces a null to a zero in a place where the zero decides an outcome.

---

## 6. What still reads the ten `handshake_settings` numbers

**Nothing.** Every one of the ten is now unread by running code; the only mentions left
are two comments in the expiry job describing what its SQL used to consult. That SQL reads
`expires_at` columns stamped when the rows were created.

`counter_rounds_per_side` is removed from the defaults map entirely (check 37). Folding the
rest of the table into `platform_settings` — retirement step 5 — is **deferred**, because
with nothing reading it the fold is a tidy rather than a fix, and it would touch a table
with live rows for no behavioural gain. Say the word if you want it done anyway.

---

## 7. The baseline, before and after (your §2.3)

| Point | Failed | Passed | Total |
|---|---|---|---|
| After item 7 | 229 | 1024 | 1253 |
| After item 8, before the deletions | 233 | 1067 | 1300 |
| After item 8, after the deletions | **222** | **1070** | **1292** |

**Zero new failures**, test by test, against the item 7 baseline. **52 new tests, all
passing.**

**The drop from 229 to 222 is a deletion, not a fix.** `collab-diary.test.js` held nine
tests and **seven of them were already red** — it asserted the brand-request
conversation, which stopped existing on 2 September. Removing the file removes those
seven along with two green ones. Nothing was repaired and nothing was weakened. I am
saying it plainly because a falling failure count is exactly the shape a faked result
would take.

The +4 were all expected and all named in `features/item8-pitch/05-impact.md` §1: three
`item2-settings-api` tests calling the retired door (rewritten to the new one, all
passing) and item 8's own check 37, written before the retirement it asserts.

`tests/collab-diary.test.js` and `qa/unit/handshake-routes.spec.ts` are deleted. The first
asserted the brand-request conversation; the second asserted seventeen routes that stopped
existing on 2 September and has been red since. Neither deletion removes a rule.

Mobile: **518 pass**, 43 suites, all green (25 new; baseline 493).

---

## 8. Still open, for you

1. **`payment_config.return_window_days` stays 30** — item 7's leftover, still waiting on
   your decision. The agreement prints from the config either way.
2. **`discoverCreators`' unmeasured creators** (§5, item 5) — a brand's search ranks them
   as zero. Not in item 8's scope; tell me if you want the chip.
3. **Folding `handshake_settings` into `platform_settings`** (§6) — deferred as a tidy.
4. **The device walk.** Items 2–8 now form one chain: settings → discovery → campaign →
   set → invitation → negotiation → agreement → pitch. The full end-to-end pack across all
   of them is the next piece of work, and your walk belongs with it rather than with this
   item alone.

---

## 9. Live, on your go

Migration 184 applied, `d06111a` pushed with gov-check green, Render proved by route
existence, OTA **brand 218 / influencer 205**. See §4.

**Item 8 moves no money.** Check 16 counts seven tables before and after an acceptance
and every count is unchanged. Production still holds 0 pitches, 0 pool entries and 0
negotiation threads — the first real one will be made by a creator on her phone.
