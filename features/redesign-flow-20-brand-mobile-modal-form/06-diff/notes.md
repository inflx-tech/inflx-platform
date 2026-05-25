# Flow 20 — before/after diff notes

> Step-8 artifact (UI-governed Rule 4).

## Files touched

- **Modified**: `Packages/Mobile/src/screens/brand/BrandEnquiriesScreen.js` — full rewrite, behavior preserved 1:1
- **Modified**: `Packages/Mobile/src/screens/brand/BrandProposalInboxScreen.js` — full rewrite, behavior preserved 1:1
- **Modified**: `Packages/Mobile/src/screens/brand/BrandInfluencerProfileScreen.js` — full rewrite, behavior preserved 1:1
- **Not modified**: `theme/tokens.js` — brandPalette covers all needed tokens
- **New**: `features/redesign-flow-20-brand-mobile-modal-form/{01-spec,02-workflow,03-expected-outputs,05-impact,lock.json,04-preview/workflow-prediction.md,04-preview/mockups/web.html,06-diff/notes.md}`
- **New**: `design/wave2/flow-20-brand-mobile-modal-form/web.html`

## Canonical status-pill map (NEW — consolidates 11 ad-hoc palettes)

11 hex literal palettes across 3 screens → 6 brandPalette tokens:

| Old hex literals across screens | New canonical token | Used by |
|---|---|---|
| `#FFF7ED+#C2410C` (Enq submitted), `#FFF4D6+#7A5500` (Prop sent), `#FFF4D6+#7A5500` (banner) | `yellowPale` + `yellowText` | new/submitted/sent + banner |
| `#EFF6FF+#1D4ED8` (Enq contacted/responded), `#DBE5FF+#1B2D5E` (Prop viewed) | `infoPale` + `info` | contacted/viewed/responded |
| `#EEEDFE+#5C50C8` (Prop countered), `#5C50C8` (counter btn bg) | `convPale` + `conv` | countered + counter-button surface |
| `#ECFDF5+#047857` (Enq converted + convert-box), `#E0FAF5+#007A63` (Prop accepted), `colors.teal` (accept btn) | `successPale` + `successText` + `success` | converted/accepted + convert UI |
| `#FDEEE9+#E8401A` (Prop rejected), `colors.red` (reject-confirm), `#80201A` | `dangerPale` + `dangerText` + `danger` | rejected/declined |
| `#F3F4F6+#4B5563` (Enq closed), `#F2F4F9+#8B91AD` (Prop expired/withdrawn) | `bg2` + `muted2` | closed/expired/withdrawn |

This consolidation is the single most-meaningful refactor in Flow 20 — every screen in the bucket can now use the same StatusPill colour map by importing the canonical const.

## Visual delta — Enquiries

| Element | Before | After |
|---|---|---|
| Header bg | `colors.navyDeep` | `brandPalette.ink` |
| Header title | System 22 bold white | Outfit-Bold 22 white + 30×3 yellow rule + PJS subtitle |
| Filter chip (inactive) | `colors.bg` rounded with border | `bg2` 99-radius pill |
| Filter chip (active) | `colors.navy` | `ink` bg + `yellow` mono text |
| Card status pill | Hex literal palettes (4 colours) | Canonical 6-token map |
| Card deal_value | hex `#047857` | `successText` mono |
| Modal `convertBox` | `#ECFDF5` bg + `#A7F3D0` border + `#047857` accents | `successPale` bg + `#A7F3D0` border + `successText` accents + green action button |
| Action secondary | `colors.navy` border + text | bg2 + ink (less prominent) |
| Loading | Bare ActivityIndicator on blank screen | Header preserved + yellow ActivityIndicator (large) |

## Visual delta — ProposalInbox

| Element | Before | After |
|---|---|---|
| Header bg | `colors.surface` (white) + bottom border, centred dark title | `ink` bg + white centred title + back-circle on left |
| Banner (not-accepting) | `#FFF4D6` strip + `#7A5500` text + `#B8860B` dark-gold button | `yellowPale` + `yellowText` + `ink`/`yellow` mono "Turn on" pill |
| Accepted-bar | `colors.tealPale` + `colors.tealDeep` | `successPale` + `successText` |
| Tabs | `colors.navy` underline + `colors.t3` muted inactive | `ink` underline + `muted2` inactive |
| Card status pill (7 variants) | 7 hex literal palettes | Canonical 6-token map (sent/viewed/countered/accepted/rejected + expired/withdrawn collapsed into grey) |
| Card "ask" amount | `colors.navy` | `ink` mono digits |
| Modal stat tiles | `colors.surface2` (light navy) | `bg2` |
| Modal counter button | `#5C50C8` purple bg + white text | `convPale` bg + `conv` text (purple kept, palette consistent) |
| Modal accept button | `colors.teal` bg + white text | `yellow` bg + `ink` text (canonical primary CTA) |
| Modal reject-confirm | `colors.red` bg | `danger` bg + white text (canonical destructive) |
| Modal portfolio link | `colors.navy` | `info` (blue) mono |
| Loading | Bare navy ActivityIndicator | yellow ActivityIndicator large |
| Empty state | Plain 📨 emoji + system font | Yellow-pale `[MAIL]` tile + Outfit title + PJS sub (matches Flow 18/19 empty pattern) |

## Visual delta — InfluencerProfile

