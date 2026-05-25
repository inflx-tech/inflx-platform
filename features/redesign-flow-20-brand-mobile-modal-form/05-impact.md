# Impact Analysis — Flow 20

> Chat verdict (terse): **Impact: zero functional / backend / logic / DB impact — visual + UX only across 3 modal/form screens; no tokens.js change.**

## Affected files

- `Packages/Mobile/src/screens/brand/BrandEnquiriesScreen.js` — full visual rewrite (~350 LOC)
- `Packages/Mobile/src/screens/brand/BrandProposalInboxScreen.js` — full visual rewrite (~395 LOC)
- `Packages/Mobile/src/screens/brand/BrandInfluencerProfileScreen.js` — full visual rewrite (~530 LOC)
- `theme/tokens.js`: NOT touched (brandPalette covers all needed tokens)

## Routes / APIs

| Endpoint | Change | Consumers |
|---|---|---|
| GET /v1/enquiries, PUT /v1/enquiries/:id | none | Enquiries screen |
| GET /v1/proposals, GET /v1/brand/proposal-settings, PUT settings, POST accept/reject/counter | none | ProposalInbox |
| GET /v1/influencers/:id, GET /v1/campaigns, GET /v1/campaigns/:id/sets, POST invites | none | InfluencerProfile + InviteModal |

## Regression surface

- pnpm qa main lane: 75 tests, no overlap with mobile screens; expect GREEN unless MSG91 throttle persists from Flow 19
- 24 Wave-3 follower screens: no impact (tokens.js untouched)
- BrandInfluencerBrowse + CampaignInfluencersList: these nav INTO InfluencerProfile; param shape (`influencerId`) preserved
- Sticky footer of InfluencerProfile is `position: absolute` — unchanged structurally

## Migration / deploy

- New migration: No
- Mobile JS: Yes → OTA × 3 via `publish-ota:all` per `feedback_ota_publish_strategy`
- NATIVE_RUNTIME: not bumped
- APK rebuild: No

## Risk

- **Largest flow yet by LOC** (~1,275 LOC across 3 screens, vs 450 in Flow 19 and 200 in Flow 18). 3 modal flows + 1 multi-step invite = more code surface
- 11 status-pill palettes consolidated into 6 canonical tokens — verify-twice the mapping doesn't lose information (e.g. `viewed` and `contacted` both → `info` is OK, but `expired` ≠ `closed` semantically — keep `bg2/muted2` for both as "terminal-grey" cluster)
- Invite-modal's 3-step state machine (`pickedCampaign`, `pickedSet`, form fields) preserved verbatim — only visual changes
- Maestro Rule 5: GOVERNANCE_OVERRIDE on close-out
- **MSG91 throttle**: Flow 19 hit it. If pnpm qa still red on B1b after Flow 19, document as continuing environmental issue in Flow 20 release-evidence; don't let it block deploy if zero overlap

## Time estimate

- Mockup + lock: 45 min
- Implementation (3 screens): 90-120 min
- pnpm qa baseline: 5 min
- Commit + push + OTA + close-out: 15 min

Total: ~155 min for Flow 20.

## Pattern extraction (Flow 21 trigger)

After Flow 20 ships, 5 screens (Flows 18-20) share:
- Ink topbar pattern (5 variants: title only, title+sub, title+back, title+back+count, title+back+sub)
- StatusPill with the canonical 6-token map
- Bottom-sheet modal pattern (Enquiries detail, ProposalInbox detail, Invite modal)
- Dashed-yellow empty state

Flow 21 will introduce `Packages/Mobile/src/components/brand/` extraction + retroactive consumer migration in Flows 18-20.
