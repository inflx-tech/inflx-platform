# shopper-feed-sound-comments-sheet — built against the board, 13 Oct 2026

Board: `04-preview/mockups/shopper-feed-sound-comments-sheet.html` (S1, S2 · C1, C2).

## What was implemented

### 1 · Sound on a feed video
- `components/shop/feedSound.js` (new): one choice for every feed video, off when the app opens,
  kept in memory only.
- `components/shop/ShopVideo.js`: the sound button can sit bottom-left (`soundAt`). In a feed the
  block passes touches to its children only and the player lies in a layer that takes none — the
  button is the one thing a finger can land on. It shows on the video that is playing.
- `components/shop/bitsShop.js`: `FeedVideo` — the card's video, muted from that choice.

### 2 · Comments as a sheet
- `components/shop/CommentsSheet.js` (new): everything the page did (read, write up to 300, report,
  older comments at the end of the list, the ended-post sentence, sign-in for a guest), in a sheet
  72% of the screen high that slides up over the post.
- `components/shop/useShopNav.js`: the comment mark raises the sheet instead of opening a page.
- The four screens with a comment mark draw it: Home, an opened post, an offer's posts, Play.
- `screens/shop/CommentsScreen.js` and its `Comments` route: removed. Nothing led there but the
  comment mark.

## Same as drawn?
| Board | Built as | Same? |
|---|---|---|
| S1 button bottom-left, above the shop bar | absolute, left 10 / bottom 54, 36 round, dark | Yes |
| S2 one tap on, one tap off | `sound_on` / `sound_off`; the mark changes | Yes |
| C1 sheet over the post, title "Comments · 3", ✕, list, box + Send + 0/300 | as drawn, with a grip line on top | Yes |
| C2 guest: the sign-in block at the foot of the sheet | the server's own title and line, "Sign in with your number" | Yes |

## Decisions taken for the founder (each told to him)
1. **Sound stays on for the following feed videos** once turned on, until she turns it off or the
   app closes. The feed opens silent every time.
2. **Separate from the full-screen video feed's sound**, which keeps its own remembered setting and
   its button top-right.
3. **Every feed that plays a video** gets the button, not only Home.
4. **Every screen with a comment mark** gets the sheet, including the full-screen video feed.
5. **A video waits while its comments are open** — the product popup's rule.
6. **The comment number follows** what the sheet read and what she sent.
7. **A half-written comment is kept** when she closes and reopens the sheet on the same post.
8. **The comments page is removed**, not left unreachable.

## Tests that changed, and why
- `shopperWalkVideo.test.js` V1 — it said a feed video has no sound button and nothing on it takes
  a touch. Restated: exactly one thing does (the button); the player's layer takes none; the tap on
  the video still opens Play. (Business-rule drift: he asked for the button.)
- `shop15.test.js`, `shopperAppFixes.test.js` — they mounted the page. They now mount the sheet
  through a stand-in with the page's shape, assertions unchanged, except two: the page read its
  comments again on every return to it, and a sheet can only be left to sign in — so "a failed
  re-read keeps what she was reading" makes that trip, and "what she was writing is not lost"
  closes and reopens the sheet.
- `duplicateScreens.test.js` — `Comments` is asserted NOT registered.

## What diverged from the board
A grip line at the top of the sheet is not on the board. Nothing else.

## Tests
- `components/shop/__tests__/feedSoundCommentsSheet.test.js` — 17 checks (S1–S7, C1–C9).
- Mobile, whole suite: 129 suites / 3,021 tests, all passing (was 128 / 3,004).
- Backend, website: not touched — nothing run.

## Not seen
Real sound, the slide of the sheet, and the keypad under the comment box exist only on a phone.
Not looked at on a device; Maestro not run.
