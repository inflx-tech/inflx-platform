# Feature Spec — a video stops while its products are open

> Raised by the founder on 13 Oct 2026: "in followers app, while video feed is happening if some
> one clicks on build your deal or if it is normal discount product or any non discount product
> then sound and play of the video needs to stop when product popup is comes … now when i click
> button product popup is coming with video and sound playing. so pls fix this … also when i close
> that product popup then video should be resume."

## Problem / goal
In the shopper app a video plays full screen (the ▶ feed). The button under it opens that post's
products as a sheet over the video. The video goes on playing, with its sound, behind the sheet.

**Goal:** the video stops when the products come up and carries on when they close.

## Survey — what exists today (looked at)
| # | Capability | Verdict | Evidence |
|---|---|---|---|
| 1 | Which video plays | Works | `components/shop/useAutoplay.js`: the first video on screen, only while the screen is in front (`useFocusEffect`) |
| 2 | Stopping when another PAGE covers it (bag, store, comments, product page) | Works | the same focus rule; `shopperWalkVideo.test.js` "nothing plays while another page is in front" |
| 3 | Stopping when the products SHEET covers it | **Missing** | `ShopSheet` is an RN `Modal` drawn on the video's own screen (`PlayScreen.js`, `HomeScreen.js`, `PostScreen.js`, `OfferPostsScreen.js`); the screen keeps focus, so nothing changes for the player. Reproduced: 13 of 15 new checks red on the live code |
| 4 | The same for the sign-in prompt | **Missing** | `SignInSheet`, same mechanism |
| 5 | Her own tap-to-pause in Play | Works | `ShopVideo.js` `paused`; reset whenever `active` goes false ("scrolled away") |
| 6 | Seconds watched | Works | `ShopVideo.js` sends `watch` when playing stops |

## Scope
**In scope**
- Every shopper screen that plays a video and opens the products: the video feed (Play, both as a
  tab and pushed on top), Home, an opened post's feed, an offer's posts.
- The sign-in prompt, which covers the video the same way.
- A video she paused herself stays paused when the sheet closes.

**Explicitly out of scope**
- The brand and creator apps. The server. What the products sheet shows.
- Her sound on/off choice (not touched).

## Surfaces touched
- App(s): mobile (follower). No server, no website.

## Data / contracts
- Tables / migrations: none. API: none. Money: none.
- Events: `watch` is sent when the video stops for the sheet (as for any stop). No `pause` event —
  that one means she tapped pause.

## Non-functional
- Three kinds of post behave alike: a deal she builds, a discount, no offer.
- A phone without the player (the older app build) shows a picture, not a video: nothing to stop.
