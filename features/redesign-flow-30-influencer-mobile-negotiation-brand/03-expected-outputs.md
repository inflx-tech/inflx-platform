# Flow 30 — Expected outputs

## Visual evidence (matches locked mockup)

### Frame 1 — Negotiation "Your Turn"
- Ink topbar + 30×3 yellow rule + back-chevron MCI + "Negotiation" title.
- StatusPill `mode='influencer'` renders `awaiting_influencer → YOUR TURN` (yellowPale + yellowText).
- Brand "SoundCo" (mono small caps muted-white) + campaign "Bluetooth Speaker Launch · Hybrid".
- Offer Progress card: Original "₹12,000 + 10%" (bg2) → chevron-right MCI → Latest "₹18,000 + 10%" (successPale + successText). Turn-info banner: yellowPale "YOUR TURN TO RESPOND".
- Conversation card "(3 messages)": 3 bubbles.
  - L (brand bg2): "Brand · 2 Nov · 10:30 AM" + Counter Offer badge + "₹12,000 + 10% comm." + italic note.
  - R (influencer yellowPale): "You · 2 Nov · 02:15 PM" + Counter Offer badge + "₹20,000 + 12% comm." + italic note.
  - L (brand): "Brand · 3 Nov · 09:05 AM" + Counter Offer badge + "₹18,000 + 10% comm." + italic note.
- Your Response card: ink-bg-yellow-text "ACCEPT ₹18,000 + 10% COMM." + counter section (₹19,000 + 11% in ink-bordered inputs + note placeholder + ink/yellow SEND COUNTER OFFER) + dangerPale WALK AWAY.

### Frame 2 — Negotiation "Waiting for Brand"
- Same header pattern with StatusPill `mode='influencer'` rendering `awaiting_brand → WAITING` (infoPale + info).
- Offer Progress: Original (bg2) → Latest (successPale). Turn-info banner: infoPale "WAITING FOR BRAND TO RESPOND".
- Waiting banner card (infoPale + info border): hourglass MCI in 48×48 white tile + "Waiting for Brand" + descriptive copy.
- Conversation card "(2 messages)" with the same L/R pattern.
- NO Your Response card (read-only state).

### Frame 3 — BrandProfile
- Ink topbar with yellow rule + back-chevron MCI.
- 68×68 yellow tile with ink-Outfit-Black "S" initial fallback + "Sparkle Cosmetics" + rgba-white-15 "Beauty" category badge.
- Brand Details card: 4 info rows (Business Name · Category · Location · On INFLX Since).
- Campaigns stat box: yellowPale tile with ink Outfit-Black mono "5" + mono yellowText "ACTIVE CAMPAIGNS" label.

### Side panel
- StatusPill `mode='influencer'` table (5 statuses; 2 inverted vs brand POV).
- Agreed-state closed card (successPale).
- Walked-away closed card (bg2).
- 4-API trace.
- 13 + 6 preserved branches.
- 3 adjacent fixes (dead import, orange→bg2, ~80 token swaps).

## Data assertions (no change)

- `getNegotiation(id)` and `getNegotiationByCampaignInfluencer(ciId)` return `{ negotiation: {...}, turns: [...] }`.
- `getBrandPublicProfile(brand_id)` returns `{ brand: {...} }` with all 6 fields.
- `submitNegotiationTurn` payload shape preserved exactly.
- Actions: `counter` | `accept` | `walkaway`.

## Behavioural assertions (preserved)

- `pnpm qa` 76+ passed gate 0 STATE=GREEN first-run after dual-probe pre-warm.
- Tap Accept → Alert.alert confirm → on accept: API call + Alert "Accepted" + goBack.
- Send Counter → validate (fee > 0; commission 0-100) → API call + clear form + reload.
- Walk Away → Alert.alert destructive confirm → API call + Alert "Closed" + goBack.
- Pull-to-refresh on either screen reloads its data.
- StatusPill `mode='influencer'` flips only `awaiting_brand` and `awaiting_influencer` labels; all other statuses unchanged.

## Regression watch

- All 13 NegotiationScreen branches render correctly (loading / empty / header / offer-progress / turn-info / conversation-empty / turn-bubbles / waiting / counter-form-engagement / counter-form-conversion / counter-form-hybrid / closed-agreed / closed-walked).
- All 6 BrandProfileScreen branches render correctly.
- L/R turn bubble alignment based on `turn.sent_by` works for both brand and influencer turns.
- StatusPill canonical map total = 39 (no additions; just mode branch).
- Existing brand-mobile consumers of StatusPill that DON'T pass `mode='influencer'` continue to see their current labels.
- `statusLabel()` helper still emits correct friendly text for the turn-info banner.
