# Impact

**Frontend-only, mobile (brand) — OTA. Presentation only.**

Touches BrandHomeScreen, BrandCampaignListScreen and BrandCampaignDetailScreen: blob removal,
glyph -> MCI icon swaps, dead-style cleanup, missing imports added.

Risk: low — no data, navigation or logic change; a missing import would fail at require time,
which the smoke suites exercise.

Release: production-impacting via OTA -> founder go.
