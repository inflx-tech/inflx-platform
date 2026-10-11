# Feature Spec — "Done" on a post that is with INFLX

> Raised by the founder on 11 Oct 2026 with a screenshot of the creator app's "With INFLX" screen:
> "after this step we keep a button … something like DONE … then it go to home … now we need to
> press back button on top till we reach home … pls do this".

## Problem / goal
A creator builds a shoppable post in eight steps and sends it to INFLX. She lands on "With INFLX"
(in review). There is nothing to do on that screen and no way off it except the back arrow — which
walks her back through Review and every step she made the post with, one screen at a time, before
she reaches a page with the bottom tabs.

**Goal:** one button, "Done", on that screen. It takes her straight to Home.

## Survey — what exists today (looked at)
| # | Capability | Verdict | Evidence |
|---|---|---|---|
| 1 | The screen after sending | Works | `Packages/Mobile/src/screens/create/PostStatusScreen.js` — state `in_review`: three boxes, no button |
| 2 | How she gets there | Works | `PostReviewScreen.js` `send()` → `navigation.navigate('PostStatus', { postId, justSent: true })`: every builder step stays underneath |
| 3 | A way home from it | **Missing** | only `Header onBack → navigation.goBack()`; bottom tabs show on the five main pages only (ui-walk-fixes D3) |
| 4 | Home says what happens next | Works | item 19: Home › Waiting lists "Your post is being checked · With INFLX" |
| 5 | A pinned main button on the Create tab's screens | Works | `components/create/bitsCreate.js` `Footer` — "Next" on every step, "Send to INFLX for review" on Review |
| 6 | The word | Works | `copyCreate.js` `done: 'Done'` |

## Scope
**In scope**
- "With INFLX" (a post in review): a yellow "Done" button pinned at the bottom, where "Send to INFLX
  for review" was on the step before. It is the screen's one main button.
- Done opens the Home tab, and clears the steps from behind the screen, so the Create tab opens on
  its own main page the next time she taps it.

**Explicitly out of scope**
- The other states of this screen (sent back, approved, live, removed): they have their own
  buttons and are opened from a list, where Back is one tap.
- What the back arrow does. It still goes one screen back, as on every screen.
- The brand app, the shopper app, the server.

## Surfaces touched
- App(s): mobile (influencer) — one screen. No server, no website.
- Roles involved: creator.

## Data / contracts
- Tables / migrations: none. API: none. Money: none.

## Non-functional
- The same button whether she has just sent the post or opened it later from a list or a notice.
- Opened with nothing underneath it (a notice into a tab never opened): Done still opens Home.
