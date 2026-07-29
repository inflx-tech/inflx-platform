# 03 — Expected outputs

## Reject from `/admin/approvals`

Request

```
PATCH /v1/admin/brands/:id/status
{ "status": "rejected", "reason": "Business documents unclear" }
```

Before: `422 { success:false, error:{ code:'VALIDATION_ERROR',
message:'reason is required when rejecting', field:'reason' } }`

After: `200 { success:true, data:{ brand:{…, user_status:'rejected',
rejection_reason:'Business documents unclear', approved_at:null,
approved_by:null }, notification_sent:true } }`

## Reinstate from `/admin/brands`

```
PATCH /v1/admin/brands/:id/status
{ "status": "approved" }
```

`200` — `user_status:'approved'`, `rejection_reason:null`,
`approved_at` freshly stamped, `approved_by` = acting admin.

## Suspend (D4 regression guard)

```
PATCH /v1/admin/brands/:id/status
{ "status": "suspended", "reason": "Payment dispute" }
```

`200` — `user_status:'suspended'`, `rejection_reason:'Payment
dispute'`, and **`approved_at` / `approved_by` unchanged from before
the suspend**. This is the assertion that would have caught D4.

## UI

| Row status | `/admin/brands` buttons after |
|---|---|
| pending | Fee only (decisions moved to Approvals) |
| approved | Suspend · Fee |
| suspended | **Reinstate** · Fee |
| rejected | **Reinstate** · Fee |

`/admin/approvals` is unchanged visually — only the request body key
differs.

## Regression bar

`pnpm qa` green. No migration.
