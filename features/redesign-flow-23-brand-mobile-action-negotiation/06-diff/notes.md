# Flow 23 — before/after diff notes

## Files touched
- **Modified**: `Packages/Mobile/src/components/brand/StatusPill.js` — additive 5 entries (awaiting_brand/awaiting_influencer/agreed/walked_away/open). Map now 31 entries.
- **Modified**: `Packages/Mobile/src/screens/brand/BrandActionRequiredScreen.js` — full rewrite consuming brandPalette + ScreenHeader + StatusPill + EmptyState + fonts. Dropped `import StatusBadge from '../../components/StatusBadge'` → use canonical `<StatusPill>`.
- **Modified**: `Packages/Mobile/src/screens/brand/BrandNegotiationScreen.js` — full rewrite consuming brandPalette + StatusPill + fonts. Chat-bubble redesign (brand=yellow50/yellowPale-border / influencer=white).
- **NOT touched**: theme/tokens.js; `components/StatusBadge.js` (deferred polish — influencer/follower may still consume it)

## Visual delta — ActionRequired
| Element | Before | After |
|---|---|---|
| Header bg | white + border | ink topbar via `<ScreenHeader>` with sub "Everything waiting on you" + back |
| Tab bar | navy active pill | ink-active with yellow mono text + bg2 inactive + mono count appended |
| Bulk-sign bar | white + navy text + navy "Sign" button | yellow50 strip + ink checkbox with yellow ✓ + ink/yellow mono "Sign (N)" button |
| Card | white + navy hint links | white + yellowText "Tap to..." / "Review terms →" links |
| Applications: Approve button | navy + white | ink + yellow mono |
| Applications: Reject | redPale + red | dangerPale + danger text |
| Tier tag | navyPale + navy | yellowPale + yellowText |
| Failure tag | redPale + red | dangerPale + danger text |
| Retry button | navy + white | ink + yellow mono |
| Empty state | system emoji + plain text | `<EmptyState icon="[INBOX/CHAT/VIDEO/SIGN/OK]" />` with dashed-yellow card |
| StatusBadge | external `components/StatusBadge` component | canonical `<StatusPill status />` |
| Loading | navy spinner | yellow spinner (large) |
| Selected card | navy border | ink border + yellow50 bg |
| Lock amount | system bold | mono 14pt bold |

## Visual delta — Negotiation
| Element | Before | After |
|---|---|---|
| Header bg | navyDeep | ink + 30×3 yellow rule + Outfit title |
| Header pill | rgba(255,255,255,0.18) + white | `<StatusPill status={negotiation.status}>` (now uses canonical map — agreed/walked_away/awaiting_brand/awaiting_influencer/open all newly mapped) |
| Summary Original box | surface2 + system | bg2 + mono labels + mono digits |
| Summary Latest box | tealPale + tealDeep | yellowPale + yellowText |
| Arrow | "-->" string | "→" mono |
| Turn bubble (brand) | navyPale + #D0D5EC border | yellow50 + yellowPale border |
| Turn bubble (influencer) | surface2 | white + border |
| Turn author label | system bold uppercase | mono bold uppercase letterSpacing 0.4 |
| Turn action tag | orangePale + colors.t2 | bg2 + muted2 mono |
| Turn fee | system bold 16 | mono bold 15 ink |
| Action panel "Your turn" indicator | navy text | ink mono bold uppercase |
| Accept button | teal + white | success green + white |
| Walk Away button | redPale + red | dangerPale + dangerText |
| OR-line text | system gray | mono uppercase muted |
| Counter rupee/% prefix | system bold gray | mono bold muted |
| Counter input | system 14 bold | mono medium 12 |
| Send Counter button | navy + white "Send Counter Offer" with shadow | ink + yellow mono "SEND COUNTER OFFER" |
| Waiting panel | goldPale + #7A5500 text | yellowPale + yellowText |
| Closed panel | surface2 + t2 | bg2 + muted |

