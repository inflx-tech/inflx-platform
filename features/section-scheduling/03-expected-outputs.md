# Expected Outputs — Section scheduling + config validation

> Step 3 (cont.). What QA asserts against. "Compiles" is NOT an expected output.

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| 1 | 200; GET row has starts_at/ends_at; follower payload includes section key | API assertions (supertest/jest lane) |
| 2 | 200 on save; follower payload EXCLUDES section key | API assertion on `/follower/section/category/:key` |
| 3 | follower payload EXCLUDES future-start section | same |
| 4 | 422 `{error:{code:'VALIDATION_ERROR', field:'ends_at'}}`; row unchanged | API + DB re-read |
| 5 | 422 field `starts_at` | API |
| 6 | 422 field `config_json.style` | API |
| 7 | 422 field `config_json.tap_destination.page_key` | API |
| 8 | 200; unknown key `kind` round-trips | API GET-after-PUT deep-equal |
| 9 | section `config.timer.ends_at === ends_at` | API payload assertion |

## Data assertions (post-workflow)
- `section_config` columns `starts_at`, `ends_at` exist, type timestamptz,
  nullable, no default (information_schema check).
- All pre-existing rows: both columns NULL after migration (count unchanged).
- No other column of `section_config` altered by migration 124.

## Visual evidence required
- None (backend-only; no UI surface in this contract). The P2 wizard contract
  carries the visual evidence for the date-pickers.
- Network evidence: the follower endpoint responses captured in the QA report
  for steps 1–3 (present → absent transitions).
