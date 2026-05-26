# Flow 31 — Influencer-mobile My Campaigns + Campaign Detail (spec)

## Problem

`screens/influencer/MyCampaignsScreen.js` (268 LOC, 3-tab list of campaigns the influencer is part of) + `CampaignDetailScreen.js` (1,176 LOC, 2nd biggest screen in the bucket) are still on wave-1 `colors.*` palette + legacy `StatusBadge` + bespoke navy/teal/orange accents. CampaignDetail also has 8 sub-states inside its `renderContractSection` function that need consistent brandPalette banners, and a tranche progression that needs the locked success→yellow→ink visual pattern from Flow 29.

Additionally, the canonical `StatusPill` map (Flow 30 = 39 entries) is missing 4 status keys actively used in this screen pair:
- `published` — `campaign.campaign_status` (campaign brand has published the campaign)
- `revision_requested` — `deliverable.status` (brand asked for content changes)
- `locked` — `tranche.status` (future tranche, not yet earned)
- `released` — `tranche.status` (tranche paid out)

## Goal

1. Restyle both files to brandPalette + fonts.* + canonical `<StatusPill>` + MCI icons throughout.
2. Extend the canonical StatusPill map by 4 entries (39 → 43) covering campaign / deliverable / tranche statuses.
3. Visual upgrade per locked design calls: yellow-active 5-step progress dots, bg2 quick-action tiles with ink/yellow MCI icon tiles, semantic-tone contract banners (yellowPale draft / successPale sign-ready / infoPale waiting / successPale active), yellowPale+yellow-border publish-products CTA, success→yellow→ink 3-stage tranche dots, convPale negotiation info box.
4. Drop legacy `import StatusBadge` from both files (replace all consumers with canonical `<StatusPill>`).

## Scope (in)

- `Packages/Mobile/src/components/brand/StatusPill.js` — append 4 canonical map entries (published / revision_requested / locked / released).
- `Packages/Mobile/src/screens/influencer/MyCampaignsScreen.js` — full restyle. Ink topbar + yellow rule + tab pills (ink-active) + per-card canonical pill + mono stats + footer date range.
- `Packages/Mobile/src/screens/influencer/CampaignDetailScreen.js` — full restyle. Ink topbar with pill + completion banner (successPale) + publish-CTA banner (yellowPale + yellow border) + Quick Actions grid (bg2 tiles + ink/yellow MCI icon tiles) + 5-step progress indicator (yellow dots) + Campaign Info card + Requirements & Deliverables (deliverable rows with canonical pills) + Brand Info + Payment (successPale fee + bonus breakdown + success→yellow→ink tranche dots + yellowPale TDS note) + Contract Status (renderContractSection with 8 semantic-tone sub-banners + signature timeline + ink/yellow Sign + ghost-ink View + ink/yellow PDF) + ConvPale negotiation info box.

## Scope (out)

- **No backend / API / migration / DB change.** Zero touch.
- **All 3 APIs preserved verbatim** (getMyCampaigns / getMyCampaignDetail / getNegotiationByCampaignInfluencer).
- **All 22+ render branches preserved**.
- **5-step progress indicator** (invited → accepted → contracted → active → completed) + `getStepIndex` helper preserved.
- **Goal-aware logic** (`showFee`/`showCommission`/`showTranches`) preserved verbatim — same pattern as Flow 29/30.
- **8-state `renderContractSection`** function preserved with same branching structure.
- **Fee fallback chain**: `contract?.influencer_fee || campaign.agreed_fee || campaign.influencer_budget || campaign.per_influencer_budget || 0` preserved.
- **Bonus math**: totalFee = base + bonus; tranche math = `round(fee × pct / 100)` preserved.
- **products_pending** = `Math.max(0, productsTotal - productsPublished)` preserved.
- **Render-error try/catch wrap** on main render preserved.
- **Console.log debug lines** preserved (founder debug aids).

## Data — preserved verbatim

3 endpoints:
- `getMyCampaigns(status)` → `/influencers/me/campaigns?status=...`
- `getMyCampaignDetail(ciId)` → `/influencers/me/campaigns/:ciId`
- `getNegotiationByCampaignInfluencer(ciId)` → `/negotiations/by-ci/:ciId` (lazy, only when influencer_status='negotiating')

Fields consumed (40+): `campaign.{brand_name, campaign_name, influencer_status, campaign_status, goal, agreed_fee, influencer_budget, per_influencer_budget, commission_pct, brief, posting_date, start_date, end_date, content_start_date, content_end_date, brand_contact_name, coupon_code, campaign_influencer_id}` · `contract.{influencer_fee, bonus_amount, content_requirements, status, influencer_signed_at, brand_signed_at, id}` · `deliverables[].{id, type, quantity, submission_deadline, revision_count, revision_limit, status, brand_feedback, live_url}` · `tranches[].{tranche_number, status, trigger_event, released_at, net_to_influencer}` · `products_total`, `products_published`, `negotiation.{id, current_turn, turns}`.

## Visual decisions (locked 2026-05-26 chat)

1. **5-step Progress dots**: yellow active + bg2 inactive · current step = larger ink-bordered yellow dot.
2. **Quick Actions tiles**: bg2 base + ink-bg/yellow-icon MCI tile + Outfit label + mono badge for counts.
3. **Contract banners** (semantic tones): draft=yellowPale · pending_inf=successPale · pending_brand=infoPale · active=successPale.
4. **Publish-products CTA**: yellowPale + 1.5px yellow border + ink Outfit title + mono sub + ink chevron-right.

## Acceptance

- All 22+ render branches visually upgraded.
- StatusPill canonical map: 39 → 43 entries.
- `pnpm qa` 76+ passed gate 0 STATE=GREEN first-run.
- After ship: 4/23 flows shipped in influencer bucket.
