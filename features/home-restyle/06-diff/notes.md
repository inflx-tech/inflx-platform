# Before / After — Home restyle

**Before:** ink header with a `[LOGO]` placeholder + yellow accent rule; a greeting; **3
attention tiles** (Pending offers → Collabs, Contracts to sign → Profile>MyContracts,
Content revisions → Collabs) pointing at three different places; active-campaign list →
CampaignDetail; recent activity; ink wallet card. Old brandPalette (ink/yellow, mono
fonts).

**After:** IG-clean. White header (greeting + bell, no ink block / no `[LOGO]`); **one
"Your turn (N)" tile** → Collabs, where N = merged collabs with `turn === 'you'` (same
count the Collabs list shows); N=0 → calm grey "all caught up". Restyled **Active collabs**
glance (top 3) → CollabDetail via the Collabs tab; **Recent activity** → Notifications;
**Wallet** strip → Earnings. All hairline rows, yellow only on the your-turn signal.

## Mockup → build fidelity
Mockup: `04-preview/mockups/home-restyle.html` (new column).
- White header + single Your-turn tile (yellow when N>0, calm when 0) — **matches**.
- Active glance rows (brand initials + name + stage pill) — **matches**.
- Recent activity + wallet strip IG-clean — **matches**.

## Logic
- Count + active glance reuse the tested `utils/collabStages` (`mergeCollabs`/`whoseTurn`/
  `deriveStage`) and `CollabRow.badgeFor` — no new logic.
- Data load: `getEarnings` + `getOffers(null)` + `getMyCampaigns('all')` + `getNotifications`
  (dropped the separate `getMyCampaigns('active')`).

## Known mockup-vs-build deltas (expected, not defects)
- Header shows greeting only (no @handle — Home doesn't fetch the profile; avoids an extra
  call). The tile carries the count/summary.
- Recent-activity icons use the app's MCI notification mapping, not the exact mockup glyphs.

## Verification status
- Module-load smoke: `__tests__/homeRestyle.smoke.test.js` — green (parses + imports
  resolve).
- Count/active logic covered by existing `collabStages` tests.
- Full mobile jest: **70/70 green.**
- **Pending (device gate):** Maestro — Home renders → tap Your-turn tile → Collabs opens.
