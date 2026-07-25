# Impact — Collabs list

## One-line verdict
**Frontend-only, mobile-influencer, OTA-deployable — zero backend/DB, zero data risk.**
(Full mechanics below per the terse-impact rule.)

## What changes
- Adds `CollabsListScreen` + the shared IG-clean RN kit (new files — no behaviour
  change to existing screens).
- Edits `InfluencerNavigator.js`: swaps the Offers + Campaigns tabs for a single
  Collabs tab; keeps `OfferList` / `MyCampaigns` mounted in the Collabs stack for
  transitional deep-link resolution.
- Repoints `getNavTarget` (NotificationsScreen) + Home attention-tile routes from the
  `Offers` / `Campaigns` tab names to the `Collabs` tab. This is the only edit to
  existing runtime files and is behaviour-preserving (same destinations, new tab host).

## Blast radius
- No API calls added or changed; reuses `getOffers` + `getMyCampaigns`.
- No native modules added → **OTA bundle only, no APK rebuild** (NATIVE_RUNTIME
  unchanged).
- Old screens remain in the bundle (dead-tab-free); deletion deferred to a later
  cleanup contract after `CollabDetail` verifies live.

## Risks & mitigations
- **Dedupe correctness** — the one real risk: an overlap-window record double-listing.
  Mitigated by `mergeCollabs` deduping on `campaign_influencer_id` + unit tests.
- **Broken deep-links** after tab removal — mitigated by the compat repoint +
  keeping old components registered + a Maestro assertion.

## Release classification
**Production-impacting via OTA** (mobile runtime) → surfaced for explicit founder go
at deploy time; not silent. Build + commit are deploy-inert until the OTA publish.
