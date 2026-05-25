# Flow 18 — before/after diff notes

> Step-8 artifact (UI-governed Rule 4). Plain-English summary of what
> changed visually + structurally between the OLD `BrandNotificationsScreen.js`
> (pre-2026-05-25, navy-based legacy palette) and the NEW version
> (this commit, brandPalette).

## Files touched

- **Modified**: `Packages/Mobile/src/screens/brand/BrandNotificationsScreen.js` — full visual rewrite, behavior preserved 1:1
- **Modified (additive)**: `Packages/Mobile/src/theme/tokens.js` — new `brandPalette` export appended; nothing existing renamed or removed
- **New**: `features/redesign-flow-18-brand-mobile-notifications/{01-spec,02-workflow,03-expected-outputs,05-impact,lock.json,04-preview/workflow-prediction.md,04-preview/mockups/web.html,06-diff/notes.md}`
- **New**: `design/wave2/flow-18-brand-mobile-notifications/web.html`

## Visual delta

| Element | Before (navy legacy) | After (brand-mobile parity) |
|---|---|---|
| Topbar bg | `colors.navyDeep` `#111E42` | `brandPalette.ink` `#0A0A0A` |
| Topbar title | System font 22 bold white | Outfit-Bold 22, white, -0.3 letter-spacing, with 36×3 yellow rule beneath |
| Unread count | "Mark all read" pill only, no count chip | Yellow chip "N UNREAD" (mono) under title rule; flips to translucent-white "0 UNREAD" when none |
| Mark-all-read pill | `rgba(255,255,255,0.15)` bg, white text "Mark all read" | `brandPalette.yellow` bg, `brandPalette.ink` text "✓ Mark all read" (PJS Bold) |
| List bg | `colors.bg` `#F4F6FB` (navy-tinted) | `brandPalette.bg` `#FAFAFA` (warm neutral) |
| Card bg (read) | `colors.white` + zinc-ish border | `brandPalette.white` + `brandPalette.border` `#E4E4E7` |
| Card bg (unread) | `colors.navy + '06'` (faint navy tint) + `navy + '40'` border | `brandPalette.yellow50` `#FFFDEB` + `brandPalette.yellowPale` border |
| Card icon | `colors.navy` `#1B2D5E` text, single colour for ALL types | 38×38 type-coloured tile (6 colour clusters by type: yellow_pale / success_pale / danger_pale / conv_pale / eng_pale / info_pale / fallback bg2) |
| Card title | System font 13 bold `colors.t1` | Outfit-Bold 13.5 `brandPalette.ink` |
| Card body | System font 12 `colors.t2` line-height 18 | PJS Medium 12 `brandPalette.muted` line-height 17 |
| Card timestamp | `n.created_at`.toLocaleString → `"25/05/2026, 1:32:00 pm"` (absolute) | `fmtRelative(n.created_at)` → `"2h ago"` / `"Yesterday"` / `"5d ago"` / falls back to absolute past 7 days |
| Tap-to-open hint | `colors.orange` `#F47920` text "Tap to open  ›" | `brandPalette.yellowText` PJS Bold "Tap to open" + yellow JetBrains-Mono chevron `›` |
| Unread dot | 8×8 `colors.navy`, beside avatar | 8×8 `brandPalette.yellow`, absolute-positioned top-right of card |
| Empty state | White card + zinc border + `colors.t3` `[BELL]` icon | Dashed `yellowPale` border card + 56×56 yellow-pale tile + Outfit 14 title + PJS muted sub-copy |
| Loading state | Blank screen + centred navy ActivityIndicator | Topbar-preserved + yellow ActivityIndicator (large) + "Loading…" mono caption |

## Behavior delta

**Zero behavioral change.** Every API call, navigation path, optimistic update, and edge case is preserved verbatim:

| Behavior | Status |
|---|---|
| `brandApi.getNotifications` on mount | Preserved |
| `brandApi.markAllNotificationsRead` on pill tap | Preserved |
| `routeNotification(navigation, data)` — 5 cases (campaign_detail / offer_inbox / contract_review / contract_detail / negotiation / wallet / brand_dashboard) | Preserved verbatim (same source code copied unchanged) |
| Optimistic mark-read on tap (no per-notification API call) | Preserved |
| `markAllRead` optimistic flip (all rows → `is_read: true` after POST) | Preserved |
| `RefreshControl` pull-to-refresh re-fires `load()` | Preserved |
| `disabled={!hasLink}` on non-routable cards | Preserved |
| Empty state shown when `notifications.length === 0` | Preserved |
| All 14 `TYPE_ICONS` entries | Preserved verbatim |

## New code primitives introduced

- `TYPE_AVATAR` const — maps each of the 14 backend types to `{ bg, fg }` tile colour pair (uses brandPalette)
- `FALLBACK_AVATAR` const — `{ bg: bg2, fg: muted2 }` for unknown types
- `fmtRelative(iso)` inline helper — lifted verbatim from brand-web Flows 10/11/12/13/15. Same edge cases: returns `'—'` if no iso; `'5s ago'` < 60s; `'12m ago'` < 1h; `'3h ago'` < 1d; `'5d ago'` < 7d; absolute `25 May 2026` past 7d
- Topbar count chip with two visual states (`unreadCount > 0` → yellow chip; `=== 0` → translucent-white chip)

## Reuse / pattern surfaced

Components/patterns to extract once Flow 19-20 ship (per handoff §12 guidance — don't extract a constants/components file until 2-3 mobile screens are done):
- The 38×38 type-tile with `TYPE_AVATAR` lookup → likely reusable as `<TypeAvatar type="..." />`
- The ink topbar with title + rule + count chip + right-side pill → reusable as `<ScreenHeader />`
- `fmtRelative` → into `theme/tokens.js` (or a new `theme/dates.js`) once a 2nd screen consumes it
- Empty-state pattern (dashed yellow card + yellow-pale tile + title + sub) → reusable as `<EmptyState />`

These extractions are **deferred to Flows 19-20**. Flow 18 keeps everything inline to validate the visual first.

## Wave-3 follower regression check (verify-twice)

The `brandPalette` export is **additive only** — `colors`, `lightColors`, `darkColors`, `businessAccents`, `fonts`, `fmtRupees`, `fmtMoney`, `fmtNum` are byte-identical pre/post. Grep confirmed 24 follower/restaurant screens consume `lightColors`; **none** consume `brandPalette`. Zero regression risk on the 24 shipped Wave-3 surfaces.

## What is NOT in this flow

- Per-notification mark-read (backend has no endpoint; preserved as local optimistic flip)
- Filter chips / tabs / search (not in current screen scope)
- Read/unread toggle-back (current scope: tap-marks-read OR mark-all only)
- Dark mode (mobile-brand uses light only)
- Maestro flow (deferred to its own contract; this release ships with `GOVERNANCE_OVERRIDE`)
