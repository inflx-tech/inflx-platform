# Expected Outputs — Flow 18 · brand-mobile notifications surface

## Per-step expected outputs

| Step | Observable output | How QA verifies it |
|---|---|---|
| 1 | Ink topbar (#0A0A0A) with "Notifications" title in Outfit 22 white, "Mark all read" yellow pill visible iff unread > 0 | Manual visual verify on emulator/device (Maestro flow when wired — deferred) |
| 2 | Yellow-tinted ActivityIndicator centered on BG #FAFAFA during initial load | Manual visual verify; existing brandApi.getNotifications returns within ~1s on warm backend |
| 3 | List of cards rendered, ordered by created_at DESC (preserved from backend response order) | Manual; cross-check against `GET /v1/notifications` response shape |
| 4 | Each card: 38px avatar tile (color matches type-cluster), Outfit 13.5 name, PJS 12 muted body, mono timestamp like "2h ago", yellow dot if !is_read | Manual visual on all 14 notification types (mockup covers all) |
| 5 | Pull-to-refresh triggers RefreshControl, re-fetches, clears spinner on resolve | Manual gesture verify |
| 6 | Tap on routable card → optimistic mark-read flip + nested-navigator transition to correct screen | Manual nav verify for all 5 routable cases |
| 7 | Mark-all-read pill → "..." spinner state → all unread dots gone | Manual + observe POST `/notifications/mark-all-read` in network log |
| 8 | Empty state: dashed yellow border card, [BELL] icon, "No notifications yet" copy | Manual on fresh test account with zero notifications |

## Data assertions (post-workflow)

- No DB writes from this flow (read-only screen + one mark-all-read POST that is preserved)
- API responses consumed: `{ success: true, data: { notifications: [...] } }` — shape unchanged
- No new attribution IDs, money math, or status machines

## Visual evidence required

- **Before**: existing navy-topbar BrandNotificationsScreen rendered via Maestro screenshot (deferred — see 06-diff/notes.md after impl)
- **After**: Playwright shot of the mockup HTML at 375px viewport stands in (mockup is the design contract; mobile-frame at design/wave2/flow-18-brand-mobile-notifications/web.html)
- **Network**: GET `/v1/notifications` succeeds, POST `/v1/notifications/mark-all-read` succeeds when triggered

## Acceptance criteria summary

A founder-side visual check on a real device after OTA × 3 publish:
1. Topbar is ink + yellow CTA (not navy + white CTA)
2. Cards have type-coloured avatar tiles, not uniform navy icon text
3. Timestamps say "2h ago" not "25/05/2026, 1:32:00 pm"
4. Mark-all-read still flips all dots
5. Tapping a notification still routes to the right place (smoke-test at least one campaign_detail + one negotiation + one wallet card)
