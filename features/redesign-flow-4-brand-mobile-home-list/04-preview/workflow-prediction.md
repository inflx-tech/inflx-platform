# Workflow prediction — Redesign Flow 4 · Brand mobile

`mockups/mobile.html` shows the visual target. Both phone frames must
match (within RN font-loading differences) once implemented.

| Mockup section | Real source | Implementation note |
|---|---|---|
| Phone 1 app header | `BrandHomeScreen.js` header | bg: navy-deep → ink; Logo placeholder via `<Logo tone="light" />` |
| Phone 1 wallet card | `BrandHomeScreen.js` walletCard | navy gradient → yellow-pale soft gradient + corner accent + ink button |
| Phone 1 status banner | `BrandHomeScreen.js` statusBanner | amber/red → yellow-pale / danger-pale |
| Phone 1 action card | `BrandHomeScreen.js` actionRequiredCard | yellow left-stripe + yellow-pale icon circle |
| Phone 1 wallet alert | `BrandHomeScreen.js` alert | orange tint → yellow-pale tint |
| Phone 1 quick grid | `BrandHomeScreen.js` quickGrid | 7 tiles → 6 (drop "View My Store"); yellow icon circles |
| Phone 1 campaigns top-5 | `BrandHomeScreen.js` campaignCard | compact, locked palette badges |
| Phone 2 header | `BrandCampaignListScreen.js` header | navy-deep → ink |
| Phone 2 search | `BrandCampaignListScreen.js` searchRow | yellow focus halo |
| Phone 2 filter chips | `BrandCampaignListScreen.js` chipRow | navy-active → ink-active with mono counts |
| Phone 2 sort chips | `BrandCampaignListScreen.js` sortChips | secondary chip style |
| Phone 2 bulk bar | `BrandCampaignListScreen.js` bulkBar | white+navy-border → ink chrome + yellow Cancel + red Delete |
| Phone 2 list cards | `BrandCampaignListScreen.js` card | drop influencer-count row; clean meta line |
