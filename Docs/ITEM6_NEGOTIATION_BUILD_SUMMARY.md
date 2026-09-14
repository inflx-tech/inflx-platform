# Item 6 — Negotiation, the move request, the pool and the platform settings
## Build summary

**Built 14 September 2026.** Rules doc v1.18 §7B, the locked mockups N1–N22, the gap-check prompt, and
the gap report as changed by the approval message. Contract: `features/item6-negotiation/`.

**Not deployed.** Migration 182 has been dry-run against production only. Nothing has been migrated,
pushed or published. This is production-impacting work and needs an explicit go.

---

## 1. Migration 182 — what it adds, and the production counts

Additive only. `node backend/scripts/run-182.js --dry | --apply`, which prints the counts before and
after and refuses nothing it does not need to.

**Production dry run, 14 September 2026:**

| Count before | Value |
|---|---|
| negotiations | 0 |
| negotiation turns | 0 |
| invitations with the `deferred` status | 0 |
| invitations in total | 8 |
| campaigns with the negotiation switch off | 0 |

All sixteen new columns and all three new tables were reported absent. **There is nothing to
backfill:** production has never had a negotiation, and the three settings are seeded at their
defaults by the migration itself (rounds 2, pool lifetime 30 days, shoppable posts 1). The after
counts on an apply will be identical, because no row changes; only the shape does.

What it adds:

- **negotiations** — `round_limit`, `outcome` (one of `agreed`, `declined_by_creator`,
  `declined_by_brand`, `expired`, `moved`), `ended_at`, `ended_by`, `turn_changed_at`,
  `reminder_48h_sent_at`, `reminder_7d_sent_at`.
- **negotiation_turns** — `kind` (`counter`, `accept`, `decline`), `terms_json`, `decline_reason`,
  `decline_note`, and an index on the negotiation.
- **campaign_influencers** — `move_requested_at`, `move_answer`, `move_answered_at`,
  `min_shoppable_posts`, `pool_entry_id`, and `pool` added to item 5's source vocabulary.
- **brand_creator_pool** — new, brand-level: the creator, the terms agreed, the date and mode she
  asked for, a state, and an expiry.
- **platform_settings** and **platform_settings_audit** — new, keyed rows, seeded.

---

## 2. One service, and every door that goes through it

`backend/src/services/negotiation.service.js` is the only place where a counter, an accept, a decline,
a move request or a move answer is decided. Everything else calls it.

| Door | What it is | Calls |
|---|---|---|
| `POST /influencers/me/invitations/:ciId/counter` | the creator's counter (new) | `counter` |
| `POST …/thread/accept` and `…/thread/decline` (creator) | her accept and her decline (new) | `accept`, `decline` |
| `POST …/move-request` | asking for a different date or mode (new) | `moveRequest` |
| `POST /campaigns/:id/sets/:sid/invitations/:ciId/thread/counter` | the brand countering back (new) | `counter` |
| `…/thread/accept` and `…/thread/decline` (brand) | the brand's answer (new) | `accept`, `decline` |
| `…/move-answer` | agree, keep or decline the move (new) | `moveAnswer` |
| `GET …/thread` on both sides | the thread both read (new) | `thread` |
| `POST /offers/:id/negotiate` | the legacy creator counter | `counter`, in legacy mode |
| `POST /negotiations/:id/respond` | the legacy respond, both sides | `counter`, `accept`, `decline` |
| `POST /offers/:id/defer` | the legacy defer | `moveRequest` |
| `jobs/set-expiry.job` | the set's cutoff closing open threads | `endForExpiredSet` |
| `jobs/negotiation-housekeeping.job` | the two silence reminders | `sendReminders` |

The legacy doors pass `legacy: true`, which runs the term snapshot in legacy mode so that invitations
sent before item 5 still validate. Every other rule — the round limit, whose move it is, the cutoff,
the campaign switch, the nothing-changed refusal, the signed-and-final refusal — is enforced once, in
the service, for all of them. **Check 44** proves it: the same three refusals come back from a legacy
route and a new endpoint.

---

## 3. The 48-hour clock is gone

