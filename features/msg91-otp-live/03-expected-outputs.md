# Expected Outputs — MSG91 live OTP delivery

> Step 3 (cont.). Defined BEFORE coding.

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| 1 | `POST /v1/auth/send-otp` → 200 `{success:true}`; exactly one outbound POST to `control.msg91.com/api/v5/otp` | jest + mocked axios: assert call count, URL, `authkey` header, `template_id`, `mobile`, `otp` params |
| 1 | `mobile` param is bare digits — `+919876543210` → `919876543210` | jest assertion on the captured request params |
| 1 | `otp` param equals the code persisted in `otp_codes` | jest: read the inserted row, compare to captured param |
| 2 | SMS arrives at the handset from sender INFLX | manual production check — not automatable |
| 3 | `POST /v1/auth/verify-otp` → 200 with access + refresh tokens | existing `backend/tests/auth.test.js` coverage, unchanged |

## Data assertions (post-workflow)
- `otp_codes` gains exactly one unused, unexpired row per send; any prior
  unused row for that phone is `used = true`.
- On MSG91 failure the endpoint returns 502 and the caller receives no
  success envelope. (The `otp_codes` row may exist and simply expire — it is
  unusable without the SMS, and TTL reaps it in 10 minutes.)
- No new tables, columns, or migrations.
- Money/attribution: untouched.

## Negative assertions (regression-critical)
- With `OTP_MOCK=true`, zero network calls are made and the code is `000000` —
  the entire existing test suite must keep passing unchanged.
- MSG91 answering `200 {"type":"error"}` must raise, not resolve.
- No log line contains the OTP code or the full subscriber number.

## Visual evidence required
- None. Backend-only, no UI surface changed → mockup-lock and before/after
  diff gates are not applicable (UI-governed gates only).
- Network evidence: one successful live `send-otp` against production,
  confirmed by an SMS on the founder's handset.
