# Feature Spec — sound on feed videos, and comments from the bottom

> Raised by the founder on 13 Oct 2026: "in homefeed video is not displaying any sound, it should
> by default sound is off and sound button below left where user turn on or off it if he wants,
> next one is comment when some one try to comment then a new page is opening instead opening
> popup from below to write comment..so pls fix these things as well".

## Problem / goal
1. **Sound.** A video that plays in a Home feed card is always silent and has no control. The only
   way to hear it is to open it full screen. **Goal:** silent to begin with; a sound button at the
   video's bottom-left turns it on or off.
2. **Comments.** Tapping the comment mark opens a page of its own. **Goal:** the comments come up
   from the bottom of the screen she is on, as a sheet, with the box to write in.

## Survey — what exists today (looked at)
| # | Capability | Verdict | Evidence |
|---|---|---|---|
| 1 | A feed card's video | Works, silent | `bitsShop.js` `Slides`: `<VideoView … muted />` — no `soundToggle`; comment "no pause layer, no sound button" |
| 2 | A sound button on a video | Works, Play only | `ShopVideo.js` `soundToggle` — top-right, with Play's remembered setting `inflx_video_sound` |
| 3 | A tap on a feed video opens it full screen | Works | shopper-walk-fixes V1: the video block takes no touch (`pointerEvents="none"`) so the card gets the tap. A button on the video must not break this |
| 4 | Comments | Works, as a page | `screens/shop/CommentsScreen.js`, route `Comments` (`presentation: 'modal'`); `useShopNav.openComments` navigates to it from Home, an opened post, an offer's posts and Play |
| 5 | Anything else leading to that page | None | no notice, link or other screen navigates to `Comments` (searched) |
| 6 | The comment count on a card | Stale | `post.counts.comments` from the feed's copy — not updated after she comments |
| 7 | A video stopping for a sheet | Works | shopper-video-pauses-for-popup: `useShopNav.covered` |

## Scope
**In scope**
- A sound button on a video playing in a feed card — Home, an opened post's feed, an offer's posts.
- Comments as a bottom sheet on every screen with a comment mark — those three and Play.
- The comment count on a card or reel follows what the sheet read / what she sent.
- The comments page and its route are removed.

**Explicitly out of scope**
- Play's own sound button and remembered setting. The brand and creator apps. The server.
- What a comment is: reading, writing (300 characters), reporting, sign-in to comment — unchanged.

## Surfaces touched
- App(s): mobile (follower). No server, no website.

## Data / contracts
- Tables / migrations: none. API: none new (the same three comment calls). Money: none.
- Events: `sound_on` / `sound_off` now also from a feed (surface `home`, `post`, `offers`);
  `comment` carries the surface she commented from (it was always `post`).

## Non-functional
- The feed is silent every time the app opens. The feed's sound choice is kept in memory only.
- The video itself still never takes a tap in a feed: only the button does.
- The sheet leaves the post in sight above it; with the keypad up it takes the room that is left.
