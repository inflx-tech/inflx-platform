# Impact — A6
**Frontend-only, mobile (brand) — OTA. Zero backend.**
- Adds utils/campaignStages.js, components/brand/CampaignStageRail.js,
  brandApi.publishCampaign (client method for an existing route).
- Edits BrandCampaignDetailScreen (rail + prime bar + publish handler) and one dead
  navigate() in BrandActionRequiredScreen.
Blast radius: additive on the campaign screen (existing tiles/sections untouched below the
rail); no native module → OTA only.
Risk: publish is a real state change — mitigated by explicit alerts, honest errors, reload
on success, and it is the same endpoint the web command center uses.
Release: production-impacting via OTA → surfaced for founder go.
