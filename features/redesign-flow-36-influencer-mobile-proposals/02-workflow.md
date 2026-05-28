# Flow 36 — Workflow

## A · ProposalsHubScreen

### Preconditions
- Logged-in influencer; tapped "Brand Proposals" doc-row in Profile.

### Steps
1. White topbar with bg2 MCI chevron-left back btn + centered Outfit-Bold title.
2. 2-tab bar (DISCOVER / MY PROPOSALS) with yellow-underline active state.
3. **Discover tab (default):**
   - Search input (white-bg with border) with 300ms debounced `discoverBrands(q)` call.
   - Intro card with Outfit-Bold "Pitch a brand" + sans body explaining 5-proposal cap.
   - Brand cards: yellow logo tile with ink Outfit-Black initials (OR `<Image>` if `logo_url`) + Outfit-Bold name + mono UPPERCASE category·city + chevron-right.
   - Tap → `navigation.navigate('SendProposal', { brandId, brandName })`.
   - Empty state: yellowPale dashed-border tile + 🔍 + "No brands accepting proposals" + helper copy.
4. **My Proposals tab:**
   - `listMyProposals()` on mount.
   - Per-proposal card:
     - Header: Outfit-Bold `pitch_title` + mono UPPERCASE `TO: BRAND_NAME` + status pill (canonical StatusPill for 6 statuses; inline yellowPale 'SENT' for sent).
     - Pitch message (sans, 3-line clamp).
     - Foot: mono UPPERCASE `fmtRupees(proposed_fee)` + `proposed_commission_pct % COMMISSION` + mono date.
     - **Rejected** state: dangerPale reject box with Outfit-Bold "REASON FROM BRAND" + sans `brand_response_message`.
     - **Countered** state: convPale counter box with Outfit-Black "BRAND SENT A COUNTER" + sans `brand_response_message` + mono `counter_terms.proposed_fee / proposed_commission_pct` + ghost-ink DECLINE + ink/yellow ACCEPT COUNTER buttons.
     - **Active** states (sent/viewed/countered): dashed dangerText WITHDRAW link.
   - Empty state: yellowPale dashed-border tile + 📨 + "No proposals yet" + helper copy.
5. Withdraw flow (`withdraw(p)`):
   - 2-confirm Alert with destructive style.
   - On confirm: `withdrawProposal(p.id)` + reload.
6. Counter response (`respondCounter(p, action)`):
   - `respondCounter(p.id, action)` POST.
   - On success: reload list.

### Failure modes
- API error → silent on load; Alert on withdraw/respond errors.

## B · SendProposalScreen

### Preconditions
- Tapped a brand card in Discover; route params `{ brandId, brandName }`.

### Steps
1. White topbar with bg2 back-btn + Outfit-Bold "Send Proposal" + mono UPPERCASE brand name sub.
2. Mount → `getBrandProposalCriteria(brandId)`.
3. Criteria card (yellowPale + #F0DA88 border) renders if criteria present:
   - Outfit-Black "WHAT THIS BRAND WANTS" title.
   - Bullet list: min_tier, allowed_niches, city_match_required, min_engagement_rate, only_past_collabs.
   - If no filters set → "No specific criteria — open to anyone".
4. Form sections (top-to-bottom):
   - **TITLE** (mono UPPERCASE label) → ink-bordered input
   - **PITCH** → ink-bordered multiline input (110 height)
   - **GOAL** → 3 chip row (engagement / conversion / hybrid) with ink-active state
   - **FEE (₹)** → ink-bordered input (visible if goal !== 'conversion')
   - **COMMISSION %** → ink-bordered input (visible if goal !== 'engagement')
   - **DELIVERABLES** → 5 format rows (Reel/Post/Story/YT Video/YT Short) each with Outfit-Bold label + bg2 -/+ buttons + mono number
   - **POSTING WINDOW (OPTIONAL)** → 2 date input row (From / To)
   - **PORTFOLIO SAMPLES** → 3 URL inputs
5. **SEND PROPOSAL** CTA (ink/yellow Outfit-Black UPPERCASE).
6. Submit validation:
   - Title + pitch required → Alert "Missing"
   - At least 1 deliverable → Alert "Missing"
   - Fee required if goal !== 'conversion' → Alert "Missing"
7. On submit: `createProposal({...payload})` → success Alert + `navigation.goBack()`; failure Alert.

### Edge cases preserved
- `portfolio_links` filtered to remove empty strings before POST
- `proposed_deliverables` derived from `deliverables` state via `Object.entries(...).map(...)`
- `posting_window_start/end` only POSTed if filled
- `proposed_fee` cast to Number only if `fee` truthy; same for `proposed_commission_pct`
- KeyboardAvoidingView with `behavior='padding'` on iOS
