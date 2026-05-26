# Flow 29 — Workflow prediction (tile → backend source mapping)

Per `feedback_backend_first_tiles` — every metric / data point traces to a real backend field.

## OfferList — header + tab bar

| Mockup element | Backend source |
|---|---|
| "Offers" title | static |
| Sub line (count, optional) | derived from `tabData[activeTab].offers.length` |
| Tab pill labels | static + `tabData[key].offers.length` count |
| Active tab visual | local `activeTab` state |

## OfferList — offer card

| Mockup element | Backend source |
|---|---|
| Brand name | `offer.brand_name` ?? `offer.business_name` ?? `"Brand"` |
| Campaign sub | `offer.campaign_name` |
| Status pill | `offer.status` → canonical StatusPill |
| Fee | `offer.agreed_fee || offer.influencer_budget || offer.per_influencer_budget || offer.set_budget || 0` |
| Deliverable | `offer.deliverable_type || 'reel'` |
| Expires (active tab) | computed `ceil((offer.offer_expires_at - now) / 3600000)` hours, displayed in danger-text |
| Accepted date | `offer.contract_signed_at || offer.created_at` |
| Declined date | `offer.created_at` |
| Expired date | `offer.offer_expires_at || offer.created_at` |
| Decline reason row | `offer.declined_reason` (formatted via `formatDeclineReason` helper) |
| "Tap to view details ›" hint | shown only when `offer.status === 'invited'` |

## OfferDetail — header

| Mockup element | Backend source |
|---|---|
| Back chevron | `navigation.goBack()` |
| Brand logo image | `offer.brand_logo_url` (when present) |
| Brand initial fallback | first char of `offer.brand_name || offer.business_name || 'B'` |
| Brand name | `offer.brand_name || offer.business_name` |
| Category / city meta | `offer.brand_category` + `offer.brand_city` (`·` joined) |
| Campaign sub | `offer.campaign_name` |
| Status pill | `offer.status` → canonical StatusPill |
| Chevron-right | shown only when `offer.brand_id` truthy (tappable → BrandProfile) |
| Countdown timer | `useCountdown(offer.offer_expires_at)` |

## OfferDetail — Campaign Info

| Element | Source |
|---|---|
| Campaign | `offer.campaign_name` |
| Brand | `offer.brand_name ?? offer.business_name` |
| Category | `offer.brand_category` |
| Location | `offer.brand_city` |
| Start Date | `offer.campaign_start_date ?? offer.content_start_date` |
| End Date | `offer.campaign_end_date ?? offer.content_end_date` |
| Type | `offer.goal` (formatted) |
| Brief | `offer.campaign_brief ?? offer.brief` |

## OfferDetail — Offer Details

| Element | Source |
|---|---|
| Fee highlight | computed `fee` fallback chain; rendered only when `showFee` |
| Commission highlight | `offer.commission_pct`; rendered only when `showCommission` |
| Deliverables list | `offer.deliverables[]` (post-sign) OR `offer.formats_json` (pre-sign, normalised via `FORMAT_ALIAS`) OR `offer.deliverable_type` (fallback) |
| Per-deliverable label | `DELIVERABLE_LABELS[d.type] ?? d.type` |
| Per-deliverable status | `d.status` → canonical StatusPill |
| Deadline | `d.submission_deadline` |
| Posting date | `offer.posting_date` |
| Submission deadline | `offer.submission_deadline` |
| Coupon code | `offer.coupon_code` (mono; rendered only when `showCommission` + present) |

## OfferDetail — What You're Promoting

| Element | Source |
|---|---|
| Offer type | `offer.offer_type` |
| Discount breakdown | `offer.offer_config_json.sub_type` + `value` |
| Volume tiers | `offer.offer_config_json.tiers[]` |
| BOGO config | static copy (no extra field) |
| Bundle breakdown | `offer.offer_config_json.products.length` + `bundle_price` |
| Free gift breakdown | `offer.offer_config_json.offers[]` |
| Products | `products[]` from `getCampaignProducts` |
| Physical delivery | `offer.physical_delivery` + `offer.delivery_address` |

## OfferDetail — Payment Terms

| Element | Source |
|---|---|
| Tranche schedule (engagement/hybrid) | computed from `fee` × {25,25,50}% |
| Tranche dots | static design (success/yellow/ink 3-stage progression) |
| Total fee | `fee` |
| TDS note | static copy |
| Hybrid commission note | `offer.commission_pct` |
| Commission-only paragraph (conversion) | `offer.commission_pct` |

## OfferDetail — Action buttons + alerts

| Element | Source / Effect |
|---|---|
| Accept / Apply CTA copy | derived from `isOpenGroup` |
| Accept handler | `Alert.confirm(goal-aware copy)` → `influencerApi.acceptOffer(offer.id)` → goBack |
| Decline button | toggles `showDeclineReasons` |
| Decline reason buttons (5) | `DECLINE_REASONS` constant; each fires `Alert.confirm` → `influencerApi.declineOffer(offer.id, {reason})` → goBack |
| Negotiate button | toggles `showNegotiate`; hidden when open-group OR `offer.allow_negotiation === false` |
| Negotiate fee input | local state `negotiatingFee`; rendered when `showFee` |
| Negotiate commission input | local state `negotiatingCommission`; rendered when `showCommission`; editable iff `offer.allow_commission_negotiation !== false` |
| Negotiate note | local state `note` |
| Submit counter | validates → if `!offer.negotiation?.id && !offer.negotiation_id` → `negotiateOffer` → `navigation.replace('Negotiation', {negotiation_id})`; else `submitNegotiationTurn(negId, {action:'counter', ...})` → same replace |

## OfferDetail — Next Steps card

| Element | Source / Effect |
|---|---|
| Visibility | `offer.status ∈ {accepted, contracted, active}` |
| "Review & Sign Contract" | tap → `navigation.navigate('Contract', {campaignInfluencerId: offer.id})` |
| "Submit Content" | shown when status ∈ {contracted, active} + `deliverables.length > 0`; tap → DeliverableList |

## OfferDetail — Open-group state cards

| State | Source |
|---|---|
| Application submitted | `isOpenGroup && offer.status === 'applied'`; uses `offer.max_cap` for selection count copy |
| Not selected | `isOpenGroup && offer.status === 'rejected_by_brand'` |
| Slots filled | `isOpenGroup && offer.status === 'slots_filled'` |

## Zero phantom fields

All 40+ data points in the mockup trace to existing backend fields or computed derivations from those fields. No new column, no new endpoint, no new business rule.
