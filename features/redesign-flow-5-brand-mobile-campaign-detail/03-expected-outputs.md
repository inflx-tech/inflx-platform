# Expected Outputs — Flow 5 · Hub + 3 drill-downs

### Hub (BrandCampaignDetailScreen, restructured)
- Ink header · Back · Campaign name · status badge · dates · meta line (sets/influencers/deliverables counts)
- Yellow-pale summary card with corner accent: big progress % + 3 KPIs (Budget / Active / Reach)
- Urgent action queue (conditional, only shown if items > 0): up to 3 rows for Apps / Reviews / Live confirms
- 6 drill-down tiles in 2×3 grid: Sets · Influencers · Analytics · Escrow · Content · Conversions — each with mono headline value + sub-stat
- Collapsible brief card
- Web dashboard link CTA
- All on a single scroll, fits ~3 phone screens

### BrandCampaignInfluencersListScreen (new)
- Ink header with title + count + breadcrumb
- Search input with yellow focus
- Set filter chip row (horizontal scroll, ink-active, mono counts)
- Status filter chip row
- Cards with name + handle + set + status badge + fee/commission + deliverable progress + tranche row + primary action (Open contract / Open chat / Approve+Reject for applied)
- Empty state when filtered to 0

### BrandCampaignSetsListScreen (new)
- Ink header with title + count
- Set cards with: name + goal badge + window dates + budget + influencer mini-roster (top 3-5 cards) + "View all N" link to InfluencersList filtered to this set
- For open_group sets: funnel meta row (broadcast / applied / approved counts)
- Empty state when no sets

### BrandCampaignReviewQueueScreen (new)
- Ink header with title + count + breadcrumb
- 2-tab switcher: "To Review" (default) / "Confirm Live" — mono counts per tab
- Reviews tab: cards per submitted/under_review deliverable with Approve + Revise actions
- Confirm Live tab: cards per approved+live_url deliverable with Confirm Live action
- Empty state per tab when queue is empty

### QA gate
- `pnpm qa` = 67/67 PASSED · STATE=GREEN · gate 0
- No spec re-baseline

### Governance gates
- Rule 1 (approved contract) ✓
- Rule 2 (release evidence) ✓
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md) ✓
- Rule 5 (Maestro) — fires (Mobile/src/** + released=true). GOVERNANCE_OVERRIDE per precedent.

### Functional preservation
- All 5 parallel API calls preserved
- 6 action handlers preserved (relocated to their dedicated screens)
- All navigation routes preserved (`BrandContract`, `BrandNegotiation`, `BrandInfluencerProfile`, `BrandConversions`)
- `useFocusEffect` + `RefreshControl` preserved
- `openWebDashboard` deeplink preserved
- AsyncStorage / cookie semantics unchanged
