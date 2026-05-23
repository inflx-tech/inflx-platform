# Expected Outputs — Redesign Flow 4 · Brand mobile

## Post-implementation, every assertion below must be true.

### BrandHomeScreen
- Ink black app header with Logo placeholder (light tone) + brand name on right
- Status banner renders only when `brand.user_status` is `'pending' | 'rejected' | 'suspended'`. Yellow-pale for pending; danger-pale for rejected/suspended.
- Wallet card: yellow-pale gradient bg + corner-accent yellow circle + ink mono balance + 2 stat columns + ink Top-up button with yellow text
- Action Required card renders when `sum(inbox.pending_*) > 0` — yellow left-stripe + yellow-pale icon-circle + mono count pill
- Wallet alert renders when `pendingWallet.length > 0` — yellow-pale tint with ink content
- "Open web dashboard" muted CTA card
- 6 Quick Action tiles (was 7), 2-column grid, yellow icon-in-circle pattern
- Campaigns top-5 cards (compact)

### BrandCampaignListScreen
- Ink black header with title + mono count meta line
- Search input with yellow focus halo on focus
- Filter chips (5): All / Active / Draft / Needs Funding / Completed — horizontal scroll row · ink-active with mono per-chip counts
- Sort chips (4): Newest / Oldest / Budget ↓ / Name A→Z — secondary chip style
- Bulk action bar (when selection > 0): ink chrome with yellow Cancel + danger Delete + ghost Clear
- Cards: name (Outfit 700) · status badge · `start_date` (when present) · `total_budget` (when > 0) · checkbox · tap-to-detail
- **No** influencer count row (dead phantom UI dropped)

### QA gate
- `pnpm qa` = 67/67 PASSED · STATE=GREEN · gate 0 · pwExit=0 reportExit=0
- No spec asserts on either screen → zero re-baseline

### Governance gates (gov-check)
- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) ✓
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md non-empty) ✓
- Rule 5 (Maestro green) — fires (Mobile/src/** touched + release.released=true). No auth-style Maestro flow covers brand home/list specifically; substituted via GOVERNANCE_OVERRIDE per Flow 1 precedent.

### Functional preservation
- All API calls preserved verbatim
- All navigation destinations preserved
- AsyncStorage / cookie semantics preserved
- Bulk handlers + Alert prompts preserved
- Pull-to-refresh preserved
- openWebDashboard deeplinks preserved
