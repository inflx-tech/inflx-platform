# Expected Outputs — wave1-admin-categories-return-window

## Database
No new migrations. Uses M073's existing `return_window_days`
column.

## API JSON shapes

`GET /admin/categories` response gains a `return_window_days` field
on every row:
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "category_key": "restaurant",
        "name": "restaurant",
        "label": "Restaurant",
        "path_a_pct": "12.00",
        "path_b_pct": "8.00",
        "path_c_pct": "5.00",
        "active": true,
        "sort_order": 2,
        "description": null,
        "return_window_days": 30,
        ...
      }
    ]
  }
}
```

`PATCH /admin/categories/:categoryKey` body accepts optional
`return_window_days` (int 0–365).

## UI signal post-deploy

- Categories page renders an additional "Return win (d)" column.
- Existing rows show `30d` (the default from M073).
- Edit mode reveals a 0–365 number input.

## Test results
- pnpm qa main lane 76/76 GREEN (47.3s).
- Backend boot smoke clean.

## Deploy posture
PRODUCTION-IMPACTING (Vercel redeploys brand-web with new field;
Render redeploys backend with the additional SELECT column).
NO migration (M073 already on prod).
