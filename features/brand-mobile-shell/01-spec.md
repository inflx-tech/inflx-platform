# Feature Spec — Brand mobile IG-clean shell (tab bar)

> Step 2. Brings the brand mobile shell onto the same Instagram-clean system as
> the influencer app, starting with the tab bar.

## Problem / goal
The brand tab bar used **emoji rendered as static `<Text>`** (🏠📣💰🔔👤) that ignored
active/inactive state entirely, with an **orange active tint** matching nothing else in the
product. The influencer app is now fully IG-clean (white bar, black active, grey inactive,
MCI vector icons). Bring brand mobile onto the same shell.

## Scope
**In scope**
- `BrandNavigator` tab bar → IG-clean: white surface, hairline top border, **black active /
  grey inactive**, and **MCI vector icons** that respond to state (home / bullhorn / wallet /
  bell / account). Removes the now-unused `Text` + `colors` imports.

**Explicitly out of scope (later)**
- Restyling the brand screen bodies (headers, cards) to the IG kit — larger, screen-by-screen.
- Folding ActionRequired into a router: **decided against for now** — it is a legitimate
  cross-campaign inbox (same call made on web A3, where the signature strip was kept);
  refactoring it would risk working bulk-sign for modest gain.

## Surfaces touched
- App: **mobile (brand) only** — OTA. No web, no backend.

## Data / contracts
- None. Presentation only.

## Design reference
Matches the shipped influencer tab bar (`InfluencerNavigator`), IG-clean tokens in `theme/ig`.
