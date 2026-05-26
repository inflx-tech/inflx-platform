# Flow 30 — Workflow prediction (tile → backend source mapping)

Per `feedback_backend_first_tiles` — every metric and data point traces to a real backend field.

## NegotiationScreen

### Header

| Element | Source |
|---|---|
| Back chevron | static MCI |
| "Negotiation" title | static |
| StatusPill | `negotiation.status` → canonical StatusPill with `mode='influencer'` |
| Brand name | `negotiation.brand_name` |
| Campaign name | `negotiation.campaign_name` |

### Offer Progress card

| Element | Source |
|---|---|
| "Original" fee | `negotiation.original_fee` + `negotiation.original_commission_pct` via `renderProposalLine` |
| Chevron arrow | static MCI |
| "Latest" fee | `negotiation.current_fee` + `negotiation.current_commission_pct` via `renderProposalLine` |
| Turn-info banner copy | derived from `negotiation.current_turn` + `negotiation.status` via `statusLabel` helper |

### Conversation card

| Element | Source |
|---|---|
| "(N messages)" count | `turns.length` |
| Per-bubble L/R alignment | `turn.sent_by === 'influencer'` → right; else left |
| Bubble actor label | "You" if influencer, "Brand" if brand |
| Bubble date | `turn.created_at` via `formatDate` |
| "Counter Offer" badge | static label (all turns are counters in current model) |
| Bubble fee line | `turn.proposed_fee` + `turn.proposed_commission_pct` via `renderProposalLine` |
| Bubble note | `turn.note` |

### Waiting banner (status='awaiting_brand')

| Element | Source |
|---|---|
| Hourglass icon | static MCI |
| Title + copy | static |
| Show/hide | `isOpen && !isInfluencerTurn` |

### Counter Offer form (status='awaiting_influencer')

| Element | Source |
|---|---|
| Accept button label | `renderProposalLine(negotiation.current_fee, negotiation.current_commission_pct)` |
| Fee input visibility | `showFee = (goal === 'engagement') \|\| (goal === 'hybrid')` |
| Commission input visibility | `showCommission = (goal === 'conversion') \|\| (goal === 'hybrid')` |
| Send Counter disabled-state | `actionLoading \|\| (showFee && !proposedFee) \|\| (showCommission && !showFee && !proposedCommission)` |
| Walk Away button | always shown in form |

### Closed card

| Element | Source |
|---|---|
| Title | "Negotiation Agreed" if status='agreed' else "Negotiation Closed" |
| Body | conditional copy with `renderProposalLine(current_fee, current_commission_pct)` for agreed |
| Background | successPale (agreed) OR bg2 (walked_away) |

## BrandProfileScreen

### Header

| Element | Source |
|---|---|
| Back chevron | static MCI |
| Brand logo | `brand.logo_url` (Image) OR fallback ink-Outfit-Black initial on yellow tile |
| Initial fallback | `(brand.business_name \|\| 'B').charAt(0).toUpperCase()` |
| Brand name | `brand.business_name` |
| Category badge | `brand.category` (conditional) |

### Brand Details card

| Row | Source |
|---|---|
| Business Name | `brand.business_name` |
| Category | `brand.category` (conditional) |
| Location | `brand.address_line` (conditional) |
| On INFLX Since | `brand.created_at` formatted as "Month YYYY" (conditional) |

### Campaigns stat box

| Element | Source |
|---|---|
| Number | `brand.active_campaigns_count \|\| 0` |
| Label | static |

## Zero phantom fields

All 16 distinct data points trace to existing backend fields. No new column, no new endpoint, no new business rule.

## StatusPill `mode='influencer'` extension

| `status` value | Default label (brand POV) | `mode='influencer'` label |
|---|---|---|
| `awaiting_brand` | YOUR TURN | **WAITING** |
| `awaiting_influencer` | WAITING | **YOUR TURN** |
| `agreed` | AGREED | AGREED (unchanged) |
| `walked_away` | CLOSED | CLOSED (unchanged) |
| `open` | OPEN | OPEN (unchanged) |
| (all other statuses) | per default | unchanged |

Component change: ~3 lines after the existing `mode === 'transaction'` override. No new canonical-map entries.
