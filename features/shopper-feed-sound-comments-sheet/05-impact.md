# Impact Analysis — sound on feed videos, and comments from the bottom

## In one line
A sound button on feed videos (silent to begin with), and comments as a sheet over the post instead
of a page. Shopper app only; no server, no data, no money.

## What exists · what changes · what is built
**Exists.** Feed videos are silent with no control. Comments are a page.

**Changes.** She can turn a feed video's sound on and off where it plays. She reads and writes
comments without leaving the post.

**Built (shopper app only).**
- `components/shop/feedSound.js` (new) — the feed's one sound choice, in memory.
- `components/shop/ShopVideo.js` — `soundAt="bottom-left"`; the block passes touches to the
  button only (`box-none`, the player in a no-touch layer); the feed button shows on the playing
  video.
- `components/shop/bitsShop.js` — `FeedVideo`; `usePostActions` hands out `comments`; the card
  shows it.
- `components/shop/CommentsSheet.js` (new) — the page's contents, as a sheet.
- `components/shop/useShopNav.js` — `openComments` raises the sheet (`commentsPost`); it counts
  as `covered`.
- `screens/shop/HomeScreen.js`, `PostScreen.js`, `OfferPostsScreen.js`, `PlayScreen.js` — draw
  the sheet; Play's reel shows the live count.
- `navigation/FollowerNavigator.js` — the `Comments` screen is unregistered.
- `screens/shop/CommentsScreen.js` — deleted.
- new test `feedSoundCommentsSheet.test.js`; four test files updated (see 03).

## Affected routes / APIs
None changed. The same `comments`, `addComment`, `reportComment` calls.

## Affected workflows (regression surface)
- A tap on a feed video opens Play (V1) — `shopperWalkVideo.test.js`.
- Which video plays, the product popup hold — `videoHeldForPopup.test.js`.
- Comments: guest / signed in / report / older comments / ended post — `shop15.test.js`,
  `shopperAppFixes.test.js`.
- Sign-in and return — `shopperAppFixes.test.js` F7.

## Migration / deploy / OTA impact
- Migration: none. Server: none. Website: none.
- Shopper app: over the air (follower). Creator and brand apps: not published.
- No native change, no new app build.

## Rollback
Republish the previous shopper bundle (revert the commit first).

## Risk notes
- **The button must not eat the tap that opens the video.** Proved in jest by which nodes can take
  a touch; on a phone the native player is a real view, which is why it now sits in a layer that
  takes none. The walk should confirm: tap the video → full screen; tap the button → sound only.
- **The keypad and the sheet.** The sheet relies on the system resizing the window when the keypad
  opens (as the app's other sheets do). jest cannot show this; the walk must: tap the box, see it
  stay above the keypad.
- **A stale app on the old bundle** still navigates to `Comments` — and still has the page. No
  mixed state is possible: the page and its route leave in the same bundle.
- Nothing is saved or sent that was not before, except `sound_on` / `sound_off` from a feed.