`backend/src/jobs/negotiation-expiry.job.js` is **deleted** and its cron entry removed. Nothing writes
`negotiations.expires_at` any more; the service only ever nulls it, and the column and its index stay
where they are, as approved. The set's invitation cutoff is now the only deadline.

In its place, `jobs/negotiation-housekeeping.job.js` runs hourly at :50 and does three things: expires
pool entries, sends the seven-day closing notice, and sends the two silence reminders — at 48 hours
and at 7 days — **only to the side whose move it is**, stopping the moment the move changes hands or
the invitation closes. A reminder never declines anything.

**Notification keys now in use:** `negotiation.turn`, `negotiation.agreed`, `negotiation.declined`,
`negotiation.expired`, `negotiation.reminder`, `move.requested`, `move.kept`, `move.declined`,
`pool.entered`, `pool.closing`, `pool.closed`, `pool.removed`. The retired job's key is written by
nothing.

**The two remaining 48-hour strings, as asked:**

1. `jobs/offer-expiry.job.js` told the brand an influencer "did not respond … within 48 hours". That
   job has expired invitations at the **posting date** since April 2026, so the sentence was simply
   wrong. **Its copy is changed** to say the invitation passed the posting date.
2. `controllers/campaign.controller.js` still inserts `offer_expires_at = now() + interval '48 hours'`
   in the open-group broadcast. That path is unreachable — no screen creates an open-group set and
   production has none — and item 5's approval said to leave it alone. **Reported, not changed.**

---

## 4. The move request — a defect fixed

**What was wrong.** When a creator asked to be moved to a different date, her invitation ended on the
spot. The status went straight to `deferred` before the brand had seen the request, let alone answered
it. She had asked a question and lost her place by asking.

**What happens now.** Asking writes `move_requested_at` and **changes nothing else**. She keeps the
invitation she had. The brand sees her under "Your move" with "Asked for 27 Oct", and answers one of
three ways:

