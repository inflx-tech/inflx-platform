# Expected Outputs — Redesign Flow 3 · Campaign list

## Post-implementation, every assertion below must be true.

### Page chrome (inherited from Flow 2)
- Topbar renders with "Campaigns" nav item highlighted yellow
- Persistent pending/rejected banners render when applicable

### Page header
- Breadcrumb `/dashboard / campaigns` mono uppercase
- H1 "Campaigns" Outfit 700 with yellow rule underneath
- Meta line shows total · live · draft counts in mono digits
- Yellow "+ New campaign" CTA links to `/dashboard/campaigns/new`

### Summary tiles (5)
- All values derived from the loaded `campaigns` array client-side
- Total tile = `campaigns.length`
- Draft tile = `campaigns.filter(s='draft').length` muted text
- Active tile = `campaigns.filter(s∈['active','live']).length` success-deep text
- Completed tile = `campaigns.filter(s='completed').length` ink-2 text
- Total budget tile = `fmtRupees(sum(total_budget))` ink text

### Filter / sort bar
- Search input with yellow focus halo (`box-shadow: 0 0 0 3px rgba(255,193,7,0.18)`)
- Magnifier icon left inset
- 8 status chips (All + 7 statuses); active chip = ink-black with white text; inactive = muted pill
- Per-chip mono count badge inside each chip
- Sort dropdown right-aligned, custom chevron

### Bulk action bar (shown only when `selectedIds.size > 0`)
- Black ink bg
- Left: "N campaign(s) selected" + ghost "Clear" link
- Right: "Export CSV" (ghost white) + "Cancel (N)" yellow + "Delete (N)" danger
- Cancel button visible only when ≥1 cancellable (draft/published) selected
- Delete button visible only when ≥1 deletable (draft) selected

### Select-all row
- Checkbox + "Select all N" / "Deselect all" toggle
- Body font, muted text

### Campaign grid
- 3-column on ≥1080px; 2-column on 680-1080px; 1-column on <680px
- Each card has: checkbox · title (Outfit 700) · dates (mono) · status badge · total budget amount (mono, right-aligned) · view-CTA
- Selected card: ink border + soft ring
- Hover: lift 1px + soft shadow + border darkens
- Draft card CTA reads "Continue draft" in yellow-hover; non-draft reads "View details" in muted
- **NO** progress bar
- **NO** influencer-count footer
- Status badge per status (locked palette mappings):
  - `draft` → muted pill
  - `pending_wallet` → yellow-pale
  - `published` → yellow-pale
  - `active` / `live` → success-pale
  - `completed` → bg-2 / ink-2
  - `cancelled` → danger-pale

### Confirm modals (unchanged behaviour, restyled)
- Same trigger conditions
- Same `campaignApi.cancel` / `campaignApi.delete` per-id bulk loop
- Same partial-success alert pattern

### Empty states
- Zero campaigns → muted icon circle + "No campaigns yet" + create CTA
- Filter no-match → muted "No campaigns match your filters" line + clear-filters hint

### QA gate
- `pnpm qa` = **67/67 PASSED · STATE=GREEN · gate 0**
- No spec asserts on campaign list copy → no re-baseline needed

### Governance gates (gov-check)
- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) ✓
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md non-empty) ✓
- Rule 5 (Maestro) does NOT fire (web only)

### Functional preservation
- `campaignApi.list()`, `.cancel(id)`, `.delete(id)` calls unchanged
- ConfirmModal logic unchanged
- CSV export unchanged
- Selection state machine unchanged
- Sort + filter logic unchanged
- All `href` targets unchanged
- Draft-card click → `/dashboard/campaigns/new?id=${id}` (current behaviour)
- Non-draft-card click → `/dashboard/campaigns/${id}`
