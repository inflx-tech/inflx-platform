# Workflow prediction — Flow 5

`mockups/mobile.html` shows 2 phone frames: hub view + InfluencersList drill-down. SetsList and ReviewQueue follow the same pattern (header + filter chips + cards). Once implemented, every tile-tap on the hub navigates to its dedicated screen in &lt; 1 frame.

| Mockup section | Real source | Implementation note |
|---|---|---|
| Hub summary card | `BrandCampaignDetailScreen.js` (restructured) | yellow-pale gradient + corner accent + progress bar + 3 mono stats |
| Hub action queue | restructured detail screen | conditional rows, ink-stripe accents, navigate to drill-downs |
| 6 drill-down tiles | restructured detail screen | 2×3 grid, yellow-icon-circle on most, ink for money tiles |
| Brief card | restructured detail screen | collapsed by default, tap to expand |
| Influencers list drill-down | `BrandCampaignInfluencersListScreen.js` (NEW) | search + set chips + status chips + cards |
| Sets list drill-down | `BrandCampaignSetsListScreen.js` (NEW) | set cards with mini-roster + funnel |
| Review queue drill-down | `BrandCampaignReviewQueueScreen.js` (NEW) | 2 tabs · Reviews + Confirm Live |
| Navigator | `BrandNavigator.js` | register 3 new screens in both HomeStack + CampaignsStack |
