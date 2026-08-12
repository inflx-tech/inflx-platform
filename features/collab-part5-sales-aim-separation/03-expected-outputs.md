# Part 5 — expected outputs

Assertions, mapped to workflows. **Payload-level, not import-level** — per
`feedback_computed_is_not_delivered`, a value being computed is not a value being
delivered, so every "the server derives X" claim is asserted on the response body or the
row, never on the presence of the code that computes it.

---

## Backend

| # | Assertion | W |
|---|---|---|
| B1 | `POST /campaigns` with **no `end_date`** → 201, row has `end_date IS NULL` | W1 |
| B2 | `POST /campaigns` with `end_date` before `start_date` → 422 `end_date` (unchanged) | W8 |
| B3 | Publish, all sets `conversion`, no end date → **200** | W1 |
| B4 | Publish, any set `engagement` or `hybrid`, no end date → **422, field `end_date`** | W2·W3 |
| B5 | Publish, mixed conversion + engagement, no end date → 422 (any non-conversion set counts) | W3 |
| B6 | On set save, `campaigns.total_budget` = **sum of engagement+hybrid set budgets**; conversion sets contribute 0 | W2 |
| B7 | A campaign whose only sets are conversion has `total_budget` = 0 or NULL and **publishes** | W1 |
| B8 | The publish wallet requirement equals the derived total — asserted on the 422's stated shortfall, not on internals | W2 |
| B9 | `POST /campaigns/:id/end` on an active campaign → 200, row `status='completed'`, `completed_at` non-null | W5 |
| B10 | `/end` response **and** the row agree — no computed-but-undelivered status | W5 |
| B11 | `/end` with an unreleased tranche → 422 naming the tranche; row **unchanged** | W6 |
| B12 | `/end` with a deliverable awaiting review → 422; row unchanged | W6 |
| B13 | `/end` on `draft` → 422 naming the status | W6 |
| B14 | `/end` on already `completed`/`cancelled` → 422; not idempotent-silent | W6 |
| B15 | `/end` on another brand's campaign → 404 (ownership, not existence) | W5 |
| B16 | `/end` notifies every creator with a contracted/active assignment — assert **notification rows**, not the call | W5 |
| B17 | `cancel` still refunds locked escrow and writes `cancelled` — `end` did not change it | W8 |
| B18 | Cron still completes a dated campaign past its end date, and still skips one with pending tranches | W8 |
| B19 | Cron **never selects** a NULL-end-date campaign (open-ended campaigns are never auto-completed) | W5 |

## Discovery — the NULL-tolerance guarantee

| # | Assertion | W |
|---|---|---|
| D1 | With a published open-ended conversion campaign + contracted creator + allocation, the creator's products **appear** in follower discovery | W4 |
| D2 | `LIVE_COLLAB_WHERE` keeps its `(c.end_date IS NULL OR …)` clause — pinned as an **invariant on the SQL text**, so an edit that drops it fails loudly | W4 |
| D3 | The creator's share link resolves for an open-ended campaign; a coupon can be issued | W4 |
| D4 | An open-ended campaign whose status becomes `completed` **disappears** from discovery — the documented consequence of §5.3, asserted rather than assumed | W5 |
| D5 | The two hard guards stay NULL-safe: `end_date`-expiry checks do not throw for NULL | W4 |

## Web (brand-web, real pages via Playwright)

| # | Assertion | W |
|---|---|---|
| P1 | Step 1 renders **no budget input** — the "Budget & negotiation" card no longer asks for a total | W1 |
| P2 | Step 1 still renders name, start date, end date, negotiation toggle | W1 |
| P3 | End date carries a hint that blank = ongoing, and **submits blank without a validation error** | W1 |
| P4 | Step 2's money strip shows the **derived** total as text, with no editable total input anywhere in the wizard | W2 |
| P5 | Review shows `… → Ongoing` when the end date is blank | W1·W7 |
| P6 | Review shows no budget row for an all-conversion campaign | W1 |
| P7 | Campaign detail shows **Ongoing** (not `—`) for a NULL end date | W7 |
| P8 | Campaigns list + dashboard tile show Ongoing | W7 |
| P9 | Campaign detail exposes **End campaign** for an active campaign, and the confirm text states that creators' products leave the follower app | W5 |
| P10 | End is absent for draft and for terminal campaigns | W6 |

## Mobile (bundle + unit level; on-device owed at walkthrough)

| # | Assertion | W |
|---|---|---|
| M1 | Brand campaign detail renders **Ongoing** for a NULL end date | W7 |
| M2 | Creator collab detail renders Ongoing — no `1 Sep–—` | W7 |
| M3 | Brand campaign detail exposes End campaign with the same consequence text and guards | W5 |
| M4 | Full production RN bundle builds | W1–W8 |

## Truthfulness

| # | Assertion | W |
|---|---|---|
| T1 | `production.service.js`'s visit-window fallback no longer claims "should never happen — campaign always has an end_date"; the open-ended rule is stated | W4 |
| T2 | No surface anywhere renders wallet/escrow/budget wording for an all-conversion campaign | W1 |

## Regression

| # | Assertion |
|---|---|
| R1 | Existing suite (322 at Part 2 close) stays green; no test weakened, skipped or deleted |
| R2 | A dated engagement campaign's full journey is unchanged end to end |
| R3 | No migration in this contract — `campaigns.end_date` was already nullable in prod |
