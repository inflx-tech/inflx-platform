# Expected Outputs — Flow 6

### Hub (`/dashboard/campaigns/[id]/page.js`)
- Breadcrumb + Outfit 700 H1 + yellow rule + mono meta line + status badge + header actions
- Yellow-pale summary card with 48px progress % + ink progress bar + 4-KPI grid (Budget%/Active/Reach/Avg ER)
- 6 drill-down tiles in 3-col grid (Sets/Influencers/Content/Escrow/Conversions/Publishing) — each with mono headline value
- Inline Analytics card (4-tile mono grid likes/comments/views/ER)
- Collapsible brief
- Sticky right rail: Needs Attention queue + Web-only tools note

### `/influencers/page.js` (NEW)
- Header: breadcrumb + H1 + count + Export CSV + Invite more
- Filter bar (white card): search with yellow focus + Set chips + Status chips with mono counts
- 2-column card grid: per-card name + handle + set chip + status badge + fee/comm + del progress + tranche row + status-aware action buttons
- ContractModal / NegotiationModal / ProductionPanel triggers per card (preserved from old page.js)

### `/sets/page.js` (NEW)
- Header: breadcrumb + H1 + count
- Per-set card with goal badge + window + budget + mini-roster (top 5) + funnel for open_group
- "View all influencers in this set" CTA per card

### `/reviews/page.js` (NEW)
- Header: breadcrumb + H1
- 2-tab switcher (To Review / Confirm Live) with mono per-tab counts
- Per-deliverable card with MediaPreview + DeliverableStatsCard + action buttons (Approve/Revise/Confirm Live)

### QA gate
- `pnpm qa` = 67/67 PASSED · STATE=GREEN · gate 0
- No spec re-baseline (no spec asserts on campaign detail layout/copy)

### Governance gates
- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) ✓
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md) ✓
- Rule 5 (Maestro) does NOT fire (web only)

### Functional preservation
- All 5 parallel API calls preserved (relocated to relevant sub-routes)
- All 6 action handlers preserved
- ContractModal/NegotiationModal/ProductionPanel flows preserved
- MediaPreview signed-URL fetch preserved
- DeliverableStatsCard refresh preserved
- All navigation routes preserved
- Toast notifications preserved
- Auth + role gating (from layout.js) inherited unchanged
