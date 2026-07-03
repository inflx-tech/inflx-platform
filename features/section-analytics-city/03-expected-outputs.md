# Expected Outputs — Section analytics + city scope

| Step | Observable output | How verified |
|---|---|---|
| 1-2 | PUT 200 scope_type=city; GET lists the city stack | API |
| 3 | payload includes city section only for that city | API compare (two cities) |
| 4 | same-shelf_key city row replaces global for that city | API payload diff |
| 5 | 204 + section_events row (all fields) | API + DB re-read |
| 6 | 204, zero rows for junk event | API + DB count |
| 7 | admin analytics = exactly the posted counts + uniques | API deep-equal |
| 8 | 📊 panel renders counts / empty state | Playwright |
| 9 | emit code transforms clean; contract fields match endpoint | babel + review |
| 10 | pnpm qa 79/79; non-city payloads unchanged | QA report + API compare |

## Data assertions
- section_events columns/indexes per migration 125; no default rows.
- Event write requires nothing but the minimal payload; follower_id captured
  when a JWT is present, NULL otherwise.
- Admin endpoint capability-gated (existing sections capability).

## Visual evidence
- before: 04-preview/mockups/00-analytics-city.html · after: 06-diff/after/
  (builder with city input + 📊 panel populated).
