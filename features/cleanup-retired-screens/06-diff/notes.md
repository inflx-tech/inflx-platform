# Before / After — Cleanup: retire superseded screens

**Before:** 7 old influencer screens sat unreachable in the tree after Wave-1 repointed
their routes to the new IG-clean screens: OfferDetail, OfferList, MyCampaigns,
CampaignDetail, CampaignCompletion, DeliverableDetail, MyPosts — plus their
imports/registrations (incl. a lazy `require('OfferDetailScreen')`) in InfluencerNavigator.

**After:** all 7 files deleted; navigator imports + `Stack.Screen` registrations removed;
the CollabsStack comment updated to describe the post-cleanup reality. The
`Deliverable`/`DeliverableDetail` routes are kept (→ unified DeliverableScreen). The
concurrent-window `MyStore` route/screen is untouched.

## Safety (verified)
- Pre-delete grep: no kept file imports any of the 7 (only BrandNavigator matched, and only
  its *different* BrandCampaignDetailScreen).
- No live navigation targets the deleted route names (offer/contract/content notifications
  and Home/Collabs already route to CollabDetail / DeliverableScreen / CreateScreen).
- Full mobile jest **78/78 green** (18 suites) after deletion — live-screen module-load
  smokes still pass; nothing imports the deleted files.
- Navigator grep for the deleted component names → clean (only an updated comment).

## Behaviour change
- **None.** Pure dead-code removal; bundle marginally smaller.

## Not done here
- `released` on v151/v152/v153/v155 NOT flipped — awaits founder device-confirm.

## Verification status
- **Pending (device gate):** Maestro regression sweep — Collabs list→detail, Create, a
  deliverable, Tracking all still open.
