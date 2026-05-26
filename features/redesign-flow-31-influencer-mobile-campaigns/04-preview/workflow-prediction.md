# Flow 31 — Workflow prediction (tile → backend source mapping)

Per `feedback_backend_first_tiles` — every metric traces to a real backend field.

## MyCampaignsScreen

| Element | Source |
|---|---|
| Brand name | `campaigns[].brand_name` |
| Campaign name | `campaigns[].campaign_name` |
| Status pill | `campaigns[].influencer_status` → canonical StatusPill |
| Fee | `campaigns[].agreed_fee` |
| Goal | `campaigns[].goal` (formatted Title Case) |
| Deliverables count | `campaigns[].approved_count`/`deliverable_count` |
| Date range | `campaigns[].start_date` to `campaigns[].end_date` |

## CampaignDetailScreen — Header
| Element | Source |
|---|---|
| Back chevron | static MCI |
| Brand name | `campaign.brand_name` |
| Campaign name | `campaign.campaign_name` |
| Status pill | `campaign.influencer_status` → canonical StatusPill |

## Completion banner
- Show/hide: `campaign.influencer_status === 'completed'`
- Title + sub: static
- Tap target: `CampaignCompletion` screen

## Publish-products CTA banner
- Show: `showCommission && contract?.status === 'active' && productsPending > 0`
- Title: dynamic based on `productsPublished === 0` vs `productsPending` count
- Source: `data.products_total`, `data.products_published`

## Quick Actions tiles (6 conditional)

| Tile | Show when | MCI icon | Source for badge |
|---|---|---|---|
| Contract | `contract` present | `file-document-outline` | — |
| Negotiation | `influencer_status === 'negotiating'` | `handshake-outline` | — |
| Publish to Store | `showCommission` | `storefront-outline` | `products_published`/`products_total` |
| Earnings | always | `currency-inr` | — |
| Coupon | `campaign.coupon_code` present | `tag-outline` | `campaign.coupon_code` (mono) |
| Commission | `showCommission && campaign.commission_pct` | `percent-outline` | `campaign.commission_pct` (e.g. "12%") |

## 5-step Progress Indicator

- Steps from constant: `[invited, accepted, contracted, active, completed]`
- Current step index: `getStepIndex(campaign.influencer_status)`
- Active dots/lines (i ≤ currentStep): yellow
- Inactive (i > currentStep): bg2/border

## Campaign Info card
| Row | Source |
|---|---|
| Campaign name | `campaign.campaign_name` |
| Campaign Status pill | `campaign.campaign_status` → canonical StatusPill (NEW `published` entry) |
| Start Date | `campaign.start_date \|\| campaign.content_start_date` |
| End Date | `campaign.end_date \|\| campaign.content_end_date` |
| Type | `campaign.goal` (formatted Title Case) |

## Requirements & Deliverables
| Element | Source |
|---|---|
| Campaign brief | `campaign.brief` |
| Posting date | `campaign.posting_date` |
| Content requirements | `contract.content_requirements` |
| Deliverable row badge | `DELIVERABLE_ICONS[d.type]` (mono [R]/[P]/[S]/[YV]/[YS]) |
| Deliverable type label | `DELIVERABLE_LABELS[d.type]` |
| Quantity | `d.quantity` |
| Deadline | `d.submission_deadline` |
| Revisions | `d.revision_count`/`d.revision_limit` |
| Status pill | `d.status` → canonical StatusPill (NEW `revision_requested` entry) |
| Brand feedback | `d.brand_feedback` |
| Upload Content CTA visible | `influencerStatus ∈ {active, contracted} && deliverables.some(d ∈ {pending, revision_requested})` |
| Submit Live URL CTA visible | `deliverables.some(d.status === 'approved' && !d.live_url)` |

## Payment card
| Element | Source |
|---|---|
| Total Fee | `parseFloat(contract?.influencer_fee \|\| campaign.agreed_fee \|\| ...) + parseFloat(contract?.bonus_amount \|\| 0)` |
| Base + bonus breakdown | shown when `contract.bonus_amount > 0` |
| Commission % | `campaign.commission_pct` |
| Tranche rows | `data.tranches[]` |
| Tranche dot color | `t.status === 'released'` → success · `t.status === 'locked'` → ink · else → yellow |
| Tranche pill | `t.status` → canonical StatusPill (NEW `released`/`locked` entries) |
| Tranche amount | `t.net_to_influencer` (rupees) |
| Released date | `t.released_at` |
| Expected schedule (when tranches=[]) | computed `Math.round(fee × pct / 100)` for 25/25/50 |
| TDS note | shown when `showTranches` |

## Contract Status card (renderContractSection 8 sub-states)

| Sub-state | Condition | Banner tone | CTA |
|---|---|---|---|
| `invited` | influencer_status='invited' | bg2 (terminal text) | none |
| `negotiating` | influencer_status='negotiating' | convPale negotiation info box | ink/yellow View Negotiation |
| `accepted+null contract` | post-accept, no contract row | infoPale "preparing..." | none |
| `accepted+draft` | contract.status='draft' | yellowPale banner | View Contract Details |
| `accepted+pending_influencer` | contract.status='pending_influencer' | successPale banner | ink/yellow Sign Contract |
| `accepted+pending_brand` | contract.status='pending_brand' | infoPale banner | View Contract Details |
| `accepted+active` | contract.status='active' | successPale banner | View PDF + View Details |
| `declined/expired` | terminal | bg2 (terminal text) | none |

Each post-accept variant shows signature timeline (Your Signature + Brand Signature dates).

## Zero phantom fields

All ~50 distinct data points trace to existing backend fields. No new column, no new endpoint.

## StatusPill canonical map — +4 entries

| Key | Tones | Label | First use |
|---|---|---|---|
| `published` | infoPale / info | 'PUBLISHED' | Campaign Info card (campaign_status) |
| `revision_requested` | yellowPale / yellowText | 'REVISION' | Deliverable table |
| `locked` | bg2 / muted2 | 'LOCKED' | Tranche row |
| `released` | successPale / successText | 'RELEASED' | Tranche row |

Map total: 39 → 43.
