# Before / after — separating the sales aim

Mockup: `04-preview/mockups/sales-aim.html` (9 panels, locked 2026-08-12).
Prediction: `04-preview/workflow-prediction.md` — written before implementation, checked
against below.

Rendered-page proof: `qa/web/brand/campaign-derived-dates-budget.spec.ts` (7 tests against
the real wizard). Rule + wiring: `qa/unit/campaign-rollup-derivation.spec.ts` (12) and
`qa/unit/campaign-end-and-open-ended.spec.ts` (25).

---

## Campaign creation — two questions left

**Before.** Step 1 asked every brand for an **end date** (required) and a **Total campaign
budget**, before a single set existed and therefore before the campaign's aim was known. A
commission-only brand — which is *every* live campaign on the platform — typed a budget
that meant nothing to it and invented an end date it did not want. That invented date then
closed the campaign and pulled its products out of the shopping app while stock remained.

**After.** Step 1 asks for a name, a start date and the negotiation toggle. Both other
values are derived from the sets and written by the server on every set write:

- **total** = the sum of `set_budget` across paid (engagement/hybrid) sets.
- **end date** = **NULL if any set is conversion**; otherwise the latest paid
  posting-window end.

The wizard shows the same values as text — Step 2's money strip reports the derived total
plus "Campaign ends <date|Ongoing>", and the review header reads `1 Sep 2026 → Ongoing`.

**Two error classes became unreachable, not suppressed:**
- *"Total set budgets exceed campaign budget by ₹X"* — the total **is** that sum.
- *"Window end cannot be after campaign end"* — the last paid window **is** the end.

Their code is deleted, along with `campRem()`, the over-budget banner, the publish-button
disable, and the `endDate`/`totalBudget` state that backed the inputs.

## End campaign — the deliberate finish

**Before.** Only **Cancel**, which refunds escrow and records `cancelled` — an abort. Using
it on a sold-out campaign filed a success as a failure and showed the creator that word.
And nothing else could close an open-ended campaign at all: the nightly job selects
`end_date < CURRENT_DATE`, which NULL never matches, and nothing in the codebase decrements
stock, so "runs until stock sells out" cannot detect its own end.

**After.** `POST /campaigns/:id/end` → `completed` + `completed_at`, on web and on the
phone. It refuses, naming the reason and leaving the campaign untouched, when:

- escrow is still `locked`/`queued`/`processing`/`disputed` (verified against the real
  enum; `released` is paid and `refunded` has gone back, so neither blocks), or
- a deliverable is `submitted`/`under_review` — work already handed to the brand.

Both checks throw **before** the UPDATE, asserted by index ordering so a refusal can never
leave a half-ended campaign. Participants with a contracted/active/completed assignment are
notified (`campaign.ended`, deep-linked to Collabs on the phone).

The confirmation states the consequence up front — products leave the shopping app, links
stop earning, commission already earned is unaffected, recorded as Completed not cancelled —
because completing genuinely removes them from discovery (`c.status IN
('published','active','live')`).

## "Ongoing" instead of an em-dash

`1 Sep 2026 → —` became `1 Sep 2026 → Ongoing` on web campaign detail, the campaigns list,
the CSV export, the dashboard tile, the wizard review, the mobile brand detail, and **the
creator's own collab detail** — which is the one that tells them their links still work.

---

## Predictions vs what shipped

The prediction file named five things most likely to be wrong. Four held; one was resolved
and one item tightened:

1. **"No editable campaign total anywhere"** — held. Per-set and per-influencer budget
   inputs remain (correctly); only the campaign-level input went. P4 asserts the specific
   absence, and P2 counts inputs: Step 1 now has exactly **one** date input and **zero**
   number inputs.
2. **Which date field the end date derives from** — **resolved to `window_end`.**
   `campaign_sets.content_end_date` exists and `production.service` reads it, but **nothing
   in either app has ever written it**, so it cannot contribute. Recorded in the service
   header so this is not re-derived.
3. **Five consequence lines in the End confirm** — held on web (all five). On mobile they
   are one paragraph in a native `Alert`, which has no room for a table. Same five facts.
4. **"No wallet card for sales campaigns"** — as predicted, this was **already true from
   Part 1**, which hid the money card when nothing needs funding. Credited to Part 1, not
   claimed here.
5. **Phone End button placement** — shipped under the stage rail rather than at the very
   bottom, which is where that screen's action area actually is. Same guards, same text.

**One promise in the mockup was deliberately dropped.** Panel ⑦ showed *"It's scheduled for
12 Oct. You can end after that."* Tranche 3 releases N days after `triggered_at` where N is
admin-configurable, so any date printed there could be wrong. The message now states the
count and the amount — facts — and "once they clear".

## What the checks caught

- **A real syntax error, caught only by the mobile bundle.** An apostrophe in
  *"Creators' products"* closed the single-quoted string in the phone's confirmation.
  `pnpm qa` was green and could not see it — the bundle is the only check that resolves the
  mobile module graph. Fixed to a double-quoted string.
- **Four of my own assertions collided with my own comments.** Tests asserting a removed
  label was gone matched the comment explaining its removal — meaning deleting the
  explanation would have made them pass. Fixed by stripping comments before absence checks,
  so they assert about code, not prose. One further assertion (`'completed'` absent from the
  discovery chain) was too crude: `'completed'` legitimately appears in the *creator*-status
  clause beside the campaign-status one. Narrowed to the campaign clause.
- **A duplicated rule.** `recompute()` and `derive()` each implemented the derivation. Now
  `recompute` is read → `derive` → write, with a test asserting the rule's moving parts
  appear nowhere inside `recompute` — otherwise the write path could silently diverge from
  the tested one while every other assertion kept passing.
- **First `pnpm qa` run reported FAILED at 357 tests**, then GREEN at 363 twice in a row.
  The known mid-write spec-glob race (documented precedent), not a weakened test: nothing
  was skipped, deleted or relaxed to reach green.

## Not in this diff, and deliberately so

- **The 7 live prod campaigns keep their stored end dates.** Derivation runs on **set**
  writes only — `PATCH /campaigns/:id` no longer accepts the derived fields and does *not*
  recompute, so renaming a live campaign can never silently change when it ends. Those
  campaigns become open-ended the first time a brand edits one of their sets. A one-time
  normalisation is a data decision for the founder, not something to smuggle in here.
- **A genuine defect found in passing, filed separately:** `cancel` writes
  `escrow_entries.status = 'cancelled'`, which is not in the `escrow_status` enum
  (`locked, queued, processing, released, disputed, refunded`). Cancelling a **funded**
  campaign therefore throws inside the transaction — no cancellation, no refund. Latent
  because `escrow_entries` is empty in production. Not fixed here; it is a money path that
  needs its own contract and its own go.
- No migration. `campaigns.end_date` was already nullable in prod.

Suite: **363 passed, gate 0, STATE=GREEN** (twice). Mobile: jest 131/131, full production
RN bundle builds. Maestro skipped per founder — `released` stays false.
