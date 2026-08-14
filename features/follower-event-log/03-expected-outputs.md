# 03 — Expected outputs: follower-event-log

## Database

```
post_events                       — new, empty on deploy
follower_transactions.via_post_id — new column, NULL on every existing row
```

## API

`POST /v1/follower/events` — `authenticateOptional`

Request:
```json
{
  "device_id": "6f1c…",
  "session_id": "b20e…",
  "events": [
    { "post_id": "…", "event_type": "impression", "surface": "posts_tab", "position": 3 },
    { "post_id": "…", "event_type": "view", "surface": "posts_tab", "dwell_ms": 12000 },
    { "post_id": "…", "event_type": "tap_product", "surface": "posts_tab", "product_id": "…" }
  ]
}
```

Success: `{ "success": true, "data": { "accepted": 3, "skipped": 0 } }`

Failures:
| Case | Code | HTTP |
|---|---|---|
| missing `device_id` | VALIDATION_ERROR | 422 |
| `events` empty or not an array | VALIDATION_ERROR | 422 |
| more than 100 events | VALIDATION_ERROR | 422 |
| unknown `event_type` or `surface` | VALIDATION_ERROR | 422 |
| unknown `post_id` | — | 200, counted in `skipped` |

## Behavioural guarantees

1. A rejected batch writes **nothing** (all-or-nothing on validation).
2. Guests are first-class: no JWT → accepted, `follower_id` NULL.
3. `via_post_id` is NULL unless the purchase genuinely started in a post.
4. The mobile queue never surfaces an error to the follower and never blocks a
   tap. A dropped batch is acceptable; a blocked UI is not.

## Nothing else changes

No screen, copy, price, order total, commission or navigation changes. If any
visible behaviour differs after this contract, that is a defect.
