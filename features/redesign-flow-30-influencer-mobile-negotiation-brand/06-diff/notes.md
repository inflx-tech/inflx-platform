# Flow 30 — 06-diff/notes.md

## Before

**NegotiationScreen (622 LOC)** on wave-1 palette:
- Dark navy header (`colors.navyDeep`) + white text + rgba-white-18 bespoke status pill (used `statusLabel()` helper for friendly text — NOT canonical StatusPill).
- Teal-pale "Latest" fee box (`colors.tealPale` + `colors.tealDeep`).
- NavyPale turn-info banner.
- Surface2 brand-bubble (left) + navyPale influencer-bubble (right) with `#D0D5EC` border.
- Orange/orangePale "Counter Offer" action badge.
- Teal Accept button + navy Counter button + redPale Walk Away.
- GoldPale waiting banner with `#7A5500` text + bespoke "..." icon.
- Dead `import StatusBadge` at line 15 (never used in JSX).
- Uses `colors.*` throughout.

**BrandProfileScreen (200 LOC)**:
- Dark navy header + white text.
- 64×64 rgba-white-15 logo fallback tile with white initial.
- Rgba-white-15 category badge.
- NavyPale active-campaigns stat box with navy mono number.
- Uses `colors.*` throughout.

## After

**StatusPill +mode='influencer'**:
- Adds branch after `mode === 'transaction'` override (~3 lines).
- When `mode === 'influencer'`:
  - `awaiting_brand` → label 'WAITING' (waiting for brand to respond)
  - `awaiting_influencer` → label 'YOUR TURN' (your turn to respond)
- All other status keys unchanged.
- Canonical map: 39 entries (unchanged).

**NegotiationScreen restyled**:
- Ink topbar with 30×3 yellow rule + back-chevron MCI + "Negotiation" Outfit-Bold 22 + canonical `<StatusPill mode="influencer" status={negotiation.status} />` (drops bespoke header pill).
- Brand name mono small caps + campaign name PJS.
- Offer Progress card: side-by-side Original (bg2 + ink) → chevron-right MCI → Latest (successPale + successText).
- Turn-info banner: yellowPale (your-turn) / infoPale (waiting) / bg2 (closed).
- Conversation card title with "(N messages)" mono.
- Turn bubbles: L (bg2 + muted actor) / R (yellowPale + ink actor); white-bg action badge with muted/yellowText border.
- Bubble fee = mono Outfit-Black; bubble note = PJS italic.
- Waiting banner: infoPale card with hourglass MCI in 48×48 white tile.
- Accept button: ink-bg-yellow-text Outfit-Black UPPERCASE.
- Counter inputs: ink-bordered (2px) with mono digits.
- Send Counter button: ink-bg-yellow-text matching Accept.
- Walk Away: dangerPale-bg-dangerText Outfit-Bold UPPERCASE.
- Closed card: successPale (agreed) OR bg2 (walked_away).
- Drops `import StatusBadge` line 15.
- ~52 colors.* token swaps.

**BrandProfileScreen restyled**:
- Ink topbar with 30×3 yellow rule + back-chevron MCI.
- 68×68 yellow logo tile with ink Outfit-Black initial fallback (was rgba-white-15 + white initial).
- Business name Outfit-Bold 22 white.
- Category badge in rgba-white-15 with mono uppercase font.
- Brand Details card: 4 conditional info rows with mono labels + PJS values.
- Campaigns stat box: yellowPale + 1.5px yellow border + ink Outfit-Black mono "5" + yellowText mono uppercase label (was navyPale + navy number).
- ~28 colors.* token swaps.

## What matches the mockup
- All 3 phone frames.
- StatusPill mode='influencer' role-flip on both Frame 1 + Frame 2.
- Original→Latest progress with chevron-right.
- Turn bubble L/R layout with bg2/yellowPale.
- ink/yellow primary CTAs + dangerPale Walk Away.
- 68×68 yellow brand tile + ink initial.

## What honestly diverged
- Mockup shows "Counter Offer" badge with subtle styling — implementation uses minimal white-bg badge with border matching bubble side.
- statusLabel() helper retained for the friendly turn-info banner copy (e.g. "your turn to respond") — header pill uses canonical StatusPill instead.

## Preserved verbatim
- All 4 `influencerApi.*` endpoint calls + payload shapes.
- All 13 NegotiationScreen render branches + 6 BrandProfileScreen branches.
- `useCallback` + `useEffect` patterns.
- L/R turn-bubble convention by `turn.sent_by === 'influencer'`.
- Goal-aware logic (`showFee` / `showCommission`).
- Counter validation rules (fee > 0; commission 0-100; disabled-button conditions).
- All 3 action paths (accept/counter/walkaway) + Alert.alert confirmation flows.
- `statusLabel()` helper for inline turn-info text.
- Two-entry-point resolution (`negotiation_id` OR `campaign_influencer_id`).
- `formatDate` helper.
- `renderProposalLine` helper.
- BrandProfile initial fallback derivation + 4-row conditional render.
- All `navigation.goBack()` / `navigation.navigate(...)` targets.