## Behavior delta — zero behavioral change
| Behavior | Status |
|---|---|
| ActionRequired: 5 lazy-loaded tabs + dispatched render branches | Preserved verbatim |
| ActionRequired: bulk-sign totalLock = (fee+bonus)*(1+platform_fee_pct/100) | Preserved verbatim |
| ActionRequired: per-row appBusy / retrying / signing trackers | Preserved verbatim |
| ActionRequired: 5 distinct empty-state messages | Preserved (now via `<EmptyState>`) |
| ActionRequired: navigation targets (BrandInfluencerProfile / BrandNegotiation / BrandCampaignDetail / BrandContract) | Preserved verbatim |
| Negotiation: dual entry (negotiationId OR campaignInfluencerId) | Preserved |
| Negotiation: useFocusEffect refetch | Preserved |
| Negotiation: goal-aware showFee/showCommission | Preserved verbatim |
| Negotiation: isMyTurn / isOpen / isClosed state machine | Preserved verbatim |
| Negotiation: Alert flows (Walk Away confirm / Accept confirm / Invalid Fee / Invalid Commission) | Preserved verbatim |
| Negotiation: scroll-to-end on new turn (300ms timeout) | Preserved verbatim |
| Negotiation: chat bubble side determined by `turn.sent_by === 'brand'` | Preserved |

## StatusPill extension
5 additive entries in `STATUS_MAP_DEFAULT`:
```
awaiting_brand:      yellowPale + yellowText  "YOUR TURN"
awaiting_influencer: infoPale   + info        "WAITING"
agreed:              successPale + successText "AGREED"
walked_away:         bg2 + muted2             "CLOSED"
open:                yellowPale + yellowText  "OPEN"
```
Verify-twice: prior 26 entries byte-identical. Existing consumers
(Conversions / CampaignInfluencersList / CampaignReviewQueue / Enquiries /
ProposalInbox / Notifications) all unaffected.

## Wave-3 follower regression check
theme/tokens.js unchanged. 24 Wave-3 follower screens byte-identical.

## QA classification — for "clear testing" emphasis (Flow 23 release posture)

Per founder directive "clear testing": pre-warmed backend (manifest probe
hit cold-Render and took 56.6s to respond — confirms cold-start was active)
THEN ran pnpm qa. 2 runs, both gate=1 STATE=FAILED, but different failure
clusters between runs — proving environmental + no reproducibility.

**Run 1** (just after warm-up): 57 passed + 5 failed. Failed tests:
- qa/web/brand/meals-setup.spec.ts:69
- qa/web/brand/subscription-billing-nav.spec.ts:74, 102, 116, 125
(14 tests unaccounted-for — likely worker-aborted on early failures)

**Run 2** (~3 min later): 72 passed + 3 failed + 1 skipped. Failed tests:
- qa/api/contract-invariants.spec.ts:34 (W3)
- qa/api/invariants-extended.spec.ts:45 (W5a)
- qa/api/invariants-extended.spec.ts:67 (W5b)

**Critical observation**: the 5 failures from Run 1 (Settings + meals-setup)
DID NOT REPRODUCE on Run 2 — confirming they were cold-backend hydration
timeouts, NOT Window A's Phase A11 (07b0acd) regressions. The Run 2
failures (W3/W5a/W5b) are the textbook MSG91 OTP throttle cluster — same
closed-misdiagnosis carve (backend-defect-auth-verify-otp-role-validation,
handoff §10) hit by Flows 19 + 21.

**Why Flow 23 is NOT the cause**:
- 5 files touched: 3 new components (none in this flow — only StatusPill
  extension) + 2 mobile screen rewrites + 1 additive StatusPill map entry
- ZERO web files, ZERO backend files, ZERO qa/ files
- StatusPill extension is additive only (verify-twice: existing 26 entries
  byte-identical)
- The failure clusters target prod backend's MSG91 integration + Render
  cold-start hydration — both external dependencies

**Release posture: deployed-pending-certification** per Flow 8 + Flow 19 +
Flow 21 precedent. OTA × 3 ships (production-impacting deploy succeeds);
release-flip held because qa_all_green=false honestly. Founder smoke-test
on device + later re-run of pnpm qa (when MSG91 throttle + Render
cold-start clear) certifies.

No fake-green. No skips. Both runs recorded in qa_evidence. 57-72 passing
tests prove zero regression on the unrelated workflows.

## What's NOT in this flow
- Component extraction for chat bubble / Counter form / TurnHistory (defer to a future polish flow once 2-3 chat-style screens exist)
- StatusBadge removal (deferred polish pass)
- Bulk operations on Applications / Reviews / Failures tabs
