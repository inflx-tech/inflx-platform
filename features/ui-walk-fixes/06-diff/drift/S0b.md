# Drift — slice S0b (no blank strip · bottom tabs on the five main pages)

Assertions rewritten because decision D3 (bottom tabs only on the five main pages) changed what
they pinned. None was skipped, deleted or weakened; each asserts the new behaviour for the same
situation. Format: test file · test name · what it asserted · what it asserts now · frame / decision.

- `src/screens/brand/__tests__/item8Brand.test.js` · "T7 — the accept sheet says the money is agreed and a collaboration is NOT started" · after Accept, `navigate('CampaignsTab', { screen: 'BrandPool', params: { highlight } })` · the same call with `initial: false` (the Campaigns page sits under the pool, so the pool has no bottom tabs and Back reaches Campaigns) · D3, expected-outputs check 4.
- `src/screens/brand/__tests__/item8Brand.test.js` · "everything needed to decide is on one screen" · the creator's name appears exactly once (`getByText('Tanvi Suresh')`) · the name is on the page (testID `pitch-creator-name`) and in the title bar above it — two occurrences · D3 (a pushed screen has no tabs, so it carries a title bar with Back); the bar is the one item 8's board T6 draws.
- `src/screens/__tests__/wallet17.test.js` · "BW4: the three payments with their dates, what is still locked, the campaign fee apart, and the way to the collaboration" · `navigate('CampaignsTab', { screen: 'BrandSetDetail', params })` · the same call with `initial: false` · D3, check 4.
- `src/screens/__tests__/saleLiveScreens.test.js` · "S4 · Path 1 first; Path 2 shown LOCKED with the reason; create opens item 13 with this collaboration" · `navigate('CreateTab', { screen: 'PostType', params: { postId } })` · the same call with `initial: false` · D3, check 4.
- `src/screens/create/__tests__/create13.test.js` · "where a post opens, and where her post notices go" · a post notice's target is `{ name: 'CreateTab', params: { screen: 'PostStatus', params: { postId } } }` · the same target with `initial: false` inside `params` · D3, check 4.

## Behaviour that moved with it (for the walk)

- A jump from one tab into an inner screen of another tab now always lands with that tab's main
  page underneath: the inner screen has no bottom tabs, and Back goes to that tab's main page.
  Before, when the target tab had not been opened in the session, the inner screen was the tab's
  only screen (bottom tabs showing, main page unreachable until restart). Eight call sites:
  group › New campaign · accept a pitch › the pool (two screens) · pool › a creator's profile ·
  set › a creator's profile · Wallet › locked › the set · Sale live › the post · a post notice.
- The pending account's Home: "How collaborations work" opens in the Profile tab with Profile
  underneath (no tabs, Back reaches Profile). "Brands on INFLX" is unchanged — it opens inside the
  locked Collabs tab, whose main page must not be built, and keeps the bottom tabs.
- Five pitch screens that had no title bar gained the shared one with Back, in every state: the
  creator's pitch form, her pitches list when opened as its own screen, one of her pitches, the
  brand's pitches list when opened as its own screen, one pitch as the brand reads it.
