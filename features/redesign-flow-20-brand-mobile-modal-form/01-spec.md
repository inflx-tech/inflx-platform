# Feature Spec — Flow 20 · brand-mobile modal/form bundle (Enquiries + Proposals + InfluencerProfile)

> Third flow of the mobile-brand bucket. Modal/form interaction cluster per audit Cluster 2. Builds on Flows 18-19's `brandPalette` + fonts.

## Problem / goal

All 3 screens currently render off-palette versus the brand-web wave and Flows 18-19:
- **BrandEnquiriesScreen** — navy header + 4 ad-hoc status-pill hex literals (#FFF7ED, #EFF6FF, #ECFDF5, #F3F4F6). Convert-action box uses green hex literals (#047857, #ECFDF5, #A7F3D0).
- **BrandProposalInboxScreen** — navy header + 7 ad-hoc status-pill palettes (sent/viewed/countered/accepted/rejected/expired/withdrawn). Counter button #5C50C8 purple, accept button `colors.teal`.
- **BrandInfluencerProfileScreen** — navy-deep hero + orange avatar + orange invite CTA + orange/teal chip palettes.

Bring all 3 to brandPalette parity with a **canonical status-pill colour map** that unifies the 11 disparate palettes used across the 3 screens into the locked palette's named tokens (yellowPale / infoPale / convPale / successPale / dangerPale / engPale / bg2). Preserve all behavior 1:1.

## Scope

**In scope:**
- Visual rewrite of `BrandEnquiriesScreen.js` (navy + custom-status-hex → brandPalette + canonical map)
- Visual rewrite of `BrandProposalInboxScreen.js` (navy + 7-palette ad-hoc → brandPalette + canonical map)
- Visual rewrite of `BrandInfluencerProfileScreen.js` (navy-deep + orange → ink + yellow; orange/teal chips → yellow/eng palette chips)
- Preserve all behavior: filter chips on Enquiries, status tabs on ProposalInbox, multi-step invite modal (campaign picker → set picker → form), modal sheets, KeyboardAvoidingView, Alert flows, optimistic updates
- Apply Outfit/PJS/JetBrains-Mono fonts throughout

**Explicitly out of scope:**
- `theme/tokens.js` changes (brandPalette from Flow 18 covers everything)
- API/contract changes (no migrations, no shape changes)
- Adding bulk operations on enquiries/proposals
- Adding new modal flows (decline/counter/accept stays as 3 states; invite stays as 3 steps)
- Component extraction into `Packages/Mobile/src/components/brand/` — deferred to Flow 21 per handoff §12 wait-for-3 rule (this flow will be the 3rd-5th screens consuming the inline ink-topbar; Flow 21 extracts)
- Maestro setup (deferred)

## Surfaces touched

- **App(s)**: mobile-brand (3 screen files)
- **Roles involved**: brand

## Data / contracts

- **Tables / columns / migrations**: none
- **API endpoints**: none changed; consume existing:
  - GET `/v1/enquiries` (status filter) + PUT `/v1/enquiries/:id` (status + deal_value)
  - GET `/v1/proposals` (status filter) + GET `/v1/brand/proposal-settings` + PUT settings + POST `/proposals/:id/accept` + `/reject` + `/counter`
  - GET `/v1/influencers/:id` + GET `/v1/campaigns` + GET `/v1/campaigns/:id/sets` + POST `/v1/campaigns/:cId/sets/:sId/invites`
- **Money/units**: `deal_value` in rupees (`fmtMoney`); `agreed_fee`, `proposed_fee` in rupees (`fmtRupees`); commission_pct as plain number
- **Status machines**: enquiry (submitted/contacted/converted/closed), proposal (sent/viewed/countered/accepted/rejected/expired/withdrawn), campaign_influencer (invited via inviteInfluencer)

## Non-functional

- **Auth/role gates**: unchanged
- **Failure modes**:
  - Enquiries empty list → empty card with hint
  - Proposals empty → 📨 (will swap to `[MAIL]` mono placeholder) + "No proposals here" + sub
  - InfluencerProfile not-found → error card + go-back fallback
  - Invite modal: no eligible campaigns → empty panel; no sets in picked campaign → empty body
  - All API failures → `Alert.alert` (preserved)
  - Convert without amount → preserved validation alert
