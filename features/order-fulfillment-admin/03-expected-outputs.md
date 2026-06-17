# 03 — Expected Outputs: Admin oversight

- GET /admin/orders returns all online orders (filter/search/paginate) with
  customer/brand/creator/courier/AWB/commission/timestamps.
- PATCH /admin/orders/:id/status overrides any order's status (+courier/tracking),
  stamps the step time, notifies the follower.
- adminMarkRefunded reverses the held commission (pending_balance/total_earned ↓) +
  sets transaction status refunded.
- New /admin/orders page + nav; override/cancel work; track link works.
- backend node --check clean; brand-web build exit 0; pnpm qa 79 GREEN gate 0.
