# Part 6 — expected outputs

Payload-level, per `feedback_computed_is_not_delivered`: every "the creator can now see X"
claim is asserted on the response body, never on the presence of the code that builds it.
This matters more here than usual — §6.1 exists precisely *because* a value that is
computed and stored is delivered to nobody.

---

## Backend

| # | Assertion | W |
|---|---|---|
| B1 | The creator's collaboration detail **returns `agreement_id`** — asserted on the payload | W1 |
| B2 | For an agreement-backed collaboration it also returns the settled terms and the date they were agreed | W1 |
| B3 | For a cold invite those fields are null/absent — no phantom "already agreed" group | W2 |
| B4 | The detail returns the **allocation scope** (`store` / `category` + name / `products` + count) | W3 |
| B5 | The allocation summary agrees with `GET /influencers/me/campaigns/:id/products` — a summary that claims a scope the product list contradicts is a defect, not a display choice | W3 |
| B6 | Brand discovery accepts `category` and filters on it | W4 |
| B7 | Brand discovery accepts `city` and filters on it | W4 |
| B8 | Filters compose with the existing name search, and each is independently optional | W4 |
| B9 | Discovery still returns only brands with `accepts_proposals = TRUE` and `users.status = 'approved'` — filters narrow, never widen | W4·W6 |
| B10 | The available filter values are derived from listed brands only, so no empty option is ever offered | W4 |
| B11 | Negotiation is still refused for an agreement-backed collaboration and still allowed for a cold one — the Part 2 rule, re-pinned because this contract changes the screen around it | W1·W2 |

## Absence, pinned deliberately

| # | Assertion | W |
|---|---|---|
| A1 | **No route writes `campaign_influencers.status = 'applied'`** — the application flow stays unreachable, so a future half-build is a deliberate act rather than an accident | W5 |
| A2 | The brand-side approve/reject application handlers still exist and are untouched | W5 |

## Mobile / web

| # | Assertion | W |
|---|---|---|
| M1 | The creator's collaboration screen renders two groups, and settled terms carry the agreed date | W1 |
| M2 | A cold invite renders one group and the full accept/decline/negotiate choice | W2 |
| M3 | The allocation summary is rendered in words, not a raw scope key | W3 |
| M4 | Brand discovery exposes category + city filters, populated from real data | W4 |
| M5 | Full production RN bundle builds | W1–W6 |
| P1 | The web brand-browse surface exposes the same two filters | W4 |

## Regression

| # | Assertion |
|---|---|
| R1 | Existing suite (363 at Part 5 close) stays green; no test weakened, skipped or deleted |
| R2 | No migration — `agreement_id` and `alloc_*` already exist from Parts 2 and 4 |
| R3 | The cold-invite negotiate path is unchanged |