| Element | Before | After |
|---|---|---|
| Hero bg | `colors.navyDeep` `#111E42` | `brandPalette.ink` `#0A0A0A` (full ink hero) |
| Avatar | `colors.orange` `#F47920` bg + white text | `brandPalette.yellow` `#FFC107` bg + ink text (Outfit) |
| Handle | System bold 20 white | Outfit-Bold 20 white -0.3 letterSpacing + yellow ✓ tick (when verified) |
| Full name | System 13 muted white | PJS Medium 12.5 muted white |
| Hero meta | System 11 capitalize | JetBrains Mono 10.5 UPPERCASE letterSpacing 0.4 |
| Stats grid | 6 tiles `colors.t3` label + `colors.t1` value | 6 tiles mono uppercase label + Outfit-Bold value |
| Card title | System 12 `colors.t2` uppercase | Outfit-Bold 10.5 `muted` uppercase |
| Niche chips | `colors.orangePale` `#FEF0E4` + `colors.orange` | `yellowPale` + `yellowText` |
| Lang chips | `colors.tealPale` + `colors.tealDeep` | `engPale` + `eng` (teal in brandPalette) |
| Price text | System bold | JetBrains Mono Bold |
| Past brands | `colors.t2` lines | `muted` PJS lines |
| Footer Invite CTA | `colors.orange` bg + white text | `yellow` bg + `ink` text (canonical primary) |
| Invite modal step title | `colors.navy` text | `ink` Outfit-Bold |
| Step breadcrumb-back | `colors.navy` | `yellowText` (matches link-hint pattern from Flow 18) |
| Pick rows | System font 13 bold | Outfit-Bold 13 (campaign/set name) + JetBrains Mono meta |
| Confirm card | `colors.navyPale` `#EDF1FA` | `yellow50` bg + `yellowPale` border (matches Flow 19 confirm pattern) |
| Field label | System 11 t2 uppercase | JetBrains Mono Bold 10 muted uppercase letterSpacing 0.4 |
| Input | System 13 + 1.5px border | PJS Medium 13 + 1.5px border (same look, locked font) |
| Offer-type chip (inactive/active) | `colors.bg` / `colors.navy` | `bg`/`ink` (active) + yellow mono text on active |
| Submit Invite CTA | `colors.orange` bg + white text | `yellow` bg + `ink` text |
| Empty panel (no campaigns) | Plain `colors.bg` border | `bg2` + `yellowPale` dashed border (matches Flow 18/19) |

## Behavior delta

**Zero behavioral change.** Every API call (8 endpoints across the 3 screens), Alert flow, optimistic update, multi-step state machine, KeyboardAvoidingView, modal `onRequestClose`, breadcrumb-back resets, goal-aware conditional rendering — all preserved verbatim.

| Behavior | Status |
|---|---|
| Enquiries: filter chip → getEnquiries({ status }) with "new"→"submitted" mapping | Preserved |
| Enquiries: useFocusEffect refetch on focus | Preserved |
| Enquiries: optimistic mark-contacted / converted / closed | Preserved (alerts updated to match palette) |
| Enquiries: Alert.alert confirmation on close | Preserved verbatim |
| Enquiries: deal_value validation (positive rupees required) | Preserved |
| Proposals: useEffect refetch on tab change | Preserved |
| Proposals: accepts_proposals toggle | Preserved |
| Proposals: 3-mode modal (null/reject/counter) | Preserved verbatim |
| Proposals: portfolio_links Linking.openURL | Preserved |
| Proposals: accept confirmation alert | Preserved |
| InfluencerProfile: getInfluencer on mount | Preserved |
| InfluencerProfile: not-found fallback | Preserved (palette adapted) |
| InfluencerProfile: niches/langs/pastBrands array-or-scalar normalize | Preserved verbatim |
| InfluencerProfile: fmtCompact (K/L/Cr) | Preserved verbatim |
| InfluencerProfile: 3-step invite modal state machine | Preserved verbatim |
| InfluencerProfile: campaign filter (published/active/live) | Preserved |
| InfluencerProfile: set pickSet auto-prefill (fee from per_influencer_budget; commission/offer for conversion/hybrid) | Preserved verbatim |
| InfluencerProfile: goal-aware form (needsFee / needsCommission) | Preserved |
| InfluencerProfile: inviteInfluencer + success Alert + goBack | Preserved |

## Wave-3 follower regression check

`theme/tokens.js` unchanged. 24 Wave-3 follower screens byte-identical. Zero regression.

## Pattern extraction trigger reached

**5 screens (Flows 18-20) now share:**
- Ink topbar (5 variants: title only / title+sub / title+back-pill / title+back-arrow / centred title)
- StatusPill with canonical 6-token map (cleanest in this flow)
- Bottom-sheet modal pattern (3 modals in this flow alone)
- Dashed-yellow empty-state card
- Yellow primary CTA / convPale counter / danger reject hierarchy
- Outfit/PJS/JetBrains-Mono font ladder

**Flow 21 will extract** into `Packages/Mobile/src/components/brand/`:
- `<ScreenHeader />` — 5 variant props
- `<StatusPill status="..." />` — single canonical map import
- `<EmptyState icon="[X]" title="..." sub="..." />`
- `<BottomSheet visible onClose ...>`
- `<PrimaryButton />` / `<DangerButton />` / `<CounterButton />`

Retroactive migration of Flows 18-20 to consume these components happens in the same Flow 21 commit (treated as a NO-TOUCH-WORKFLOW refactor: behavior preserved 1:1).

## QA classification (carried from Flow 19)

Flow 19 hit recurring MSG91 OTP rate-limit flakes in B1b verify-otp invariants (W5a/W5b/W5c). Flow 20 expects the same potential flake pattern given the tests target the same external dep. If `pnpm qa` is flaky again, classification per `feedback_qa_governance` + Flow 8 precedent → `deployed-pending-certification`. Mobile-only file changes have zero causal link to MSG91 throttle.
