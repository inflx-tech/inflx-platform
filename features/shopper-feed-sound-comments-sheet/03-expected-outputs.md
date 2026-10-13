# Expected Outputs — sound on feed videos, and comments from the bottom

Verified by jest with a stand-in for the native player
(`components/shop/__tests__/feedSoundCommentsSheet.test.js`).

## S · Sound
| # | Observable output |
|---|---|
| S1 | A playing feed video is muted; a button sits at left 10 / bottom 54 of the video (above the shop bar), labelled "Sound off" |
| S2 | Tap → unmuted, "Sound on", `sound_on` recorded for `home`; tap → muted, `sound_off`; neither opens the video |
| S3 | A tap elsewhere on the video opens it full screen (Play), as before |
| S4 | Sound on, swipe to the next video → it plays unmuted; only the playing video shows the button |
| S5 | Nothing is saved to the phone; Play keeps its own setting; a fresh app start is silent |
| S6 | An opened post's feed has the same button and shares the one choice |
| S7 | No player (older build) or a photo post: no button. Play's button is still top-right and Play still takes taps |

## C · Comments
| # | Observable output |
|---|---|
| C1 | Home: the comment mark opens the sheet; no navigation; the post is still mounted under it |
| C2 | A transparent Modal that slides up; the sheet is 72% of the screen high, at most all the room left; rounded top |
| C3 | ✕, a tap above the sheet, and the phone's Back each call close |
| C4 | A playing video is paused while the sheet is open and plays when it closes |
| C5 | Play: the same sheet, no navigation, the video waits |
| C6 | Signed in: send posts the comment; the title and the card's number follow (3 → 5 read → 6 after sending); the box empties |
| C7 | Guest: the sign-in button goes to sign in with reason `comment`; the sheet is not up over that page; on return it is back with the box to write |
| C8 | An ended post says the server's sentence with nothing to retry; a failed read has Try again, which works |
| C9 | No `CommentsScreen` file, no `Comments` route, no `navigate('Comments')` anywhere; all four screens draw the sheet; `openComments` navigates nowhere and counts as covered |

## Regression gates
- `Packages/Mobile`: the whole jest suite, all passing (was 128 suites / 3,004 tests).
- The page's own checks (`shop15.test.js` F6, `shopperAppFixes.test.js` F7 / N1 / N5) run on the
  sheet through a stand-in with the page's old shape. Two of them changed with the pathway:
  the page re-read on every return to it; the sheet can only be left to sign in.
- `shopperWalkVideo.test.js` V1 restated: a feed video has one thing that takes a tap — the button.
- `duplicateScreens.test.js`: `Comments` is no longer a registered screen.
- No backend, no website: nothing to run there.

## Visual evidence required
- The founder's walk on his phone: real sound, the sheet's slide, and the keypad under the box.
