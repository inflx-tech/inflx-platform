# Flow 12 · expected outputs — what the user sees per state

These outputs map 1:1 to the 5 states in
`04-preview/mockups/web.html`. Implementation matches.

---

## State 1 · LIST default (`/dashboard/influencers`)

- Count chip `{N} SEARCHABLE` (mono) — from `meta.total`
- Outfit H1 "Find Creators" + yellow rule + sub-line
- Top-right ghost button: `📊 Market Analytics` → navigates to analytics route
- INK hero with 3 cells:
  - `{total}` · TOTAL SEARCHABLE · "across cities + niches"
  - `{verified count}` (yellow) · VERIFIED BY INFLX · "{pct}% of pool · {scraped count} scraped"
  - `{median rate}` · MEDIAN MIN RATE · "per post · across all tiers"
- Search bar: text input · sort dropdown · ink `Search` button
- Primary filter row: City · Niche · Tier (select) · Min ER % · `More filters ▾` (or `▴` open) · `Clear ({n}) ✕` (when any filter active)
- Advanced filters drawer (collapsed by default): 7 inputs + 3 check labels
- Tier chip row: `All` + 6 tier chips with mono counts, palette-coded dot
- Row cards (~64px tall):
  - 40px avatar (initials yellow-pale, or `<img>` when profile_pic_url present)
  - Name · @handle · ✓verify · tier-pill · ⭐ rank-mini · [scraped tag] · [stale tag if 7d+]
  - Meta: `📍 City · 🎨 niche · N brand collabs`
  - Mono trio (Followers · View ER · Avg Views) — ER colored green/blue/gray
  - Mono rate range + "Est. rate" tiny caption
  - Single action: `+ Add` (verified) or `✉ Invite` (unclaimed)
- Pagination: not rendered today (limit=50, single page)

## State 2 · LIST · advanced filters open

- Same as State 1 with `More filters ▴` (caret rotated, drawer visible)
- Drawer shows: Language input · Use case select · Min/Max followers · Min/Max rate · Worked-with-brand input
- Below the row of inputs: 3 checkbox toggles (Has worked with brands · Verified by Inflx only · Instagram business account only)
- `Clear (N) ✕` appears in primary row when N filters active

## State 3 · PROFILE (`/dashboard/influencers/[id]`)

- Breadcrumb `/dashboard / influencers / @handle`
- INK hero card:
  - 96px avatar (initials in yellow square, or `<img>` if `profile_image_url`)
  - Outfit H1 `{full_name}` (white)
  - Yellow `@handle` + 📸 platform + 📍 city·state + 🎂 age · ⚤ gender + italic scrape-date tag (only if `source==='scraped'`)
  - Bio paragraph
  - Niche + language tags (translucent-white chips on ink bg)
  - Right-side CTA stack: yellow `+ Invite to Campaign` + ghost `View on Instagram ↗` (only if `website` present)
- 4 stat tiles (mono): Followers / Engagement Rate (green if ≥8% / blue if ≥4% / gray else) / Avg Views / Total Posts — sub-labels = tier range / "🔥 Excellent" or "✅ Good" / "per post · last 90d" / "lifetime"
- 2-col grid:
  - **Left col 3 cards**:
    - 📊 Avg Engagement per Post (4 bars: Likes ink / Comments info / Shares green / Saves conv) — only rendered if `s.value > 0`
    - 💰 Pricing (per post): big mono rate · "Indicative rate" · tier-avg bar (60% fill placeholder)
    - 🎬 Collaboration Types: chip cloud from `collaboration_types_json`
  - **Right col 3 cards**:
    - 🏆 Past Brand Collaborations · `unique_brands_count` chip in header · grid of 3-col brand cards (initials in ink+yellow), `+N more` if >9
    - 👥 Audience Insights: k/v list (Platform · Primary Location · Languages · Gender · Content Niches · Use cases)
    - 📈 Activity Signal (NEW · only for scraped/onboarded with the fields present): 2 rows of 3 mono cells (posts/wk · 90d posts · commercial% / rank · growth · active-status indicator) + "Data last refreshed {Nd ago}" note
- Sticky bottom CTA bar: "Ready to collaborate? {name} will see your invite..." + `Save for later` ghost + `+ Invite to Campaign` ink
- Invite modal (placeholder): preserved from OLD

## State 4 · ANALYTICS · top (`/dashboard/influencers/analytics`)

- Breadcrumb `/dashboard / influencers / analytics`
- Count chip `{ov.total} CREATORS`
- Outfit H1 "Creator Market Analytics" + sub-line
- Top-right ghost button: `← Back to search`
- Scope filter strip: SCOPE label · City input · Niche input · Tier select · ink `Apply` · `Clear all` link (when scope active)
- 4 stat tiles (mono): Total Creators / Avg Engagement (yellow-text) / Distinct Cities / Rate Range (green-text)
- 2-col donuts: Tier distribution (6 palette segments + legend) + Verification (yellow vs muted)
- 2-col bar lists: Top cities (ink bars) + Top niches (yellow bars), each with `📍 15 max` / `🎨 15 max` indicator chip

## State 5 · ANALYTICS · bottom

- 2-col bar lists: ER bucket distribution (yellow→green graded) + Languages (info-blue bars)
- Rate-by-tier table: mono numbers + tier dots (palette-coded)
- 2-col leaderboards: Top by rank (yellow metric) + Top by growth (green metric)
- 2-col leaderboards: Best cost-efficiency (info metric) + Cheapest (green metric)
- Trending brands: yellow bar list with `{N} creators` labels

## Empty states

- List: yellow-pale gradient empty card with 🔍 icon, "No creators found", "Clear all filters" CTA
- Profile: never empty (always renders an influencer or 404)
- Analytics: empty case = `data === null` → "Could not load analytics. Try refreshing." (preserved)

---

## Cross-state invariants

- Locked palette is the only color source on all 3 routes
- All numbers / handles / dates / IDs in JetBrains Mono
- All hover states re-assert color; all disabled states lock bg + color
- All 3 pages use `.inf` wrapper class for CSS scoping
- The OLD 6-color tier rainbow is gone everywhere; tier color = palette mapping
- Click anywhere on a list row = open profile (matches OLD); only buttons inside the row stop propagation
- API call shapes preserved verbatim
