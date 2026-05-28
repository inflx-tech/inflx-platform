# Flow 37 — Influencer-mobile ContractScreen FINALE · Spec

**Bucket**: mobile-influencer redesign (Wave 2) — **FINAL FLOW**
**Flow position**: 10/23 → bucket COMPLETE
**Owner**: founder
**Locked**: 2026-05-28

## 1 · Problem

The biggest single screen in mobile codebase, `ContractScreen` (1,534 LOC) plus its `DateTimeChipPicker` dependency (185 LOC) still on legacy navy/teal/orange palette + DM Sans/Syne fonts. Highly stateful (~40 render branches) with sophisticated production-coordination state machine mirroring brand Flow 27.

Off-brand vs Flows 28-36: navyDeep header, ad-hoc StatusBadge (not StatusPill canonical), teal/orange/navy tranche dots, navy CTAs, navyPale production panel, teal slot card border, orange flip banner, gold-cream clause highlight box.

## 2 · Goal

Visual restyle to brandPalette + Outfit/Plus Jakarta Sans/JetBrains Mono fonts + StatusPill canonical migration (contract status AND production event status, 11 statuses total — all already in 43-entry map). Preserve every render branch, every API call, every state transition. Zero backend change. Zero StatusPill canonical-map additions. Zero new SDK boundaries.

## 3 · Scope

### In-scope
- `Packages/Mobile/src/screens/influencer/ContractScreen.js` (1,534 LOC) — direct rewrite via token swap + StatusPill migration + Outfit/PJS/Mono font injection
- `Packages/Mobile/src/components/DateTimeChipPicker.js` (185 LOC) — restyle to brandPalette (matches ink-active chip pattern from Flow 33/35/36)

### Out-of-scope
- `backend/**` — zero backend change
- StatusPill canonical map — unchanged (all 11 statuses preserved as-is)
- Native build / android/** — no native rebuild
- All previously shipped influencer screens (Flows 28-36)

## 4 · Data / dependencies

### 4.1 · API calls preserved verbatim (10 endpoints)

| API | Use |
|---|---|
| `getContract(campaignInfluencerId)` | Contract load |
| `signContract(contractId, { typed_name })` POST | Influencer signature |
| `getProduction(contractId)` | Production event + log |
| `getProductionDateRange(contractId)` | Date bounds for chip picker |
| `acceptProduction(eventId)` POST | Accept brand's slot/address |
| `proposeProductionSlot(eventId, payload)` POST | Initial slot proposal |
| `counterProposeProduction(eventId, payload)` POST | Counter slot OR shipment address |
| `flipProductionToRemote(eventId)` POST | 2-party mode flip |
| `confirmProductionReceived(eventId, {})` POST | Shipment received |
| `completeProduction(eventId, {})` POST | Mark visit done |

All exist in `Packages/Mobile/src/services/api.js`.

### 4.2 · DB columns referenced
- `contracts.status` ∈ {draft, pending_influencer, pending_brand, active, completed, cancelled}
- `contracts.goal` ∈ {engagement, conversion, hybrid}
- `contracts.production_mode` ∈ {remote, visit, shipment}
- `contracts.{influencer_fee, bonus_amount, commission_pct, offer_type, offer_config_json, coupon_code, custom_clauses, formats_json, posting_date, content_requirements, revision_limit, pdf_url, influencer_signed_at, brand_signed_at, ...}`
- `production_events.{status, mode, visit_address, visit_scheduled_at, visit_window_minutes, slot_proposed_by, reschedule_count_influencer, remote_flip_requested_by, shipment_*, ...}`
- `deliverables.{id, type, quantity, submission_deadline, status}`

### 4.3 · No new tables / no migrations

## 5 · Risk surface

- **MED-HIGH risk** — biggest single screen, most complex state machine in bucket
- **6 × 3 × 5 × 7 + 4 = ~40 render branches** preserved verbatim
- **Sign Modal MIUI keyboard fix** preserved (Modal outside ScrollView + KeyboardAvoidingView)
- **2-party flip confirmation** state machine preserved (self vs other-side initiator)
- **Goal-aware tranche vs commission card** visibility preserved
- **Bonus + custom clauses highlight** preserved verbatim
- **Deliverables live OR formats_json fallback** preserved
- **DateTimeChipPicker** date strip + hour grid + minute chips preserved
- **reschedule_count_influencer warning** at 2/2 cap preserved
- **Log history strip** (last 5 reverse-chrono) preserved
- **6 Alert.alert 2-confirm flows** preserved (sign, complete, received, flip, etc.)

## 6 · Success criteria

1. Both files render on brandPalette + Outfit/PJS/Mono
2. ALL 40 render branches preserved
3. ALL 10 APIs preserved verbatim
4. StatusPill canonical replaces ad-hoc StatusBadge on contract status AND production event status (11 statuses total, zero map additions)
5. Sign Modal MIUI keyboard fix preserved
6. 2-party flip-to-remote state machine preserved
7. Web `pnpm qa` 76/76 GREEN gate 0 first-run
8. OTA brand v87 / influencer v76 / follower v50 published
9. lock.json `release.released = true`
10. **Bucket COMPLETE (23/23)** after Flow 37 ships
