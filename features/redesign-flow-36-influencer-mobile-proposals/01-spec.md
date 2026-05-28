# Flow 36 — Influencer-mobile ProposalsHub + SendProposal · Spec

**Bucket**: mobile-influencer redesign (Wave 2)
**Flow position**: 9/23
**Owner**: founder
**Locked**: 2026-05-27

## 1 · Problem

Two outbound-proposal screens on legacy navy/teal/orange palette + DM Sans/Syne fonts:
- `ProposalsHubScreen` (298 LOC) — 2-tab (Discover/MyProposals) hub with 7-status pipeline
- `SendProposalScreen` (245 LOC) — form to send a pitch with criteria card + 5-format deliverables counter

Off-brand vs Flow 28-35: ad-hoc STATUS_PILL with custom hex (7 keys), navy tab-active, surface2/orange/navy chips, navy SUBMIT CTA, no canonical StatusPill, no MCI back-chevron.

## 2 · Goal

Visual + UX restyle to brandPalette + Outfit/Plus Jakarta Sans/JetBrains Mono fonts + selective StatusPill canonical migration. Preserve every render branch, every API call, every validation rule. Zero backend change. Zero StatusPill canonical-map additions. Zero new SDK boundaries.

## 3 · Scope

### In-scope
- `Packages/Mobile/src/screens/influencer/ProposalsHubScreen.js` (298 LOC) — full rewrite
- `Packages/Mobile/src/screens/influencer/SendProposalScreen.js` (245 LOC) — full rewrite

### Out-of-scope
- `backend/**` — zero backend change
- StatusPill canonical map — zero map additions (6 of 7 statuses already match; `sent` gets inline pill with sender-POV 'SENT' label since canonical 'sent' → 'NEW' is recipient-POV)
- Native build / android/** — no native rebuild
- All previously shipped influencer screens (Flows 28-35)

## 4 · Data / dependencies

### 4.1 · API calls preserved verbatim (6 endpoints)

| API | Source | Use |
|---|---|---|
| `discoverBrands(q)` | Discover tab | Brands accepting proposals (debounced search) |
| `listMyProposals()` | MyProposals tab | Own outbound proposals |
| `withdrawProposal(id)` POST | MyProposals tab | Withdraw active proposal |
| `respondCounter(id, action)` POST | MyProposals tab | action='accept'|'decline' |
| `getBrandProposalCriteria(brandId)` | SendProposal | Brand filter criteria |
| `createProposal({...})` POST | SendProposal | Submit pitch |

### 4.2 · DB columns referenced

- `proposals.status` ∈ {sent, viewed, countered, accepted, rejected, expired, withdrawn}
- `proposals.pitch_title / pitch_message / brand_response_message`
- `proposals.proposed_fee / proposed_commission_pct / proposed_deliverables[] / proposed_posting_window_start / end / portfolio_links[]`
- `proposals.counter_terms` (JSONB: {proposed_fee, proposed_commission_pct})
- `brands.proposal_filters` (JSONB: {min_tier, allowed_niches[], city_match_required, min_engagement_rate, only_past_collabs})
- `brands.business_name / logo_url / category / brand_city / city`

### 4.3 · No new tables / no migrations

## 5 · Risk surface

- **LOW risk** — read + 2 POSTs (withdraw, respondCounter) + create proposal
- **5-proposal cap** enforced server-side (UI shows hint in intro card)
- **Debounced search** (300ms timeout) preserved
- **Form validation:** title + pitch required, at least 1 deliverable, fee required if not conversion
- **Goal-conditional fields:** fee shown when goal !== 'conversion'; commission shown when goal !== 'engagement'
- **Withdraw 2-confirm Alert** + destructive style preserved
- **KeyboardAvoidingView** for iOS keyboard preserved
- **`sent` status semantic-mismatch handling**: canonical 'NEW' (recipient-POV) → inline 'SENT' pill (sender-POV) for outbound view

## 6 · Success criteria

1. 2 screens render on brandPalette + Outfit/PJS/Mono
2. ALL 18 render branches preserved
3. ALL 6 APIs preserved verbatim
4. StatusPill canonical for 6 statuses (viewed/countered/accepted/rejected/expired/withdrawn); inline yellowPale 'SENT' for sent
5. Debounced search preserved
6. Withdraw 2-confirm + respondCounter('accept'|'decline') preserved
7. Goal-conditional fee/commission inputs preserved
8. 5-format deliverable counter rows preserved
9. KeyboardAvoidingView preserved
10. Web `pnpm qa` 76/76 GREEN gate 0 first-run
11. OTA brand v86 / influencer v75 / follower v49 published
12. lock.json `release.released = true` after deploy
13. `06-diff/notes.md` non-empty
