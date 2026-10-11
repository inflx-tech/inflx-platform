# Impact Analysis — "Done" on a post that is with INFLX

## In one line
One button on one screen of the creator app; it switches tab and clears a navigation stack. No
server, no data, no money.

## Affected files
- mobile: `Packages/Mobile/src/screens/create/PostStatusScreen.js` (the in-review state: `Footer`
  with "Done"; a `done()` that pops the Create stack to its main page and opens `HomeTab`).
- mobile, read only: `components/create/bitsCreate.js` (`Footer`), `components/create/copyCreate.js`
  (`done: 'Done'`), `navigation/InfluencerNavigator.js` (tab and stack names).
- new test: `Packages/Mobile/src/screens/create/__tests__/postSentDone.test.js`.

## Affected routes / APIs
None.

## Affected workflows (regression surface)
- A post after sending (in review, sent back, approved, live, removed) — `create13.test.js`,
  `ownBrand20.test.js`.
- Bottom tabs only on main pages; jumps from Home and back — `tabBarRealNavigator.test.js`,
  `home19.test.js`.

## Migration / deploy / OTA impact
- Migration: none. Server: none. Website: none.
- Creator app: over the air (influencer). Brand and shopper apps: not published.
- No native change, no new app build.

## Rollback
Republish the previous creator bundle (revert the commit first).

## Risk notes
- The Home tab is locked for an account that is not approved; a creator who can send a post is
  approved, so the button cannot land on a locked tab.
- Nothing is saved or sent by the button.
