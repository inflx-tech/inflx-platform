# 02 — Workflow: follower-event-log

## The workflow this contract must execute end to end

**Actor:** Meera, a follower (tested both signed-in and as a guest).

1. Meera opens the app on the Posts tab.
2. Six posts scroll through her viewport.
   → six `impression` rows, each with its feed `position` and
   `surface='posts_tab'`.
3. She opens the third post and watches it for 12 seconds.
   → one `view` row with `dwell_ms ≈ 12000`.
4. She taps **Shop this post**, then taps a saree in the sheet.
   → one `tap_shop`, one `tap_product` carrying `product_id`.
5. She adds it to the bag.
   → one `add_to_bag`; the cart line's claim now carries `post_id`.
6. She checks out (COD or online).
   → `follower_transactions.via_post_id` = that post; each
   `follower_orders.items_json` entry carries its own `post_id`.
7. She backgrounds the app.
   → the queue flushes whatever remains; nothing is lost to the buffer.

## Step-by-step build order

| # | Step | Path |
|---|---|---|
| 1 | Migration 150 — `post_events` + `follower_transactions.via_post_id` | `backend/migrations/150_post_event_log.sql` |
| 2 | Runner script | `backend/scripts/run-150.js` |
| 3 | Ingest service — validate + batch insert | `backend/src/services/postEvents.service.js` |
| 4 | Controller + route `POST /v1/follower/events` | `postEvents.controller.js`, `follower.routes.js` |
| 5 | Thread `post_id` → `via_post_id` + `items_json` | `transaction.controller.js` |
| 6 | Device/session ids | `Packages/Mobile/src/services/deviceId.js` |
| 7 | Event queue (buffer, flush, background hook) | `Packages/Mobile/src/services/events.js` |
| 8 | Wire feed impressions | `PostsFeedScreen.js` |
| 9 | Wire view/dwell/complete | `PostViewerScreen.js` |
| 10 | Wire shop/product/add-to-bag + claim `post_id` | `ShopThisPostSheet.js`, `PostProductScreen.js`, `CartContext.js` |
| 11 | Order payload carries `post_id` | `ReviewOrderScreen.js` |
| 12 | Contract tests | `qa/features/follower-event-log/` |

## Verification (what proves it, not what suggests it)

- **API:** POST a batch of 5 valid events → `{accepted:5}` and 5 rows present.
- **API:** POST an unknown `event_type` → 422, and **zero** rows written.
- **API:** POST 101 events → 422 (cap enforced).
- **API:** POST as a guest (no JWT) → accepted, `follower_id` NULL,
  `device_id` set.
- **API:** POST with an unknown `post_id` → `{accepted:0, skipped:1}`, 200.
- **DB:** create an order from a post-driven cart → that transaction's
  `via_post_id` is the post, and `items_json[0].post_id` matches.
- **DB:** create an ordinary (non-post) order → `via_post_id` IS NULL. Proves
  no accidental default.
- **Mobile:** unit-test the queue — flushes at 20, flushes at 10s, flushes on
  background, and **drops silently on network failure without throwing**.

## Rollback

Drop `post_events`; drop the column. Nothing reads either, so removal is safe
at any point.
