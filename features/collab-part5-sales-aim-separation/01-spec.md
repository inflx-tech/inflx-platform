# Part 5 — Separating the sales aim

**Program:** `Docs/COLLAB_RESTRUCTURE_PLAN.md`, part 5 of 7. Parts 1, 4 and 2 (which
absorbed 3) have shipped. This is the part the founder's very first message in the
program was about: *"sales means brands pay commission only … so in this case we don't
have any prebudget allocation, but we have budget mentioned in this sales flow. next end
and start dates … we choose end and start dates for offers only, not for campaign."*

---

## 0. Why this is not cosmetic — what production actually looks like

Verified against prod on 2026-08-12:

| Fact | Value |
|---|---|
| Campaigns | 10 |
| `status = active` | **7 — every one of them `conversion`** |
| `status = draft` | 3, no sets yet |
| `total_budget IS NULL` | **10 of 10** |
| Sum of `set_budget` | **NULL — no set has ever carried a budget** |
| `end_date IS NULL` | **0 of 10** |

**Every real campaign on the platform is commission-only.** Every one was made to fill in
a budget field that means nothing to it, and to name an end date it does not want — while
the one number the platform actually has (a set's allocation) has never been used.

So this part fixes the flow that **100% of live campaigns use**, not an edge case.

## 0.1 Two plan claims corrected before locking

The Part 5 section of the program plan asserted two things that are **no longer true**.
Recorded here so they are not re-derived later:

1. *"campaigns with no dates already exist in production via the old acceptance path"* —
   **false now.** `end_date IS NULL` is zero rows. Part 2 replaced that acceptance path
   before it ever fabricated a stub, so there is no precedent in prod. The NULL end date
   introduced here will be genuinely new data, which is why §2's read-path audit was done
   rather than assumed.
2. *"Asked of every brand today, before the aim is even known"* (budget) — **half stale.**
   Part 1 already made the budget conditionally *required* (`needsBudget(g) => engagement
   || hybrid`) and hid the money card when no set needs funding. What remains is that the
   **field itself still greets every brand in Step 1**, before any aim is chosen.

## 0.2 What is already correct — do not touch

- **The money layer is aim-separated.** Wallet lock is fee-driven; escrow tranches follow
  the fee; publish only checks the wallet when a set is engagement or hybrid
  (`hasEngagementOrHybrid` at `campaign.controller.js:1442`). A commission-only
  collaboration already locks nothing and creates no tranche.
- **`campaigns.end_date` is already nullable** (prod-verified). **No migration in Part 5.**
- **Every filtering read is already NULL-tolerant** — see §2.

---

## 1. §5.1 — Budget stops being a question

**Today.** Step 1 carries a *"Budget & negotiation"* card asking **Total campaign budget
(₹)** of every brand — before a single set, and therefore before any aim, exists. Step 2
then asks for per-set and per-influencer budgets, and a validator complains when the parts
exceed the whole the brand guessed at earlier (`Total set budgets exceed campaign budget
by ₹…`).

**Change.** The campaign total becomes **derived, not entered**: the sum of what the
brand allocates to engagement and hybrid sets. Step 1 keeps name, dates and the
negotiation toggle. The total is displayed where the money is actually committed — Step 2's
budget strip and the review panel — and written into `campaigns.total_budget` on save.

**Why derive rather than drop.** Keeping the column means **every existing reader is
untouched**: the publish wallet gate, set-budget checks, dashboards, reporting. Nothing
migrates, nothing is deleted, and no read path has to learn a new shape. And a total
defined as the sum of its own parts **cannot be exceeded** — the entire
"budget exceeded / reduce set budgets" error class disappears by construction rather than
by being suppressed.

**Result.** A commission-only brand never sees a budget field at all. An engagement brand
never types a number that has to agree with arithmetic it hasn't done yet.

This also closes a latent trap: today a draft with engagement sets and set budgets but a
blank campaign total is **refused at publish** (`Campaign must have a total_budget set
before publishing`) with no way for the brand to see why the sets they funded aren't
enough. Deriving the total removes the contradiction.

## 2. §5.2 — Sales collaborations run open-ended

**Today.** End date is required at creation, in both places: the wizard
(`page.js:778`, `:1086`) and the backend (`campaign.controller.js:342`). A brand selling
on commission until stock runs out has to invent a date.

**Change.** End date becomes **optional at creation**. The aim-aware rule moves to
**publish**, where the aim is finally known:

> **End date is required unless every set is `conversion`.**

This deliberately mirrors the budget gate that already sits ten lines away, so the two
rules read as one idea: *what a campaign must state depends on how it pays.*

**Hybrid is windowed, not open-ended** (resolving the plan's open question). Hybrid
carries a fee, and therefore escrow tranches, a posting window, tranche-3's +30-day clock
and the backwards-computed visit window. All of those need dates. Only a
**pure-commission** campaign has nothing to date.

**Read-path audit — this is NOT the dead-offer-join shape.** Every filtering site was read
before this was proposed. All 16 are written NULL-tolerantly:

```
AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
```

- `follower.controller.js` ×6 · `follower.service.js` ×4 · `sectionRules.service.js` ×2
  (incl. `LIVE_COLLAB_WHERE`, the Part 4 chain) · `sectionLibrary.service.js` ·
  `creatorPosts.service.js` · `followerPosts.service.js` · `saved.controller.js`
- The two hard guards are `if (r.end_date && …)` — NULL-safe by construction:
  `follower.controller.js:1785`, `transaction.service.js:182`.

So an open-ended campaign stays **visible and sellable**. The failure mode that made the
dead offer join dangerous (an INNER JOIN eliminating every row) does not exist here.

**One honest consequence.** `production.service.js:53` uses the campaign end date as the
last fallback for the latest permitted store-visit date, guarded by a comment reading
*"Should never happen — campaign always has an end_date."* Part 5 makes that assumption
false on purpose. The fallback already behaves sanely (one year out); the comment must
stop claiming impossibility and state the open-ended rule instead. Behaviour unchanged,
truthfulness restored.

## 3. §5.3 — An explicit End

**Today — the gap that makes §5.2 unsafe on its own.**

- The auto-complete job selects on `WHERE c.end_date < CURRENT_DATE`
  (`campaign-status.job.js:11`). A NULL end date **never matches**, so an open-ended
  campaign is never even considered for completion.
- Nothing anywhere decrements stock — verified: no `SET stock` / `stock = stock -` in
  `backend/src`. So *"runs until stock sells out"* can never self-detect its own end.
- `cancel` exists but is **an abort, not a finish**: it refunds locked escrow and records
  `status = 'cancelled'`. Using it to close a sold-out campaign would file a success as a
  failure, and would read to the creator as the brand pulling out.

Without an explicit End, making campaigns open-ended would create collaborations **with
no way to ever close them**.

**Change.** A brand-facing **End campaign** → `status = 'completed'`, `completed_at = NOW()`
— the same terminal state the cron already writes, reached deliberately instead of by
calendar.

**Guards (a creator must never lose money to a click):**
- Refuse while any tranche is still unreleased — reuse the cron's own pending-tranche
  check verbatim, so manual and automatic completion apply one rule.
- Refuse while any deliverable is awaiting brand review — ending would strand submitted
  work unpaid and unreviewed.
- Refuse for `draft` / already-terminal campaigns, with the reason named.

**Ending is consequential, so it says so.** Because discovery requires
`c.status IN ('published','active','live')` (`LIVE_COLLAB_WHERE`), completing a campaign
**removes every participating creator's products from the follower app and stops their
links selling.** That is the correct meaning of "this collaboration is over" — but the
brand is told it in those words before confirming, and **participating creators are
notified**, rather than discovering it as silent breakage.

**Surfaces.** Web (campaign detail) **and mobile** — per the locked brand-mobile scope,
only campaign *creation and listing* are web-only; everything else must work on a phone.

## 4. §5.4 — Sales-appropriate presentation

**Today.** No wallet or escrow language leaks into a commission-only campaign (Part 1
fixed the money card). What is wrong is that a missing end date reads as **missing data**:

- `campaigns/[id]/page.js:452` → `1 Sep 2026 → —`
- `BrandCampaignDetailScreen.js:251` → the same em-dash
- `CollabDetailScreen.js:161` (creator) → `1 Sep–—`
- wizard review `page.js:1725` → `2026-09-01 → ` (bare)

**Change.** A NULL end date renders as **"Ongoing"** — an intentional state, not an
absence — everywhere a campaign's dates are shown: web list, detail, dashboard, wizard
review; mobile brand detail; creator collab detail. The creator's view matters most: a
sales collaboration that says *Ongoing* tells them their links keep working, which is the
whole point of the change.

---

## 5. Scope boundary

**In:** the four items above. Web + mobile + backend. No migration.

**Out, explicitly:**
- Open-group joiners carrying no allocation and no `commission_pct` — a Part 4 leftover
  with its own defect shape; not smuggled in here.
- `resolveBusinessStore` computing no offer fields (Part 4 leftover).
- Deleting the transitional legacy allocation fallback (Part 4 leftover).
- The web group/broadcast composer entry points (Part 2 leftover).
- Parts 6 and 7.
- Any **approval ceiling** concept. Deriving the total answers the plan's "ceiling or
  drop?" question by making a ceiling meaningless. If spend approval is ever wanted it is
  a separate feature with its own contract, not a field quietly left behind here.

## 6. Founder decisions requested at lock

Both of the plan's stated open questions, with a recommendation:

1. **Budget: optional ceiling, or drop the concept?** → **Neither — derive it** (§1). Keep
   the column so every reader is untouched; stop asking the brand.
2. **Hybrid: open-ended, or its posting window?** → **Windowed** (§2). End date required
   unless *every* set is conversion.
