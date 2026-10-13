# Impact Analysis — a video stops while its products are open

## In one line
In the shopper app a video now waits while its post's products (or the sign-in prompt) are open
over it, and carries on when they close. App only; no server, no data, no money.

## What exists · what changes · what is built
**Exists.** A video stops when another page covers its screen. The products of a post are not a
page — they are a sheet on the same screen — so the video played on behind them, with sound.

**Changes.** The video stops for the sheet and resumes when it closes.

**Built (shopper app only).**
- `components/shop/useShopNav.js` — `covered`: one of the two sheets is open.
- `components/shop/useAutoplay.js` — takes `held`; returns `shownId` and `held` beside `playingId`.
- `components/shop/ShopVideo.js` — `held`: stops without forgetting her own tap-pause.
- `screens/shop/PlayScreen.js`, `HomeScreen.js`, `PostScreen.js`, `OfferPostsScreen.js` — hand
  `nav.covered` to the rule; Play passes `held` to the player.
- new test: `components/shop/__tests__/videoHeldForPopup.test.js`.

## Affected routes / APIs
None.

## Affected workflows (regression surface)
- Which video plays, swipe to the next, tap-to-pause, sound — `shopperWalkVideo.test.js`,
  `video16.test.js`.
- The products sheet, sizes, add to bag, auto-close — `shop15.test.js`,
  `shopperAppFixesBag.test.js`, `shopperWalkProducts.test.js`.

## Migration / deploy / OTA impact
- Migration: none. Server: none. Website: none.
- Shopper app: over the air (follower). Creator and brand apps: not published.
- No native change, no new app build.

## Rollback
Republish the previous shopper bundle (revert the commit first).

## Risk notes
- **Only a phone can show it.** The player and the sound are native; jest sees a stand-in that
  records "paused". The founder's walk is the real proof.
- Nothing is saved or sent except the existing `watch` event, now also sent when the video stops
  for the sheet (it already was for every other stop).