- **Agree** — an open thread ends as `moved`, the invitation closes as `deferred` ("Moved to your
  pool"), and a pool entry is created carrying **the invitation's terms as they stand**, never a
  counter the brand never accepted.
- **Keep the date** — one tap, no confirm. The invitation is untouched and she can still accept it.
  She is told: "{Brand} are keeping {date}. You can still accept or decline by {date}."
- **Decline** — the invitation ends and she is told.

One request per invitation; the brand's answer settles it. It costs no round and works even when the
campaign's negotiation switch is off, because a creator who cannot make the date must always be able
to say so. **Check 36** proves the fix by naming the old behaviour in the test and asserting it no
longer happens.

---

## 5. The pool

`brand_creator_pool` is brand-level, not campaign-level: it outlives the campaign that created it and
is read when building a set in any other. An entry blocks nothing — it is a note that says "this
creator agreed these terms and needs this date".

An entry moves through four states:

| State | How it gets there |
|---|---|
| `waiting` | the brand agreed to the move; the entry is created with the invitation's terms, the date and mode she asked for, and an expiry at the admin lifetime (30 days) |
| `used` | she was invited from the pool. **For good** — if she then declines or the invitation expires, the entry stays `used` and the brand invites her again the ordinary way |
| `expired` | the lifetime passed with no set; both sides are told. At seven days out, an amber "Closing in {n} days" appears and one notification goes to each side |
| `removed` | either side removed it early |

Building a set from the pool pre-fills Aim, mode, branch and posting date. A wanted date that is now
less than seven days away is shown as "27 Oct · no longer possible" and pre-fills **no** date, because
item 4 would refuse it. A pool creator may be put into any set of the same Aim; when the set's date is
not the date she asked for, her invitation's line names only the terms — "The 12% you agreed on 13
Sep" — and never claims she got the date.

---

## 6. Platform settings, their audit, and the stamping

One admin page at `/admin/settings/platform` (N22) holds three numbers:

| Setting | Default | Range |
|---|---|---|
| negotiation rounds | 2 | 1–5 |
| pool lifetime, in days | 30 | 7–90 |
| shoppable posts minimum | 1 | 1–10 |

Read on any admin role; written on the `settings` capability, whose label now mentions platform
settings. Values are cached for 60 seconds and the cache is busted on write, exactly as the payment
config is. Out of range is refused with "Enter a number between {min} and {max}." Every change writes
one `platform_settings_audit` row per changed key — who, when, the old value and the new — and the
page shows the last change at its foot.

**Every number is stamped on the thing it governs, at the moment that thing is created:**
`min_shoppable_posts` onto the invitation at send, `round_limit` onto the negotiation at the first
counter, the lifetime onto the pool entry when the brand agrees. Changing a setting therefore never
reaches back into anything already live, and always applies to the next one.

---

## 7. Tests

| Suite | Result |
|---|---|
| Backend, whole suite | **229 failed / 982 passed / 1211** |
| Baseline after item 5 | 229 failed / 940 passed / 1169 |
| New failures | **0** |
| New tests | 43, all passing (42 in `backend/tests/item6-negotiation.test.js`, one replacing a rewritten item 4 assertion) |
| Mobile, whole suite | **479 / 479** (baseline 459; 20 new across `item6Creator.test.js` and `item6Brand.test.js`) |

The 229 pre-existing failures are the same 229 as before this item. Three test files were updated
rather than added to: `campaigns.test.js` (the switch is no longer draft-only, so the assertion that
it was refused on a published campaign became an assertion that it succeeds), `item5-invitations.test.js`
(the N20 group order) and `item5Creator.test.js` (Counter now opens the N1 choice sheet instead of the
deleted placeholder screen).

---

## 8. Every check, 1 to 44

All forty-four pass. The full table, with the test that proves each one, is in
`features/item6-negotiation/03-expected-outputs.md`. In short:

- **1–5, countering per Aim** — Pay for Sale, Pay for Content and Hybrid each carry their own terms as
  a whole snapshot; a counter that changes nothing is refused; item 5's limits and messages apply
  identically from either side, because it is the same validator.
- **6–8, rounds** — the third counter is refused, both sides are warned before the last one, and
  changing the admin number leaves an open negotiation alone.
- **9–11, accepting and declining** — accepting rewrites the invitation and drafts the contract; both
  declines end it with a reason the other side sees; both are re-invitable before the cutoff.
- **12–14, time** — nothing is auto-declined at 48 hours, the old job is gone, the cutoff ends an open
  thread with a plain sentence on each side, and a counter after it is refused.
- **15–17, the switch** — off means no button and a refusal; turning it off does not stop an open
  negotiation; the move request is untouched by it.
- **18–20, 36–38, the move request** — the defect above, proved four ways.
- **21–28, 39–41, the pool** — brand-level, grouped, days left, two Aims refused, pre-fill, the fresh
  invitation, eligibility re-checked at send, expiry and early removal, "no longer possible", the
  terms-only line, and the entry staying `used`.
- **29–35, 42–44** — the settings and their audit, the set's group order, Needs You showing one side,
  privacy on every new endpoint, no leak in any creator response, the loading and empty states, the
  stamping, the reminders, and the two doors enforcing one set of rules.

---

## 9. Left open

**For item 7 (the agreement).** Accepting a counter now writes the agreed terms onto the invitation
and drafts the contract through the same call item 5's plain accept uses, so item 7 will find the same
thing whichever road the terms came down. The thread is kept for reference and is never the source of
an agreement. `min_shoppable_posts` is on the invitation, ready to be copied into the agreement.

**For item 8 (pitches).** Pitch rounds were deliberately left alone in this item. A creator's pitch
still has its own separate revision counting, which does not read the new platform setting and does
not go through the negotiation service. Item 8 should decide whether a pitch is a negotiation with the
same rounds, the same thread and the same service, or something genuinely different.

**Not tested end to end.** Per the implementation prompt, the full end-to-end pack runs after item 7.
Everything above is proved by unit and API tests against a real database and by render tests on the
phone screens. The founder's phone walk of checks 1–44 is the functional gate.

---

## 10. Before anything ships

Nothing has been deployed. When the go comes, in this order: apply migration 182, commit, push (which
deploys Render and Vercel, bringing the new admin page with it), then publish the two OTA bundles one
at a time — brand, then influencer.
