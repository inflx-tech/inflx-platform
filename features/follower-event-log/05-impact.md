# 05 — Impact: follower-event-log

**Verdict: zero functional disturbance — additive recording only.**

## Why

- **Schema:** one new table nothing reads yet; one new nullable column with
  `ON DELETE SET NULL`. No column is altered, dropped or re-typed. Every
  existing row is untouched and every existing query returns exactly what it
  returned before.
- **API:** one new route. No existing endpoint's request, response or status
  code changes.
- **Order path:** the only edit inside the money path is *writing two extra
  nullable fields* (`via_post_id`, and `post_id` inside `items_json` entries).
  Pricing, discounting, commission, escrow, platform fee and settlement are not
  touched. A cart with no post origin behaves byte-identically.
- **Mobile:** the queue is fire-and-forget and off the render path. A network
  failure drops a batch and is never shown to the follower.

## The one real risk

**Silent no-op.** Recording that fails quietly looks exactly like recording
that works. Mitigated by verifying **rows in the database**, not that a
function was called — see 02-workflow "Verification".

## Deploy class

**Production-impacting.** Migration 150 (prod runner) + Render backend +
follower OTA. Explicit founder go required before push.
