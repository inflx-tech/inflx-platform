# item3b-social-numbers — expected outputs

The 25 checks from `PROMPT.md` §8.3 plus the six the founder added (`APPROVAL.md` §5). "Proof" names the
automated test; "Live" the end-to-end run on the local database with real Apify (`06-diff/notes.md`).

| # | Check | Expected | Proof |
|---|---|---|---|
| 1 | Registration | At least one account; format errors with the exact text; **no** Apify run queued | `item3b-pipeline › A6`; live step a |
| 2 | Approval | A full run per added handle; pending creators never measured | `item3b-pipeline › approval`, `pending creator is never measured`; live step b |
| 3 | Instagram numbers | Match §3.6 on the fixtures and on a live account | `item3b-calculators › Instagram`; live step c (hand recomputation) |
| 4 | YouTube split | Long vs shorts by tab; streams excluded; duration fallback only when the tab is unknown | `item3b-calculators › YouTube`; probe (`type: "stream"` from the /streams tab) |
| 5 | YouTube engagement | On views, per type | `item3b-calculators › hand case`; live step c |
| 6 | "—" never 0 | Empty averages show "—"; 0 posts shows "0" and the S4 line | `item3bBrand › S4`; calculators (null) |
| 7 | Profile schedule | Profile numbers refresh 7 days after the last profile run | `item3b-pipeline › scheduler`; live step g |
| 8 | Posts schedule | Posts refresh 15 days after the last posts run, whole 90-day window | same |
| 9 | Failures | Last good numbers kept with their date (`stale`), retry next day, flag after 3 | `item3b-pipeline › technical failure…` |
| 10 | Not found / private | Brands: "Numbers not available"; creator: the right R5 copy and action | `item3b-pipeline › not found…`; `item3bCreator › R5` |
| 11 | Check again | Only private/failing, once per 24 h per platform (429) | `item3b-pipeline › not found…`; `item3bCreator › R5` |
| 12 | Handle change/add | Clears numbers, goes to admin, measured only after Confirm; Reject → rejected | `item3b-pipeline › handle change`; live step f |
| 13 | Remove | Only while the other platform stays | `item3b-pipeline › same handle…`; `item3bCreator › R6` |
| 14 | Existing columns | Written after success; cleared on the six events; Discover, item 2, website search still work | `item3b-pipeline` (write-through asserts), `item3-discover` still green; live step h |
| 15 | S1 | Cards only for added platforms, exact numbers and labels | `item3bBrand › S1` |
| 16 | S2 / S3 | Every tile, window label, formula text, footer date exactly | `item3bBrand › S2 · S3` |
| 17 | R3 chip | Fix > Waiting > Measuring | `item3bCreator › R3`; server `chipFor` |
| 18 | R4 | Measured dates and next update date | `item3bCreator › R4` |
| 19 | Brand privacy | No internal states, reasons, ownership, costs, pending creators | `item3b-pipeline › what a brand sees` |
| 20 | Budget guard | Scheduled runs stop at the limit and flag once; approval/admin runs go | `item3b-pipeline › budget guard` |
| 21 | Ceiling | 500 honoured and flagged | `item3b-pipeline › safety ceiling` |
| 22 | Old paths gone | Nothing outside the pipeline writes the five columns | `item3b-pipeline › the old paths are gone` (source scan) |
| 23 | Backfill | Every approved creator queued, spread over N days | `scripts/run-social-backfill.js --dry` (prod dry run in `06-diff/notes.md`) |
| 24 | Admin | Confirm/reject handles, flags, Measure now, monthly cost | `item3b-pipeline › handle change`, `idempotent…`; admin pages |
| 25 | Tests | No new failures vs the baseline (229 / 869 / 1098); new tests pass | `06-diff/notes.md` |
| 26 | Budget refusal | Recorded as `budget`; no failure count, no failing, admin flagged once | `item3b-pipeline › Apify credit refusal`, `budget guard` |
| 27 | No scraping at registration | No n8n A2, no Apify; approval works for Instagram-only and YouTube-only | `item3b-pipeline › A6`, `YouTube-only`; live step a/b |
| 28 | YouTube-only creator | Registers, approved, measured, Discover with Engagement "—", S1 with a YouTube card only | `item3b-pipeline › YouTube-only` |
| 29 | Release | Existing creators show "—" and "Numbers are being updated" until the first real run | migration 176 (`run-175-178.js --dry` counts) |
| 30 | Token never appears | Not in logs, errors, responses, fixtures or commits | grep of repo + fixtures (`06-diff/notes.md`); runner uses the Authorization header |
| 31 | Spend | Probe + tests within US$2/US$3; run log matches the Apify console | `06-diff/notes.md` costs |
