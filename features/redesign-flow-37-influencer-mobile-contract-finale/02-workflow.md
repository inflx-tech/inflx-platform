# Flow 37 — Workflow

## ContractScreen — top-level state machine

### Entry
Tapped from CampaignDetail / MyCampaigns / deep-link with `route.params.campaignInfluencerId`.

### Loading
`load()` → `getContract(campaignInfluencerId)` → sets `contract`, `deliverables`, `productionEvent`, parses `formats_json` (JSON or string).

### Render by contract.status

#### `draft` (brand still preparing)
- yellowPale draft banner ("Brand is preparing your contract")
- All cards visible BUT no Sign CTA, no PDF button
- Production Arrangement hidden

#### `pending_influencer` (waiting on me)
- yellowPale draft sub-banner removed
- View PDF button (if `pdf_url` present)
- Sign Contract card with ink/yellow CTA → opens Sign Modal
- Sign Modal: bottom-sheet, KeyboardAvoidingView, typed_name input, Cancel + Sign Now CTAs

#### `pending_brand` (waiting on brand)
- View PDF button
- "Contract signed successfully" successPale banner (if just-signed)
- No Sign CTA
- Production Arrangement visible

#### `active` (both signed)
- successPale active banner "Contract Active — Both parties have signed"
- View PDF button
- All cards + `InfluencerProductionPanel`

#### `completed` / `cancelled` (terminal)
- StatusPill canonical pill at top
- No Sign CTA, no production panel

### Cards rendered (conditional)

1. **Header**: ink + yellow rule + BACK + Outfit-Black title + StatusPill canonical
2. **Active banner** (if fullyActive)
3. **Draft banner** (if draft)
4. **Just-signed banner** (if signed && !fullyActive)
5. **Custom clauses highlight** (yellowPale, if any clauses enabled OR notes OR bonus > 0)
6. **View PDF** button (ink + yellow, if status !== draft && pdf_url)
7. **Campaign Details** card (campaign / brand / status / posting date)
8. **Agreed Fee** card (if fee > 0, successPale highlight)
9. **Deliverables** card (live deliverables OR formats_json fallback)
10. **Production Arrangement** card (mode-conditional: remote / visit / shipment)
11. **Payment Terms** card (if showTranches = fee > 0 && !isConversion) — 3 tranches w/ success/yellow/ink dots + total
12. **Commission Schedule** card (if showCommissionCard = commission_pct > 0 || isConversion)
13. **Content Guidelines** card (if content_requirements)
14. **Revision Policy** card (if revision_limit != null)
15. **Signatures** card (2-tile: Influencer + Brand)
16. **Sign Contract** card (if needsInfluencerSignature && !signed)
17. **Post-sign success** card (if signed && !fullyActive)
18. **InfluencerProductionPanel** sub-component (if fullyActive)

## InfluencerProductionPanel (sub-component)

Mounts on `fullyActive`. Issues `Promise.all([getProduction(contractId), getProductionDateRange(contractId)])`.

### By production_mode
- **remote**: bg2 box "💻 Remote production" + helper copy
- **visit**: detailed visit state machine (7 sub-states below)
- **shipment**: detailed shipment state machine (4 sub-states below)

### Visit sub-states (7)
1. `!hasLocation && !isCompleted` — "Brand will send location"
2. `hasLocation && !hasSlot && !isCompleted` — DateTimeChipPicker for influencer to pick first slot
3. `hasLocation && hasSlot && proposedByBrand && status==='proposed'` — Accept + Counter + Switch-to-remote
4. `hasLocation && hasSlot && proposedByInfluencer && status==='proposed'` — Waiting display
5. `status==='confirmed'` — "Mark visit complete" CTA
6. `status==='completed'` — Done state
7. `flipPending && !flipByMe` — yellowPale flip-confirmation banner; `flipByMe` — "waiting on brand" note

### Shipment sub-states (4)
1. `status==='proposed'` — Confirm address + Counter (different address)
2. `status==='confirmed'` — "Address confirmed" note
3. `status==='in_progress'` — Courier + tracking + "Package received" CTA
4. `status==='completed'` — Done state

### Action handlers (6 Alert flows + 4 direct)
- `handleAccept` → `acceptProduction`
- `handleProposeSlot` → `proposeProductionSlot`
- `handleCounterSlot` → `counterProposeProduction` (slot variant)
- `handleCounterShipment` → `counterProposeProduction` (address variant)
- `handleFlipToRemote` → 2-confirm Alert + `flipProductionToRemote`
- `handleConfirmReceived` → 2-confirm Alert + `confirmProductionReceived`
- `handleMarkVisitDone` → 2-confirm Alert + `completeProduction`

### Log history
Last 5 reverse-chrono entries (date · actor_role · action · notes).

## Edge cases preserved

- Multiple JSON-string parsing failures fall through to safe defaults
- StatusBadge → StatusPill canonical for both contract.status AND deliverable.status AND production_event.status
- 2/2 reschedule cap warning
- `slot_proposed_by` differentiation (brand vs influencer view variant)
- `remote_flip_requested_by` 2-party confirmation flow
