# 03 — Expected outputs

## `GET /brands/me/orders`

Before: HTTP 500, `error.code = INTERNAL_ERROR`.

After: HTTP 200.

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "…",
        "order_status": "confirmed",
        "follower_name": "…",
        "follower_phone": "…",
        "address_label": "Home",
        "delivery_address": "12-3 Main Rd, Flat 4, Hyderabad, 500072",
        "net_amount": "…",
        "return_window_ends_at": "…"
      }
    ],
    "page": 1
  }
}
```

`delivery_address` contains no state segment. When `line2` /
`pincode` are NULL, `CONCAT_WS` omits them without leaving stray
separators.

## `GET /admin/orders`, `GET /follower/activity`

Same change to the `delivery_address` string; all other keys
unchanged.

## Regression bar

`pnpm qa` green. No migration, so `pnpm qa:db` is unaffected.
