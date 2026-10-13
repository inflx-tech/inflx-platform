# Expected Outputs — a video stops while its products are open

All verified by jest with a stand-in for the native player that keeps the props it was given
(`components/shop/__tests__/videoHeldForPopup.test.js`).

| # | Observable output | Where |
|---|---|---|
| H1 | Play: products open → the player is paused; closed with ✕ → it plays. For a deal she builds, a discount, and no offer | Play |
| H2 | Closed by a tap above the products → it plays | Play |
| H3 | Sound on before, on after; her saved choice unchanged; no `sound_off` recorded | Play |
| H4 | Paused by her own tap, products opened and closed → still paused; her tap starts it; one `pause` recorded, not two | Play |
| H5 | Two videos: the one she was on stops and resumes; the other never plays | Play |
| H6 | Guest taps ♥ → the sign-in prompt → the player is paused | Play |
| H7 | Home and an opened post's feed: the card's video stops for the products and resumes; all four screens that play a video hand the rule their "covered" | feeds |
| H8 | `useShopNav.covered` follows the two sheets; `useAutoplay` held → nothing plays, the video on screen is still known, the list's rules are not remade | pieces |
| H9 | The player: `held` pauses it; `watch` is sent once with the seconds up to the stop; time held is not counted; not held → exactly as before | pieces |

13 of these 15 checks fail on the code that was live (the two that pass describe behaviour that
does not change).

## Regression gates
- `Packages/Mobile`: the whole jest suite, all passing (was 127 suites / 2,989 tests).
- The existing video suites unchanged and passing: `shopperWalkVideo.test.js`, `video16.test.js`.
- No backend, no website: nothing to run there.

## Visual evidence required
- The founder's walk on his phone — the only place the real player and real sound exist.
