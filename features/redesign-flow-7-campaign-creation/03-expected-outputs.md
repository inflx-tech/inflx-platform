# 03 · Expected outputs — Flow 7

## Page chrome (all steps)

- Locked palette: white surfaces + #FAFAFA bg + #0A0A0A ink + #FFC107 yellow accents
- Outfit display, Plus Jakarta Sans body, JetBrains Mono on all money + dates + counts + handles
- Minimal topbar: `<Logo />` placeholder (tone="dark") + breadcrumb (/dashboard / campaigns / new) + Exit button
- 3-step progress strip: 1. Campaign · 2. Deliverable sets · 3. Review (active = yellow underline + ink digit, done = filled ink dot, future = muted)
- Right rail sticky on desktop (≥ lg) / collapsed accordion on mobile

## Step 1 — Campaign basics
- White card, generous padding
- Outfit H2 "Campaign basics" + yellow rule + muted helper line
- 4 inputs vertical stack: name · start date · end date · total_budget (mono input)
- "Allow negotiation" = card-style switch row with descriptive sub-line
- Live remaining-budget strip if total_budget > 0
- Footer: step counter (1/3) + "Build deliverable sets →" primary button

## Step 2 — Deliverable sets (vertical accordion)

### Pinned top bar
- Campaign budget strip — ₹ used / ₹ total · remaining mono · progress bar
- Set-count chip + influencer-count chip + "+ Add set" button

### Set accordion card (collapsed)
- Drag handle (visual only) + Set name + goal pill + mode chip + count chip + completion badge (✓ / "needs N fields") + chevron
- White card, subtle border, ink-text accent on completion

### Set accordion card (expanded)
4 grouped panels stacked vertically:

1. **Identity** — set name input + 3-card goal selector (radio-style cards)
2. **Schedule & money** — window date pair + (conditional) set_budget input with live remaining strip + (conditional) coupon_prefix input with pattern preview
3. **Content brief** — format chip multi-select + per-format counter rows + brief textarea + brand assets dropzone
4. **Influencers** — mode toggle (Handpick / Open group) + branch:
   - **Handpick**: saved-group chips · "+ Add influencers" button (opens drawer) · added-influencer rows below (each row: avatar + name + handle + fee/commission chip + offer-summary chip + "Configure offer" + remove)
   - **Open group**: 6-field params form (tiers chips · niches chips · cities chips · min_er · gender · max_cap · per_influencer_budget) + offer-shared button (opens drawer) + "Preview matches" CTA with mono count
- Footer: Duplicate set · Delete set

### Browse drawer (slide-in right, 480px wide)
- Search input (yellow focus halo) + filters collapsible row
- Paginated creator grid (3 cards per row), each card: avatar + name + handle + verified/invite badge + niche/tier/city/followers/ER chips + selection checkbox
- Footer: page nav + selection count + "Add N · Invite M" primary

### Offer drawer (slide-in right, 420px wide)
- Header: influencer name + handle (or "Group offer")
- Offer-type radio row (Discount · Volume · BOGO · Bundle · Free gift)
- Sub-form swaps per selection (one per type)
- Fee/commission/post-date/physical-delivery/custom-coupon shared fields below
- Footer: Cancel · Save offer

### Right rail (sticky)
- Step counter (2/3)
- Live summary: N sets · M influencers · ₹X / ₹Y allocated
- Status flags list ("Set A: window missing", "Group: no tiers selected")
- Save draft button (secondary)
- "Review →" primary (disabled until validation passes)

## Step 3 — Review & publish
- Campaign header card (name + date range + budget strip)
- Per-influencer allocation breakdown card (mono amounts)
- One review card per set: name + goal pill + mode chip + grouped key/value rows
- Wallet status card (current balance vs escrow lock needed)
- Footer: Back · Save draft · "🚀 Publish campaign" primary (disabled when budget over OR wallet short)

## QA gate

- `pnpm qa` = 67/67 PASSED · STATE=GREEN · gate 0
- No spec re-baseline (no spec asserts on campaign-new layout/copy)

## Governance gates

- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) ✓
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md) ✓
- Rule 5 (Maestro) does NOT fire (web only)

## Functional preservation

- All 11 API endpoints preserved (no shape change, no new endpoints)
- All 12 sub-sections per set preserved (visually regrouped, never dropped)
- All 5 offer-type sub-forms preserved
- All validation rules preserved (per-field err + summary line)
- Draft resume via `?editId=X` preserved
- Save draft + Publish escrow lock flow preserved
- Brand approval gate from layout preserved
