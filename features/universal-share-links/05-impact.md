# Impact — Universal Share Links

**Chat verdict (terse):** additive. Three small redirect routes + a mobile
share util wired into 3 screens. No DB/schema/migration; reuses the existing
`/s/` + `link_clicks` + 4-ID scheme. Production-impacting (Render + OTA).

## Surface area
- Backend: `tracking.controller.js` (+3 handlers via one factory), `app.js`
  (+3 routes). The working `/s/` path is untouched.
- Mobile: new `utils/shareUrl.js`; share wired into InfluencerStore,
  BrandStore, ProductDetail. OTA.

## Risk
- **Low.** Redirect routes mirror a proven handler; logging is best-effort and
  non-blocking; the share util no-ops on missing ids. No money/attribution
  change.
- **Known limit (flagged, not a regression):** tapping a link doesn't yet open
  the app on the exact screen — needs native intent-filters (APK round). The
  copy/share action itself works now.

## Backout
- Remove the 3 routes + the share wiring; revert. Nothing persisted beyond
  ordinary `link_clicks` rows.
