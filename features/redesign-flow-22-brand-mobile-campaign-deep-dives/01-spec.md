# Feature Spec — Flow 22 · brand-mobile Campaign deep-dives

> Fifth flow of the mobile-brand bucket. **Second flow to consume the extracted components** (Flow 21's ScreenHeader / StatusPill / EmptyState).

## Problem / goal

Two campaign-drill-down screens that share the same patterns as Flows 18-21:
- **BrandCampaignInfluencersListScreen** (488 LOC) — already uses inline locked-palette `P` const (matches brandPalette exactly), default fonts, custom STATUS_CFG with 12 statuses, deliverable progress bar, tranche T1/T2/T3 dots, multi-state action buttons.
- **BrandCampaignReviewQueueScreen** (330 LOC) — also inline `P`, 2-tab switcher (To review / Confirm live), Alert.prompt for revision feedback, hint banner.

Consolidate to:
1. Import `brandPalette` (drop inline `P`)
2. Consume `<ScreenHeader>` (replaces inline ink topbar markup × 2)
3. Consume `<StatusPill>` (replaces inline STATUS_CFG colour map in CampaignInfluencersList)
4. Consume `<EmptyState>` (replaces inline empty-card markup × 2)
5. Apply Outfit / PJS / JetBrains-Mono fonts throughout

**Extend StatusPill's canonical map** with 7 new statuses needed by these screens:
- `applied`, `negotiating` → yellowPale cluster (in-flight)
- `contracted`, `active` → successPale cluster (positive)
- `invited` → bg2 cluster (neutral-pending)
- `rejected_by_brand` → dangerPale cluster (alias for `rejected`)
- `slots_filled` → bg2 cluster (terminal-grey)

## Scope

**In scope:**
- Visual rewrite of both screen files consuming brandPalette + 3 components + fonts
- Extend `Packages/Mobile/src/components/brand/StatusPill.js` `STATUS_MAP_DEFAULT` with 7 new entries (additive only — no existing entry changed)
- Preserve all behavior: action handlers (approve/reject/cancel/open-chat/open-contract for InfluencersList; revise/approve/confirmLive for ReviewQueue), tranche dot rendering (✓ released / ○ locked / ◐ queued / — none), deliverable progress, 2-tab toggle, hint banner on Confirm-live tab, Alert.prompt for revision feedback

**Explicitly out of scope:**
- `theme/tokens.js` changes (brandPalette covers all)
- Backend / API changes
- Touching shared API client
- Retroactive migration of Flows 18-20 (deferred polish pass)
- Adding bulk operations or new actions

## Surfaces touched

- mobile-brand: 2 screen files + 1 component file (additive map extension)

## Data / contracts

- **APIs**: getCampaign, approveApplication, rejectApplication, cancelInfluencer, reviewDeliverable (approve|request_revision), confirmLive — all unchanged
- **Money**: `agreed_fee` rupees, `commission_pct` percent, `t2_amount` rupees (fmtRupees)
- **Status machine**: campaign_influencer enum (applied→accepted/negotiating→contracted→active→completed; declined/rejected/expired/slots_filled terminal); deliverable status (submitted/under_review→approved/revision_requested; live)

## Non-functional

- Auth/role: unchanged
- Failure modes:
  - InfluencersList: campaign not-found → error state with go-back; filter combinations yielding 0 results → EmptyState
  - ReviewQueue: 0 queue items → success-toned EmptyState ("You're all caught up")
  - Action handlers: optimistic loading state per-row via `actionLoading`, error → Alert
