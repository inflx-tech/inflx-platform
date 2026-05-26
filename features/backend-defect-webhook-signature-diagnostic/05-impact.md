# Impact — backend-defect-webhook-signature-diagnostic

## Changes
- `backend/src/controllers/webhook.controller.js` —
  `verifyWebhookSignature` gains one structured `console.warn` call
  on mismatch with diagnostic fields.
- 1 contract folder.
- **No migration. No schema change.**

## Blast radius
- Only affects the signature-mismatch path. Successful webhook
  deliveries unchanged (still silent + processed normally).
- Logs `secret_first_3` (3 chars of a 15-char secret) in WARN
  level. Low risk — Render logs are access-gated to founder.
- All other endpoints unaffected.

## Rollback
Revert this commit. Logging reverts to single bland
"Invalid signature — rejected" line. No data impact.

## Risks
- **Secret partial exposure in logs**: 3 chars + length. Acceptable
  for diagnostic. Can be removed in a follow-up once the mismatch is
  resolved.
- **Log volume**: each failed webhook now produces 2 log lines
  (1 structured WARN + 1 existing WARN). Razorpay retries ~5x per
  event, so worst case 10 log lines per failed event. Acceptable
  during this debug window.
- **No regression surface**: pnpm qa unaffected; the diagnostic
  only fires on mismatch which the QA suite doesn't exercise.

## Pre-push checklist
1. pnpm qa main lane GREEN.
2. Backend boot smoke clean.
3. gov-check exit 0.
