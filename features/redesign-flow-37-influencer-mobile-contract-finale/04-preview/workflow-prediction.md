# Flow 37 — Workflow prediction

## ContractScreen tiles → backend source

| Mockup element | Backend source |
|---|---|
| Header title "Contract" | static |
| Header sub | `contract.campaign_name` |
| Status pill | `contract.status` → StatusPill canonical |
| Campaign / Brand / Status / Posting Date | `contract.campaign_name / brand_name / status / posting_date` |
| Total Influencer Fee | `parseFloat(influencer_fee || agreed_fee) + parseFloat(bonus_amount)` |
| Tranche 1/2/3 amounts | `fee * (25/25/50) / 100` (Math.round) |
| Commission Rate | `contract.commission_pct` |
| Offer Type / Value / Coupon | `contract.offer_type / offer_config_json.value / coupon_code` |
| Custom clauses highlight | `JSON.parse(contract.custom_clauses).clauses` (filter `.enabled`) |
| Bonus highlight | `contract.bonus_amount > 0` |
| Deliverables (live) | `data.deliverables[]` |
| Deliverables (formats_json) | `JSON.parse(contract.formats_json)` if no live deliverables |
| Production mode | `contract.production_mode` ∈ {remote, visit, shipment} |
| Production event | `data.production_event.*` |
| Visit address | `pe.visit_address + visit_city + visit_state + visit_pincode` |
| Visit scheduled | `pe.visit_scheduled_at` (formatDateTime) |
| Shipment courier + AWB | `pe.shipment_courier / shipment_awb` |
| Influencer signed | `contract.influencer_signed_name + influencer_signed_at` |
| Brand signed | `contract.brand_signed_by + brand_signed_at` |
| Content Guidelines | `contract.content_requirements || brief || campaign_brief` |
| Revision Policy | `contract.revision_limit` |

## DateTimeChipPicker tiles → source

| Element | Source |
|---|---|
| Date strip range | `dateRange.earliest` to `dateRange.latest` (from `getProductionDateRange`) |
| Date chips | Generated client-side, 30-day cap |
| Hour grid | Hardcoded 8 AM – 7 PM (12 hours) |
| Minute chips | Hardcoded :00 / :15 / :30 / :45 |
| Selected summary | `selDate + selHour + selMinute` (client-side composed Date) |

## Zero phantom

Every tile traces to a real DB field, derived computation, or static config.
