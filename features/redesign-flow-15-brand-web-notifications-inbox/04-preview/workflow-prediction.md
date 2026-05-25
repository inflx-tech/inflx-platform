# Flow 15 · preview workflow-prediction

## Notifications field mapping

| Element | Backend source |
|---|---|
| Count chip unread | `notificationApi.list().data.unread_count` |
| Count chip total | `notifications.length` |
| Mark-all-read button visibility | `unread > 0` |
| Row avatar type | derived from `n.type` (offer/campaign/contract/content/money/danger) |
| Row title | `n.title` |
| Row body | `n.body` |
| Row date | `n.created_at` via Flow 10 fmtRelative |
| Row unread style | `!n.is_read` |

## Inbox field mapping

| Element | Backend source |
|---|---|
| Header count chip | sum of `summary.{applications/negotiations/reviews/signatures/failures}_count` |
| Sub-tab counts | per-tab field from `brandInboxApi.summary()` |
| Applications row | `applications[]` from `brandInboxApi.applications()`; fields per spec |
| Applications mutations | `applicationApi.approve(campaign_id, ci_id)` / `reject(...)` |
| Negotiations row | `negotiations[]` from `brandInboxApi.negotiations('awaiting_brand')` |
| Negotiations fee | `n.last_proposed_fee` via `fmtRupees` |
| Negotiations expires | `n.expires_at` via `fmtDate` |
| Reviews row | `deliverables[]` from `brandInboxApi.deliverables('submitted')` |
| Reviews revision badge | `d.revision_count > 0` |
| Failures counts | `summary.contracts_failed`, `summary.pdf_failed` |
| Signatures count | `summary.signatures_count` (when available) — falls back to no count display |
