# post-sent-done-button — built against the board, 11 Oct 2026

Board: `04-preview/mockups/post-sent-done-button.html` (one screen, today and after).

## What was implemented
`Packages/Mobile/src/screens/create/PostStatusScreen.js`: a post in review ("With INFLX") shows the
Create tab's own pinned bottom button (`Footer`, the one every step uses) reading "Done". It clears
the Create tab's stack back to its main page and opens the Home tab.

## Same as drawn?
| Board | Built as | Same? |
|---|---|---|
| "With INFLX", after | `Footer label="Done"` under the scroll, state `in_review` only | Yes — same place, same yellow, as "Send to INFLX for review" on the step before. The three boxes and the last line are untouched. |

## Decisions taken for the founder (each told to him)
1. **The button shows on every post that is with INFLX**, not only straight after sending — the
   screen is the same screen, and a button that is sometimes there is harder to trust.
2. **"Home" is the Home tab** (item 19). The post she sent is listed there under Waiting.
3. **The steps are cleared from behind the screen**, so the Create tab opens on her posts next time.
4. **The back arrow is unchanged.** After sending, it still goes back to Review and the steps.
   (Said to him as an option: make Back skip the steps too.)

## What diverged from the board
None.

## Tests
- `src/screens/create/__tests__/postSentDone.test.js`, 8 checks on the REAL navigators (bottom tabs
  over a native stack, the creator app's own tab and screen names): after sending → Done → Home tab,
  Create stack back to `['CreateHome']`; opened from her posts → the same button, Back one screen;
  opened from Home → Done back to Home; opened with nothing under it → Home, and no unhandled
  navigation action; sent back / approved / live / removed → no Done.
- The whole phone suite: 123 suites / 2,922 tests, all passing (was 122 / 2,914).

## Not seen
Not looked at on a phone. The founder's walk: send a post (or open one that is with INFLX) → Done →
Home; then tap Create.
