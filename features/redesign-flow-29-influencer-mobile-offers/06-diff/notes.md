# Flow 29 — 06-diff/notes.md

## Before

**OfferListScreen (235 LOC)** on wave-1 palette:
- Navy bg active pill + white text · t3 muted inactive
- 5 emoji empty icons (📩 ✅ 🚫 ⏰ 📋)
- `StatusBadge` (legacy) on each card
- Uses `colors.*` throughout

**OfferDetailScreen (1228 LOC)**:
- Dark navy topbar with white text + `colors.gold` countdown text on rgba-white-10 chip
- Teal-pale fee highlight (`colors.tealPale` + `colors.tealDeep`)
- Teal/orange/navy tranche dots
- Gold-pale TDS note background + `#7A5500` text
- Teal Accept button + navyPale Negotiate + redPale Decline
- `StatusBadge` (legacy) in header + deliverable rows + negotiation status card
- Uses `colors.*` throughout

## After

**OfferListScreen restyled**:
- Ink topbar with 30×3 yellow rule + "Offers" title (Outfit-Bold 22 white) + dynamic sub line.
- 5 tab pills: ink-active (yellow text + mono-bold) / bg2 inactive (muted text + mono-bold) per locked design call #2.
- 5 MCI empty-state icons (inbox-outline / check-circle-outline / cancel / timer-sand / format-list-bulleted) in canonical EmptyState dashed-yellow tile pattern per locked design call #1.
- Per-card status pill: canonical `<StatusPill status={...} />`.
- Per-card stats: mono digits, danger-text for sub-6h countdown.
- "Tap to view details ›" hint with dashed-underline (mono).
- Drops `import StatusBadge` → canonical pill.

**OfferDetailScreen restyled**:
- Ink topbar with 30×3 yellow rule + back-chevron MCI icon + brand row (yellow tile with ink initial fallback OR brand_logo_url image; ink-bg meta + campaign sub).
- Canonical `<StatusPill>` on right (drops StatusBadge).
- Countdown chip: yellow on ink with `[timer]` MCI; danger-pale on Expired.
- Fee/commission highlight: successPale + successText per locked design call #3 (was tealPale/tealDeep).
- Tranche dots: success / yellow / ink 3-stage progression per locked design call #4 (was teal/orange/navy).
- TDS note: yellowPale + yellowText (was goldPale + #7A5500).
- Action buttons: ink primary Accept (yellow text, Outfit-Black) + ghost-ink secondary Negotiate + danger-pale Decline.
- Next-step CTAs: yellow-pale bg with 1.5px ink border + chevron-right MCI.
- Brand initial fallback: yellow tile with ink 22-pt initial (was rgba-white-15 tile).
- Negotiate form: ink-bordered fee/commission inputs (mono digits) + plain bg note input + ink "SEND COUNTER OFFER" CTA.
- brandPalette tokens + fonts.* throughout.
- Drops `import StatusBadge`.
- Drops all `colors.*` references.

## What matches the mockup
- All 5 phone frames + side panel variants.
- successPale fee highlight + successText label.
- success → yellow → ink tranche progression.
- Ink topbar + yellow rule + canonical pill.
- 5 MCI empty icons.
- Dashed `[LOGO]` not needed (offer has brand context).

## What honestly diverged
- Brand initial fallback tile size: 48×48 ink in current code → mockup uses yellow-bg-ink-text 48×48. Adjusted to match mockup.
- Countdown copy: "Expires in {h}h {m}m {s}s" stays the same (no copy change).

## Preserved verbatim
- All 7 `influencerApi.*` endpoint calls + payload shapes.
- All 25+ render branches:
  - 4 contract states for Next Steps (accepted/contracted/active + visibility gating)
  - 3 deliverable fallback states (table / formats_json / single)
  - 5 offer-type sub-renders (discount/volume/bogo/bundle/free_gift)
  - 2 payment-terms variants (tranches vs commission-only)
  - 3 open-group state cards (applied/rejected/slots_filled)
  - 4 action-button variants (open-group apply / handpick accept / negotiate / decline)
  - goal-aware fee + commission + tranche conditionals
- `useCountdown` 1-second interval hook + cleanup.
- `DELIVERABLE_LABELS`, `DECLINE_REASONS`, `FORMAT_ALIAS` constants.
- `toCanonical` + `formatDate` + `formatDeclineReason` + `useCountdown` helpers.
- Fee fallback chain: `agreed_fee || influencer_budget || per_influencer_budget || set_budget || 0`.
- Defensive JSON parses for `formats_json` + `offer_config_json`.
- Tranche math (25/25/50).
- Validation rules (positive fee, 0-100 commission).
- All Alert.* confirmation flows.
- Cross-tab nested routing payloads.
