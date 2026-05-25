# Expected Outputs — Flow 22

## StatusPill canonical map extension (NEW)

Adds 7 entries to `Packages/Mobile/src/components/brand/StatusPill.js` `STATUS_MAP_DEFAULT`:

| Status | New token mapping |
|---|---|
| `applied` | yellowPale / yellowText (in-flight, in "new/sent" cluster) |
| `negotiating` | yellowPale / yellowText (in-flight) |
| `contracted` | successPale / successText (positive, in "accepted" cluster) |
| `active` | successPale / successText (positive) |
| `invited` | bg2 / muted2 (neutral-pending; not yet engaged) |
| `rejected_by_brand` | dangerPale / dangerText (alias for `rejected`) |
| `slots_filled` | bg2 / muted2 (terminal-grey) |

Existing 19 entries unchanged. Fallback unchanged.

## Per-screen outputs

### CampaignInfluencersList
- ScreenHeader with back-link variant + crumb + count ("12 of 18")
- Search input with focused state yellow border
- Set filter chip strip with counts (mono digits, all chip active = ink + yellow text)
- Status filter chip strip (12+1 statuses, only those with count>0 visible)
- Per-card:
  - Outfit-Bold 13.5 name + JetBrains-Mono 11 muted handle + bg2 set chip
  - Right column: StatusPill via canonical (now absorbs all 12 statuses) + mono fee + mono commission (green if goal=conversion/hybrid)
  - Yellow deliverable progress bar on bg2 track + mono progress text
  - Tranche row: mono T1/T2/T3 cells, colour-coded by status
  - Action buttons by status: Reject (bg2+danger) + Approve (ink+yellow) for applied; Cancel (white border red) for cancellable; Open chat (yellow+ink) for negotiating; Open contract (successPale+success) for contracted

### CampaignReviewQueue
- ScreenHeader with back-link + crumb
- Tab bar: yellow underline active + yellowPale count chip on active tab
- Hint banner (live tab): yellowPale bg + yellow left border + ink icon-circle
- Per-card: type label + mono handle + italic set name + mono date + URL strip on bg2 with yellow-hover text
- Action buttons: Revise (bg2) + Approve (ink+yellow) on reviews tab; Confirm live (success bg + white text) on live tab
- EmptyState: success-toned variant — same component, different icon ("✓" stays in card body via title text rather than icon text)

## Data assertions
- approveApplication slots_filled response → notify "Slots are now full" alert preserved
- confirmLive partial response (live_count < total_count) → Alert "X of Y live · Z still pending" preserved
- confirmLive t2_released response → Alert with `t2_amount` rupee total preserved

## Visual evidence
`design/wave2/flow-22-brand-mobile-campaign-deep-dives/web.html` — 2 phones (each screen) + StatusPill extension legend
