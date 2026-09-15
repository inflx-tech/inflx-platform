# Item 8 — the creator's pitch

**Rules:** v1.21 §8 (rewritten), §7B (amended), §8A, §5B, §7, §7A, §9, §25.
**Mockups:** `04-preview/mockups/item8-pitch-locked.html`, T1–T14, locked 15 September 2026.
**Gap report:** `Docs/ITEM8_PITCH_GAP_REPORT.md`, approved with twelve answers.

---

## 1. What this is

A creator proposes a deal to a brand. The brand accepts, counters or rejects.

**Accepting agrees the money and creates nothing else.** She joins the brand's pool
and waits for a set, beside the creators who asked to be moved in item 6. From there
it is the ordinary path: item 4's set, item 5's invitation, item 7's agreement.

> "There is no separate route into a collaboration for a Pitch." — rules v1.21 §8

That sentence is the whole item. Everything else here exists to keep it true.

---

## 2. What it is not

It is not a second negotiation engine, a second set of term rules, a second cooldown
table, or a second way into a collaboration. Item 8 is mostly a **consolidation**: the
front door was genuinely missing, but almost everything behind it existed twice.

---

## 3. The rules, as built

### Who may pitch (§8A)
Item 2's settings are re-checked **server-side on every send** — her paused switch, the
brand's blocks, its Aims, its modes, its niches, followers, engagement, languages and
cities. A hidden button is not a switch-off.

Blocked and paused are byte-identical to her, always.

### The terms (§7)
Item 5's `validateTerms(goal, terms, { mode: 'strict' })`, the same function with the
same messages. Pay for Sale carries a commission and a selling scope; Pay for Content a
fee and a content package; Hybrid a fixed fee plus a commission and no content package.

### Her date and mode
One `proposed_go_live_date`, not a window, at least item 4's seven days out. The mode
becomes required, as item 2 anticipated when it added the column. "Remote" is what she
reads; `shipment` is what the column has held since migration 169, normalised once on
send.

### The limits
One open pitch per brand **per Aim** — a partial unique index, so the database refuses
the second and the service turns the violation into her own sentence. Three open per
brand — one counting query. No limit across brands.

### The response period (approval Q2)
Thirty days by default, admin-controlled, **stamped at send** so a later change never
moves a pitch already in flight. It governs the brand's **first answer only**. Once the
brand has answered — which is what a thread means — the clock has done its job, and the
conversation runs to the early close instead. A brand that counters on day 28 must not
leave her with two days.

Reminders reach the brand once at 7 days and once at 21, only while it still owes that
first answer.

### The early close
A pitch closes when her proposed date comes within item 4's seven-day floor, because no
set can be built for it after that. Her date is the real constraint; the response period
is the cap.

### Negotiation (§7B)
Item 6's engine, anchored to the pitch instead of an invitation. Her pitch is **turn
zero**, written as the opening counter so both sides see old beside new on every line —
but it is the opening position, not a round spent, so a pitch gets the same two counters
an invitation does. Only the brand may open the thread, because she already moved.

### The three answers
- **Accept** — one `brand_creator_pool` entry and nothing else. No campaign, no set, no
  invitation, no contract, no money.
- **Reject** — an optional reason (≤ 200 characters) and a cooldown, thirty days by
  default, admin-controlled and stamped at rejection. Per **brand**, not per Aim. It
  pauses her pitching that brand and never the brand's inviting her.
- **Counter** — item 6's thread.

Withdrawing starts no cooldown. Neither does expiry or the early close.

### Her settings on the way back (§7B, amended)
> "Where the pool entry came from a Pitch the Creator herself sent, her Pitch is the
> more recent and more specific statement: for a Set that matches what was agreed — the
> same Aim and the same Mode of Work — her Aim, Mode, city, category and minimum
> settings are not applied against her."

Those five, and only those five. Two always apply: a creator who has since paused
invitations, or who has since blocked that brand, cannot be invited.

### Her numbers being measured (approval §2.1)
A creator with no measurement fails a follower or engagement minimum because the null is
coerced to zero — which is right for the comparison and wrong for the sentence. On **her
own screens only** the reason becomes `BEING_MEASURED`: "Your numbers are still being
measured." The brand's three coarse codes are unchanged.

---

## 4. What item 8 retires

In gap-report §6 order:

1. The brief path (`invite` with an `agreement_id`) — **closed first, before any new
   feature**, because it skipped item 2's eligibility entirely.
2. The pitch's own negotiation — seven write endpoints, five service functions and the
   per-side round cap.
3. `collab_agreements` as a destination — acceptance writes a pool entry instead. The
   nineteen `ready` rows stay exactly where they are.
4. `brand_collab_requests` — already unreachable.
5. `counter_rounds_per_side` — the last reader is gone; the round limit comes only from
   item 6's stamped `negotiation_rounds`.
6. The dead half of `handshake.service` — nine exports with no caller.

Nothing is backfilled. Nothing is deleted from the database.

---

## 5. What is out of scope

- The admin moderation queue (a backend with no page, unchanged).
- Anything that moves money. Item 8 moves none.
- The nineteen ready agreements: left to their existing ninety-day clock, not converted,
  not notified about, not shown anywhere (approval Q6).
