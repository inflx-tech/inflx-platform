# item3b-social-numbers — workflows

## W1 — Register (R1)
Step 1 name + city → step 2 accounts → `POST /influencers/register {name, city?, instagram_handle?, youtube_handle?}`.
Server: at least one handle (`Add at least one account.`), formats (`Enter a valid Instagram username.` /
`Enter a YouTube handle or channel link.`), handles saved normalised, `creator_social_accounts` rows in
`waiting_approval`, no Apify run, no n8n call, a minimal `creator_profiles` row (Instagram-first; YouTube-only
sign-ups get a row without ig_handle) → the existing Waiting screen.

## W2 — Approve (admin)
`POST /admin/creator-verifications/:id/verify` → users approved → every waiting account `measuring`,
ownership confirmed, due now → a full run per account starts at once (outside tests) →
run rows (with Apify run id + cost), profile snapshot, every post, metrics (current + history), state
`ok`, write-through to the five legacy columns; profile due +7 d, posts due +15 d.

## W3 — Schedule (hourly job `social-measure`)
Budget guard (Apify month usage ≥ `APIFY_MONTHLY_BUDGET_USD` → skip scheduled runs, flag once a month)
→ pick due accounts of approved creators `FOR UPDATE SKIP LOCKED` (batch, concurrency) → run type:
profile / posts / full → outcomes: success → ok; not found / private → state + columns cleared;
technical failure → failing (numbers kept) or measuring (none yet), retry next day, flag after 3;
Apify refusal → `budget`, nothing else changes.

## W4 — Brand reads (S1–S4)
`GET /influencers/:id` → `social.instagram|youtube` with the coarse state (`ok | updating | unavailable | stale`)
and the three card numbers → `GET /influencers/:id/social/:platform` → every number, window, dates.

## W5 — Creator reads and acts (R3–R5)
`GET /influencers/me/social` → both platforms with the internal state + chip → `GET …/:platform` detail →
`POST …/:platform/check-again` (private/failing only; 429 `You can check again once a day.`).

## W6 — Handle change / add / remove (R6, A5)
`PATCH /influencers/me {instagram_handle | youtube_handle}` → before approval: just saves; after approval:
change/add → old row replaced, numbers cleared, new row `waiting_check` → admin **Confirm**
(`POST /admin/social/accounts/:id/confirm` → measuring + full run) or **Reject** (`rejected`);
remove → allowed only while the other platform stays (`Keep at least one account.`), numbers cleared.

## W7 — Admin
`GET /admin/social/handle-checks`, `GET /admin/social/flags` (+ resolve), `POST …/accounts/:id/measure-now`,
`GET /admin/social/costs`, `GET /admin/influencers/:id/social`; `POST /influencers/:id/rescrape` now
routes to Measure now.

## Release (once)
Migrations 175–178 (dry run first) → `scripts/run-social-backfill.js --dry|--apply` spreads every approved
creator's first full run over `SOCIAL_BACKFILL_DAYS` (3) → the hourly job measures them under the budget.
