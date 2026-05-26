# Flow 27 — Workflow prediction (tile → backend source mapping)

Per `feedback_backend_first_tiles` — every metric / data point in the mockup must trace to a real backend field.

## Header

| Mockup element | Backend source | Notes |
|---|---|---|
| Title "Contract" | static | literal |
| Sub "<Influencer> · <Campaign>" | `route.params.influencerName` ?? `contract.influencer_name` · `contract.campaign_name` | both fields exist on the contract row JOIN |
| Status pill | `contract.status` → canonical StatusPill | 4 values: draft/pending_influencer/pending_brand/active |

## Terms card

| Mockup element | Backend source |
|---|---|
| Base Fee | `contract.influencer_fee` (rupees, since F.2 fix) |
| Commission | `contract.commission_pct` (only when `goal ∈ {conversion, hybrid}`) |
| Posting Date | `contract.posting_date` |
| Revision Limit | `contract.revision_limit ?? 2` |
| + Brand Bonus | `contract.bonus_amount` OR live `bonusAmount` (editor state) |
| Total Influencer Fee | computed: `baseFee + bonus` |

## Wallet breakdown (editor only)

| Mockup element | Source |
|---|---|
| Base fee | `contract.influencer_fee` |
| + Bonus | local `bonusAmount` |
| Influencer total | computed `base + bonus` |
| + 8% platform fee | computed `total × platformFeePct/100` |
| Wallet escrow at signing | computed `total × (1 + fee%/100)` |
| Wallet balance | `brand.wallet_balance` from `getMe()` |
| Shortage line | computed `lockNeeded − walletBalance` when over |

## Signatures card

| Mockup element | Source |
|---|---|
| Influencer "✓ Signed" + name + date | `contract.influencer_signed_at` + `contract.influencer_signed_name` (fallback `influencer_name`) |
| Brand "✓ Signed" + date | `contract.brand_signed_at` |
| "Not yet signed" | absence of the above |

## Deliverables card

| Mockup element | Source |
|---|---|
| count "(N)" | `deliverables.length` (from `getContract`) |
| per-row type | `d.type` (normalised `replace(/_/g, ' ')`) |
| per-row status | `d.status` |

## Production panel — title

| Mockup element | Source |
|---|---|
| `[VISIT]` / `[SHIP]` icon | `event.mode` |
| "Visit Coordination" / "Product Shipment" | computed from `event.mode` |
| Right status pill | `event.status` → canonical StatusPill (proposed/confirmed/in_progress/completed/cancelled) |

## Production panel — visit slot card

| Mockup element | Source |
|---|---|
| Slot label "Influencer wants to come on" / "Your proposed slot" / "✓ Confirmed visit" | derived from `event.slot_proposed_by` × `event.status` |
| Slot time | `event.visit_scheduled_at` (formatted) |
| Slot meta | `event.visit_window_minutes` + `event.visit_address` |
| Contact line (confirmed state) | `event.visit_contact_name` + `event.visit_contact_phone` |

## Production panel — shipment

| Mockup element | Source |
|---|---|
| "Shipping to" address | `event.shipment_to_{address_line, city, state, pincode}` |
| Courier field | `event.shipment_courier` (form-bound) |
| AWB field | `event.shipment_awb` (form-bound) |
| Completion date | `event.shipment_received_confirmed_at` |

## Production panel — history log

| Mockup element | Source |
|---|---|
| Date | `l.created_at` (formatted day-month) |
| Actor | `l.actor_role` |
| Action | `l.action.replace(/_/g, ' ')` |

## Production panel — reschedule counter

| Mockup element | Source |
|---|---|
| "Reschedules used: N of 2" | `event.reschedule_count_brand` |

## Production panel — flip banner

| Mockup element | Source |
|---|---|
| Show or hide | `event.remote_flip_requested_by` (truthy + not by this side) |
| Confirm flip button | dispatches `flipProductionToRemote(event.id)` |

## Zero phantom fields

All 27 distinct data points in the mockup trace to existing backend fields. No new column needed, no new endpoint needed. Verified against the read of `BrandContractScreen.js` lines 1-1341 and prior Wave-1 behaviour (same data binding as today).
