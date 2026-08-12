# Part 5 — workflows

The end states `pnpm qa` must prove. Each is written as the actor's journey, because
"it compiled" is never success.

---

## W1 — A commission-only brand never meets a budget field

1. Brand opens campaign creation.
2. Step 1 shows **name, start date, end date, negotiation toggle** — and **no budget
   field**.
3. Brand names the campaign, sets a start date, **leaves end date blank**, continues.
4. Step 2: one set, aim = pay-per-sale, creators invited with commission and allocation.
5. Review: dates read **"1 Sep 2026 → Ongoing"**; no budget row; no wallet card.
6. Publish succeeds.

**End state:** an active, open-ended, commission-only campaign, created without the brand
ever seeing the words budget, wallet, or escrow.

## W2 — An engagement brand never types a total

1. Same Step 1 (no budget field).
2. Step 2: set aim = pay-for-content, set budget ₹40,000, two creators at ₹20,000 each.
3. Step 2's money strip shows **campaign total ₹40,000 — derived**, not an input.
4. Review shows the same total; the wallet card shows the real balance and what is needed.
5. Publish: end date **is** required. Blank → refused at publish naming `end_date`.
6. With an end date, publish succeeds and the wallet locks exactly the derived amount.

**End state:** `campaigns.total_budget` equals the sum of set allocations, written by the
server, never typed. The "set budgets exceed campaign budget" error is unreachable.

## W3 — Hybrid is windowed

1. Campaign with one hybrid set, end date blank.
2. Publish → refused, naming `end_date`, because a fee, escrow and a posting window need a
   calendar.
3. Same for a mixed campaign (one conversion set + one engagement set): **any** non-
   conversion set makes the end date required.

**End state:** only a campaign whose sets are *all* conversion may run open-ended.

## W4 — An open-ended campaign is visible and sellable

1. Publish an open-ended conversion campaign with a contracted creator holding an
   allocation.
2. A follower browsing the app **sees that creator's products** (discovery filters are
   NULL-tolerant).
3. The creator's share link resolves and a coupon can be issued.
4. Commission attributes to the creator on purchase.

**End state:** a NULL end date removes nothing from the follower app. Explicitly asserted
against `LIVE_COLLAB_WHERE`, the Part 4 chain, so a future edit cannot silently reintroduce
the dead-join shape.

## W5 — The brand ends a campaign deliberately

1. Brand opens an active open-ended campaign (web, then mobile).
2. **End campaign** states plainly what will happen: creators' products leave the follower
   app and their links stop selling.
3. Brand confirms → status `completed`, `completed_at` stamped.
4. Participating creators are **notified**.
5. Discovery: those products are gone; the creator's link no longer sells.
6. The campaign reads **Completed**, never *Cancelled*.

**End state:** a deliberate, recorded finish that is distinguishable from an abort.

## W6 — Ending cannot cost a creator money

1. Campaign with an unreleased tranche → **End refused**, naming the pending tranche.
2. Campaign with a deliverable awaiting brand review → **End refused**, naming it.
3. Draft or already-completed/cancelled campaign → refused, status named.
4. In every refusal the campaign stays exactly as it was.

**End state:** the manual path obeys the same protection the cron already applies; the
brand cannot end their way out of an obligation.

## W7 — "Ongoing" everywhere, "—" nowhere

For a campaign with no end date, every surface that shows dates says **Ongoing**:

- web: campaigns list, campaign detail, dashboard tile, wizard review
- mobile: brand campaign detail
- creator: collab detail

**End state:** no surface renders a bare em-dash or a trailing arrow for an intentionally
open-ended campaign.

## W8 — Nothing that worked stops working

1. A dated engagement campaign behaves exactly as before: wallet lock, tranches, posting
   window, auto-complete when the end date passes.
2. The cron still completes dated campaigns and still skips those with pending tranches.
3. All 7 live prod-shaped conversion campaigns (dated, no budget) remain publishable and
   visible.

**End state:** zero regression, proven by the existing suite staying green alongside the
new tests.
