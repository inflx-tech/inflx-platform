# 06 · Diff notes — Flow 7 (brand-web campaign creation wizard)

## Verdict

Visual + UX restructure only. Same 11 API endpoints, same field shapes on
every request body, same validation rules, same draft-resume path
(`?id=<draft>`), same publish escrow lock flow. Pure restyle from dark
wave1 palette + tabbed Step 2 → locked wave2 palette + 3-column shell +
multi-step Step 2 (5 sub-steps).

## Files touched

| File | Type | LOC (new) | LOC (old) |
|---|---|---:|---:|
| `Packages/brand-web/app/dashboard/campaigns/new/page.js` | rewrite | 2253 | 2570 |

Slight net reduction (~317 LOC) because removed CSS bloat from the dark
wave1 theme + consolidated repeated patterns. All logic preserved
verbatim; only chrome + JSX restructured.

## What changed (UI/UX)

### Chrome
- **Dark navy/orange wave1 palette → locked wave2 palette**: white surfaces, ink topbar, yellow accents
- **Single-column page → 3-column shell** (260px left rail + center + 340px right rail)
- **Ink topbar** with dashed `[LOGO]` placeholder + 3 main step pills (Campaign · Build sets · Review) + Exit
- **Outfit** display + **Plus Jakarta** body + **JetBrains Mono** on every ₹, date, count, handle

### Step 1 (basics)
- White card layout, 4 inputs in 2 cards (Name & dates · Budget & negotiation)
- Live remaining-budget strip when total_budget > 0
- Right rail = wallet status + onboarding tips

### Step 2 (the big one — multi-step inside Step 2)
- **Tabbed sets → vertical accordion sets in left rail**: each set is a compact card showing name + goal pill + "X of 5" progress
- Step 2 is now **5 progressive sub-steps**:
  1. **Pick a goal** — 3 hero goal cards (conversion / engagement / hybrid) with pros + best-for + fields-you'll-configure
  2. **Set basics** — name + window + (conditional) coupon prefix + (conditional) set budget + formats + brief + assets dropzone
  3. **Who posts?** — fork card (Handpick vs Open group) with explicit pros for each
  4. **Pick influencers** — branches: handpick browse grid with filters / open-group params with live match-count panel
  5. **Set their terms** — handpick split list+editor with "Apply to all" / open-group shared terms form
- Left rail: 5 substep dots (done ✓ / active yellow / pending grey) + clickable navigation
- Right rail: live budget strip + **"What X will see"** preview card (mirrors the offer as you build it) + per-set checklist
- Set cards in left rail show "✓ Complete" or "N of 5" status — switching sets jumps you to that set's first incomplete substep

### Step 3 (review & publish)
- Yellow-pale hero card with campaign name + budget strip
- Per-influencer allocation breakdown card
- One review card per set with grouped key/value rows
- Ink wallet & escrow card on right rail with "Sufficient" pill
- Publish button (disabled when budget over)

## NO-TOUCH preserved

- `campaignApi.{create, update, get, createSet, updateSet, inviteInfluencer, updateInfluencer, publish, searchInfluencers, getOpenGroupMatches}` (10 methods, every signature identical)
- `brandApi.{getMe, getProducts}`
- `influencerApi.search` (browse panel + group search)
- `creatorInvitationApi.create` (scraped-creator invite path)
- All per-set + per-influencer field shapes (every property name + type)
- All 5 offer-type sub-shapes (Discount · Volume · BOGO · Bundle · Free gift)
- Open-group `group_params` JSON shape (tiers / niches / cities / min_er / gender / max_cap / per_influencer_budget / commission_pct)
- localStorage `inflx_influencer_groups` key + JSON shape
- Validation rules: every field error + step-error counts + per-influencer error keys + warnings (commission > 25%)
- Draft resume via `?id=X` URL — hydration jumps user to Step 2 terms
- Brand-approval gate from layout.js
- Touched-fields tracking (`touched`/`forceShowErrors`/`markTouched`/`showErr`)
- Budget helpers (`totalSetBudget`, `campRem`, `setInfSpent`, `setRem`, `isBudgetOver`)
- All set CRUD handlers (addSet, deleteSet, duplicateSet)
- Browse search debounce + scraped-creator routing + "Add N · Invite M" mixed footer
- Product modal (search + category filter + multi/single mode + confirm wiring for all offer types incl. BOGO buy/get + gift_offers pairs)
- Group modal (search + select + save to localStorage)
- GalleryPicker integration (asset hydration + dedup by file_r2_key)
- Publish path (saveSets → campaignApi.publish → redirect to /dashboard/campaigns)
- offerSummary helper (used in review)
- Duplicate-set toast

## QA gate

```
pnpm qa  (2026-05-24T02:57:41Z)
67/67 passed · 1.3m
STATE=GREEN · gate 0
Report: qa/reports/2026-05-24T02-57-41-710Z/QA-REPORT.md
```

First run clean — no environmental flake. No spec re-baseline (no spec
asserts on /campaigns/new layout/copy).

## Governance gates

- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) — fires at close-out
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md present) ✓ (this file)
- Rule 5 (Maestro) does NOT fire — no `Packages/Mobile/src/**` touched

## Deploy classification

PRODUCTION-IMPACTING (web only). `git push origin main` → Vercel
auto-deploys brand-web. No mobile, no OTA, no backend rebuild.
