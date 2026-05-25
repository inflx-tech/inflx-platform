# Brand-mobile bucket plan — 2026-05-25

> Locked plan for redesigning the 16 remaining mobile-brand screens
> (after Flow 18 shipped `BrandNotificationsScreen` on 2026-05-25).
> Per-flow rhythm follows the locked 5-step pattern (handoff §4).

## Sequence (9 flows · Flows 19-27)

| Flow | Screens (LOC each) | Cluster theme | Risk | Notes |
|---|---|---|---|---|
| 19 | StorePreview (288) + CampaignSetsList (265) | Read-only foundation | Low | Extract reusable `ReadOnlyRoster` + `OpenGroupFunnel` patterns |
| 20 | Enquiries (349) + ProposalInbox (395) + InfluencerProfile (530) | Modal/form patterns | Med | Extract reusable `ModalSheet`, `StatusPill`, `FormSection` patterns |
| 21 | Conversions (277) + InfluencerBrowse (363) | Filtering + expansion | Med | Extract `ExpandableListItem` + `FilterChips` patterns |
| 22 | CampaignInfluencersList (488) + CampaignReviewQueue (330) | Campaign deep-dives | High | Reuse `CampaignInfluencerCard` (tranche dots, progress bar) + `DeliverableCard` |
| 23 | ActionRequired (494) + Negotiation (439) | Multi-tab + ops | High | Extract `TabInbox`, `BulkSelectBar`, `TurnHistory` patterns |
| 24 | Profile (541) | Form-heavy, alone | High | `EditableForm`, `BranchListManager`, `BankDetailsForm` |
| 25 | MediaGallery (654) | R2 image upload, alone | Very High | `ImageUploadFlow`, `R2SignedUrlHandler`, `TabGallery` |
| 26 | Wallet (645) | Razorpay SDK, alone | Very High | `RazorpayCheckoutWrapper`, `WalletBalanceCard`, `TransactionHistoryList` |
| 27 | Contract (1341) | Signature + PDF + production lifecycle, alone | Critical | Largest. `ContractTermsEditor`, `StandardClausesPanel`, `ProductionLifecycleManager`, `SignaturePadWrapper`, `WalletLockDisplay` |

## Per-flow ceremony (locked)

1. **Audit + mockup** — read each in-scope screen, draft HTML mockup at phone-frame width (375px) covering all states. Mockup path: `design/wave2/flow-NN-<slug>/web.html` + mirror under `features/.../04-preview/mockups/`.
2. **Green signal from founder** — explicit lock before any code.
3. **Implement** — RN StyleSheet rewrite using `brandPalette` from `theme/tokens.js` (extended additively per flow if new clusters needed). Preserve all behavior 1:1 — no API contract changes, no nav changes, no data shape changes.
4. **QA** — `pnpm qa` expected 75/75 GREEN (no mobile tests in main lane). Classify any failure per `feedback_qa_governance.md`.
5. **Deploy + close-out** — push (feat commit) + OTA × 3 via `publish-ota:all` (see `feedback_ota_publish_strategy.md`) + close-out commit with `GOVERNANCE_OVERRIDE` until Maestro is wired.

## Pattern extraction policy

Per handoff §12: don't extract shared components in Flow 19. Wait until ≥3 screens use the same pattern. Components to watch for extraction during Flows 20-21:
- `<ScreenHeader />` — ink topbar + title + rule + count chip + right-pill (Flow 18 + 19 + 20)
- `<TypeAvatar />` — 38×38 type-coloured tile (Flow 18 specific; reuse if other screens get type-classified rows)
- `<EmptyState />` — dashed-yellow card + tile + title + sub (Flow 18 + 19)
- `<RelativeDate />` or shared `fmtRelative` helper — port to `theme/dates.js` once 2nd screen needs it

## NO-TOUCH (preserved across all 9 flows)

- `backend/**`, `backend/migrations/**` — Window A territory
- `Packages/shared/api/**` — shared API client Window A may extend
- Settings hub layout + subscription/billing pages — Window A's Phase A9 territory
- API call shapes, form field names, route names, AsyncStorage keys, role-routing branches
- `Packages/Mobile/src/config/api.js` — committed empty
- Existing `colors`, `lightColors`, `darkColors`, `businessAccents`, `fonts` exports in `theme/tokens.js` — preserves 24 Wave-3 follower/restaurant screens

## Maestro posture

For Flows 19-26: `GOVERNANCE_OVERRIDE="Maestro not yet wired for solo dev"` on the close-out push. Cleared once a dedicated Maestro-setup contract ships (deferred decision; not blocking the bucket).

For Flow 27 (Contract — Critical risk): **strongly recommend** wiring Maestro before shipping, given signature pad + PDF + production lifecycle complexity. Surface to founder before Flow 27 starts.

## Estimated effort

- Flows 19-23 (~5 flows, mostly bundled): ~80-120 min each = 7-10 hours total
- Flows 24-26 (~3 flows, single-screen but complex): ~120 min each = 6 hours total
- Flow 27 (Contract — critical, largest): ~180-240 min = 3-4 hours

**Total estimated: 16-20 hours over 4-6 sessions.**

## After this bucket: next bucket = mobile influencer (23 screens)
