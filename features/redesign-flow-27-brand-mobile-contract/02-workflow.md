# Flow 27 — Workflow

## Actor
Brand user on mobile (RN, brand-flavor APK or OTA bundle v77+).

## Preconditions
- Brand has at least one `campaign_influencers` row whose `contract_id` is non-null (state machine has progressed past `accepted`).
- Brand authenticated (JWT in AsyncStorage).
- Brand can reach this screen via two nav inputs:
  - From `BrandActionRequired` (signatures tab) → `navigation.navigate('BrandContract', { campaignInfluencerId, influencerName, goal })`
  - From `CampaignInfluencersList` ("Open contract" row action) → same params

## Steps

### A. Main screen (driven by `contract.status`)

1. Screen mounts → parallel `Promise.all([getContract, getMe])` resolves loading state and hydrates wallet snapshot.
2. Editor hydrates from `contract.custom_clauses` (defensive JSON parse), `contract.bonus_amount`, `contract.production_mode`, `contract.content_requirements` (falling back to `data.suggested_content_requirements`).
3. Render branches by status:
   - **`draft`** → editor (Content Requirements + Clauses + Bonus + Mode picker). Primary CTA = "Approve & Send to Influencer".
   - **`pending_influencer` + NOT `influencer_signed_at`** → editor (re-approve flow). Primary CTA = "Update & Re-send to Influencer". Banner: "Update Terms Before Influencer Signs".
   - **`pending_influencer` + `influencer_signed_at`** → read-only. Waiting banner: "⏳ Waiting on Influencer".
   - **`pending_brand`** → read-only. Primary CTA = "Counter-sign Contract".
   - **`active`** → read-only banners + `<BrandProductionPanel />` mounts.
4. Wallet-shortage crosscut: in editor states, `lockNeeded = (base + bonus) × (1 + fee%) > walletBalance + 0.01` flips the CTA to disabled + "Top up wallet to send".
5. "View Contract PDF" always rendered when `contract.id` exists → `navigation.navigate('ContractPdf', { contractId, role: 'brand' })`.

### B. Production panel (mounts only when `isActive`)

1. Panel loads via `Promise.all([getProduction, getProductionDateRange])`.
2. Render branches by `event` + `mode`:
   - **no event yet** → setup picker (3 mode cards, each calls `initialiseProduction`).
   - **`mode === 'remote'`** → static "Remote production" notice card.
   - **`mode === 'visit'`** (6 sub-states):
     - no location → location form → `setProductionVisitDetails`
     - location set, no slot → waiting display + skip-to-remote link
     - influencer proposed slot → Accept (`acceptProduction`) / Suggest another time (`counterProposeProduction` via `DateTimeChipPicker`) / Skip-to-remote (`flipProductionToRemote`)
     - brand proposed slot → waiting display + reschedule count
     - confirmed → Mark visit done (`completeProduction`) + optional Reschedule (`setProductionVisitDetails`)
     - completed → completion card
   - **`mode === 'shipment'`** (4 sub-states):
     - proposed → waiting display
     - confirmed → Courier + AWB form → `dispatchProduction`
     - in_progress → tracking display
     - completed → completion card
   - **crosscutting flip banner** → if `event.remote_flip_requested_by` set by OTHER side, show banner with Confirm flip; if set by THIS side, show info note.
3. Audit log (last 5 entries, reversed) renders when `log.length > 0`.

## Success
User completes the action appropriate to current state without crashes, page navigates back / re-loads with backend's new state, and all status pills update canonically. Visual = locked mockup.

## Edge cases (preserved verbatim)
- Editor on `pending_influencer + signed=false`: still editable; "re-approve" Alert copy differs.
- Wallet shortage: button disabled, label flipped; backend re-enforces on send.
- `custom_clauses` may be JSON string OR object — defensive parse.
- `goal === 'conversion'`: no Base Fee row, no wallet check (commission-only); brand-sign Alert says "tracking link goes live" instead of "Tranche 1 released".
- Production panel: `event === null` shows escape-hatch initialiser (for legacy contracts signed before Phase P).
- 2-reschedule limit for brand surfaced as "Reschedules used: N of 2" small note.
- Remote-flip is two-sided: requires both parties to confirm via same endpoint.

## What does NOT change
- Any backend route, controller, migration, or DB row.
- Any `brandApi.*` signature or payload field name.
- Any state-machine branch or boolean derivation.
- Math for wallet lock (kept literal in 2 places).
- `STANDARD_CLAUSES` 3-entry config (data, not styling).
- `DateTimeChipPicker` (deferred to influencer bucket).
- `ContractPdf` screen (out of scope).
