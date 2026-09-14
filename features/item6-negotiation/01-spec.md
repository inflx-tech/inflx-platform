# item6-negotiation — spec

Rules doc **v1.18** §7B (amended 14 Sep 2026 after the gap check), with §3.4, §4.11, §5, §7, §7A,
§8A, §15.1, §21, §25. Locked mockups `04-preview/mockups/item6-negotiation-locked.html` (N1–N22 plus
the rules table at the foot of that page). Gap report `Docs/ITEM6_NEGOTIATION_GAP_REPORT.md`, approved
with twelve answers and four further decisions in `APPROVAL.md`. Prompt in `PROMPT.md`.

## What item 6 delivers
A creator who has an invitation can answer it with a **counter** instead of yes or no, and the two
sides go back and forth in a **thread** until someone accepts, someone declines, or the set's cutoff
arrives. Separately, a creator who cannot make the set's date or mode can **ask to be moved** — which
is not a counter — and the brand agrees, keeps the date, or declines. Agreeing puts her in the brand's
**pool** with her terms kept, waiting for a set that fits. Three numbers the rules now depend on move
to one admin **Platform settings** page.

## The rules, as built
- **A turn is a whole snapshot, never a delta.** Every turn stores `terms_json` in item 5's normalised
  shape for the set's Aim. The invitation is turn zero. The old → new lines a screen shows are derived
  on read by `changesBetween` and are never stored.
- **Negotiable by Aim (§7B):** Pay for Sale — commission only. Pay for Content — fee, deliverables and
  usage rights together. Hybrid — the fixed fee and the commission. The Aim, the selling scope, the
  follower offer and the shoppable-post minimum are never negotiable. Item 5's limits and its exact
  messages apply identically to a counter from either side, through the same validator.
- **A counter that changes nothing is refused** with "Nothing has changed. Change something or go back."
  The comparison canonicalises (it sorts usage-rights places) so that re-ordering alone is not a change;
  display never re-orders.
- **Rounds.** `round_limit` is stamped on the negotiation at the first counter from the admin setting
  and never changes for that negotiation. `countersUsed` is derived from the turns. The (limit + 1)th
  counter is refused with "There are no counters left in this negotiation." `isLastRound` rides in the
  thread response so both apps warn before anything is sent.
- **Turn order.** `current_turn` stays stored, written on every turn, and guarded by `WRONG_TURN`
  ("It isn't your move yet.").
- **Accepting rewrites the invitation** — all four term columns plus `answered_at` — sets the outcome
  `agreed`, ends the negotiation, notifies the other side, and drafts the contract through the same
  call item 5's plain accept uses. The agreement (item 7) is always generated from the invitation.
- **Declining.** The brand's decline sets the invitation `rejected_by_brand` with `outcome
  declined_by_brand` and an optional note the creator sees. Hers sets `declined` with one of item 5's
  five reasons. Both are re-invitable before the cutoff.
- **No 48-hour clock.** The auto-decline job is deleted and unscheduled, `expires_at` is no longer
  written, and the column and its index stay. The set's invitation cutoff is the only deadline. A
  counter after the cutoff is refused from either side.
- **Reminders, not deadlines.** At 48 hours and at 7 days of silence one notification goes to the side
  whose move it is, and stops the moment the move changes hands or the invitation closes.
- **The set's cutoff** closes an open thread as `expired` with one plain sentence per side; the thread
  stays readable. `deferred` rows are still left alone.
- **The switch (§4.11).** `campaigns.allow_negotiation` is changeable at any time, not only in draft.
  Off means no Counter button and a refusal from the API with "{Brand} aren't taking counters on this
  campaign." Turning it off does not stop a negotiation already open. It does **not** govern the move
  request. `payment_config.allow_commission_negotiation` is no longer read in the counter path.
- **The move request — the defect fixed.** Asking to move no longer ends the invitation. It writes
  `move_requested_at` and leaves the status alone; the row appears to the brand under "Your move" with
  "Asked for 27 Oct". One request per invitation; the brand's answer settles it. Agreeing ends an open
  thread as `moved` (the fifth outcome), closes the invitation and creates a pool entry carrying the
  **invitation's terms as they stand**, never an unaccepted counter. Keeping or declining leaves the
  thread exactly where it was, and she is notified either way.
- **The pool** is its own brand-level table, `brand_creator_pool`: it outlives the campaign, is read
  across campaigns, and carries a lifetime and a state (`waiting` → `used` / `expired` / `removed`).
  It blocks nothing. Entries expire at the admin lifetime, default 30 days, with one notification; an
  amber "Closing in {n} days" and one notification to both sides appear at seven days. Either side may
  remove an entry earlier. A used entry is never resurrected.
- **From the pool.** A pool creator gets a fresh invitation with eligibility re-checked at that moment.
  She may be put into any set of the same Aim. When the set's date is not the date she asked for, the
  invitation's line names only the terms — "The 12% you agreed on 13 Sep" — and never claims the date.
  A wanted date now less than seven days away groups as "27 Oct · no longer possible" and pre-fills no
  posting date.
- **Platform settings.** Keyed rows in `platform_settings` with `platform_settings_audit`, cached for
  60 seconds like `payment_config` and busted on write, one audit row per changed key. Three settings:
  negotiation rounds (2), pool lifetime days (30), shoppable posts minimum (1). Read on any admin role,
  write on the `settings` capability. **Every admin number is stamped on the thing it governs when that
  thing is created** — `min_shoppable_posts` at send, `round_limit` at the first counter, the pool
  lifetime at entry creation.
- **One service, two doors (APPROVAL §3.1).** Counter, accept, decline, move-request and move-answer
  live in `services/negotiation.service.js`. The new endpoints and the legacy `/offers/:id/negotiate`
  and `/negotiations/*` routes are thin wrappers over it. The legacy doors run the snapshot in
  `'legacy'` mode so invitations sent before item 5 still validate.
- **Needs You.** `counters_to_answer` on each side is driven by `current_turn`; `collabStep` reads it
  instead of assuming the creator owes; the brand's count is filtered to its own move.
- **Privacy.** Another brand's thread, pool entry or settings request → 404; another creator's counter
  or accept → 404. No creator response carries the brand's note, the minimum warning, the campaign
  description or any other creator's terms.
