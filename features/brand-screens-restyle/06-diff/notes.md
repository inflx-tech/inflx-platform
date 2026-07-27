# Before / After — brand screen-body restyle

**Before:** three brand screens still carried the pre-redesign visual language:
- **Decorative yellow corner blobs** — big translucent circles absolutely positioned off the
  corner of the Home wallet card (130px @ .28 + 50px @ .16) and the Campaign-detail summary
  card (120px @ .22 + 50px @ .14). Pure ornament; the same pattern flagged as noise in the
  discovery analysis.
- **Text glyphs used as icons** — `!` in the Home status banner and action-required card,
  `·` in both empty states, and `⊟ ★ ∼ ₹ ▶ ⊞` on the six Campaign-detail drill-down tiles.

**After:**
- All **4 corner blobs removed** (plus their styles).
- All **10 glyphs replaced with MCI vector icons**: `alert-circle-outline` (banner + action
  card), `inbox-outline` / `bullhorn-outline` (empty states), and the six tiles →
  `view-grid-outline`, `account-multiple-outline`, `chart-line`, `currency-inr`,
  `play-circle-outline`, `cart-outline`.
- The **5 dead `*IconGlyph` styles** removed. `BrandCampaignListScreen` had neither the Icon
  nor the `ig` import — both added (a missing import would have crashed the screen at
  require time, which the smoke suites now exercise).

Semantic status colours (draft / needs-funding / active / cancelled) are untouched — only
ornament and iconography changed.

## Changed
- `BrandHomeScreen.js` · `BrandCampaignListScreen.js` · `BrandCampaignDetailScreen.js`

## Verification
- Mobile jest **106/106 green** (24 suites), including require-time smoke coverage of the
  edited screens.
- Post-edit grep: no `IconGlyph` styles and no corner-blob styles remain in the three screens
  (`actionIconGlyph` intentionally kept — the campaign-detail action queue still uses it for
  its data-driven `a.icon`).

## Known delta
- Only these three screens are covered. Wallet, Notifications, Profile, Contract and the
  campaign drill-down screens keep their current look — a later slice if wanted.
