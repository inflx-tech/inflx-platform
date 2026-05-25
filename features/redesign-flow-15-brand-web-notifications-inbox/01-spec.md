# Flow 15 · brand-web notifications + inbox — spec

**Slug:** `redesign-flow-15-brand-web-notifications-inbox`
**Status:** locked (mockup approved 2026-05-25)
**Wave:** wave2 redesign

---

## Files

| Route | File | LOC OLD |
|---|---|---:|
| `/dashboard/notifications` | `notifications/page.js` | 73 |
| `/dashboard/inbox` | `inbox/page.js` | 269 |

**342 LOC OLD → ~530 LOC NEW**.

---

## Backend audit

### Notifications endpoints (preserved verbatim)
- `notificationApi.list()` → `{ notifications[], unread_count }`. Per row: `id, type, title, body, created_at, is_read`
- `notificationApi.markAllRead()` → mutation

### Inbox endpoints (preserved verbatim)
- `brandInboxApi.applications()` → `{ applications[] }` with `campaign_influencer_id, instagram_handle, tier, campaign_name, set_name, campaign_id, influencer_name, followers_count, engagement_rate, city, niche[], influencer_profile_id`
- `brandInboxApi.negotiations('awaiting_brand')` → `{ negotiations[] }` with `id, influencer_handle, campaign_name, last_proposed_fee, created_at, expires_at, campaign_id`
- `brandInboxApi.deliverables('submitted')` → `{ deliverables[] }` with `id, influencer_handle, type, revision_count, campaign_name, submitted_at, campaign_id`
- `brandInboxApi.summary()` → `{ summary: { contracts_failed, pdf_failed, applications_count?, negotiations_count?, reviews_count?, signatures_count? } }` (NEW use: per-tab counts in sub-tab pills + total-waiting count in header)
- `applicationApi.approve(campaign_id, ci_id)` / `reject(campaign_id, ci_id)` mutations

No phantom fields. No new endpoints. No new query params.

---

## Scope (in-scope)

### Notifications page (`.ntf`)
- Header with count chip showing `{unread} unread · {total} total` (yellow when unread > 0, ink when zero)
- Outfit H1 "Notifications" + yellow rule + sub
- "Mark all read" yellow button when `unread > 0`
- Row cards with palette type avatars (offer/campaign/contract/content/money/danger)
- Unread cards: yellow-50 bg + yellow border + 8px yellow dot
- Read cards: white bg + standard border + no dot
- Relative date (Flow 10 `fmtRelative`)
- Empty state: yellow-pale gradient with 🔔 icon

### Inbox page (`.ibx`)
- Header with mono count chip `{total} items waiting` (sum of all tab counts from summary)
- INK sub-tab pills with mono per-tab counts (derived from `summary` endpoint — accurate even when tab not loaded)
- Per-tab content:
  - **Applications**: rich cards with tier pill + handle + campaign meta + mono stats + niche line + View Profile link + Reject (danger-pale) / Approve (ink+yellow) inline buttons
  - **Negotiations**: click-to-navigate row cards with handle · campaign · last_proposed_fee mono + created_at + expires_at danger tag + chevron
  - **Content reviews**: click-to-navigate row cards with handle · type · revision badge + campaign · submitted_at + chevron
  - **Signatures**: info card with success left-border + count chip + instruction copy
  - **Failures**: 2 info cards (contracts_failed warn + pdf_failed danger) with mono counts + instructions
- Empty states per tab (mono text)
- `Suspense` wrapper preserved (needed for `useSearchParams`)
- URL-driven tabs via `?tab=` query param

### Cross-cutting
- All numbers / fees / dates / IDs in JetBrains Mono
- CSS scoping under `.ntf` (notifications) and `.ibx` (inbox)
- Relative dates everywhere
- `alert()` and `confirm()` preserved (out of scope to replace with modals)

## Out of scope

- Backend changes
- New endpoints (especially: no new "signatures" tab endpoint — info card preserved)
- `alert()`/`confirm()` replacement with proper modals
- Notification per-row click-through (OLD has no per-row action besides marking-all-read)
- Real-time notification updates (OLD polls on mount only)
