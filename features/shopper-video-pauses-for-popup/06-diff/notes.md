# shopper-video-pauses-for-popup — built against the board, 13 Oct 2026

Board: `04-preview/mockups/shopper-video-pauses-for-popup.html` (one moment, today and after).

## What was implemented
The products of a post open as a sheet ON the video's own screen. That screen is still "in front",
which was the only thing the video asked about, so it played on with its sound.

- `components/shop/useShopNav.js` — `covered`: the products or the sign-in prompt are open.
- `components/shop/useAutoplay.js` — `held` in; `shownId`, `held` and `playingId` out. Held means
  nothing plays, but the rule still knows which video is on screen.
- `components/shop/ShopVideo.js` — a `held` player is paused. It is not "scrolled away": that
  forgets her own tap-pause, and a video she had paused would have started when she closed the
  products.
- `PlayScreen`, `HomeScreen`, `PostScreen`, `OfferPostsScreen` — pass `nav.covered` to the rule.

## Same as drawn?
| Board | Built as | Same? |
|---|---|---|
| After: products up, video stopped, no sound | the player's `paused` is true while `nav.covered` | Yes. The "❚❚ stopped" mark on the board is the board's own label — nothing new is drawn on the phone; the video simply freezes behind the sheet |
| Closing resumes from the same place | the same player instance is un-paused; it is never remounted | Yes |

## Decisions taken for the founder (each told to him)
1. **Everywhere a video plays in the shopper app**, not only the ▶ feed: Home, an opened post, an
   offer's posts.
2. **The sign-in prompt too** — it covers the video in the same way.
3. **A video she paused herself stays paused** when the products close.
4. **No pause mark is drawn** while the products are open (the sheet covers most of the video).
5. **Time among the products is not counted as watching**; the stop is not recorded as her pausing.

## What diverged from the board
None.

## Tests
- `components/shop/__tests__/videoHeldForPopup.test.js` — 15 checks (H1–H9). Run against the code
  that was live: 13 red (the two green ones describe behaviour that does not change). With the
  fix: 15 green.
- Mobile, whole suite: 128 suites / 3,004 tests, all passing (was 127 / 2,989).
- Backend, website: not touched — nothing run.

## Not seen
The native player and real sound exist only on a phone. Not looked at on a device; Maestro not run.
