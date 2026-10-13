# Workflow prediction — a video stops while its products are open

What a shopper will see on the board `mockups/shopper-video-pauses-for-popup.html`.

1. A video is playing in the ▶ feed. She taps the button under it. The products slide up and the
   video behind them freezes; its sound stops.
2. She browses, adds something, or changes her mind.
3. She closes the products. The video carries on from the frame it stopped on, with the sound as
   she had it.

**What changes versus today**
| | Today | After |
|---|---|---|
| Video behind the products | keeps playing, with sound | stopped, silent |
| On closing the products | (was never stopped) | carries on from the same place |
| Video behind "Sign in to continue" | keeps playing | stopped |
| A video she paused, after closing the products | stays paused | stays paused |

**Predicted questions**
- "Does it start from the beginning?" → No, from where it stopped.
- "I had muted it — does closing the products turn sound on?" → No. Her choice is not touched.
- "The video on Home has no sound anyway — does it stop too?" → Yes, the same rule.

**Blast radius** — the shopper app's four screens that play a video (video feed, Home, an opened
post, an offer's posts) and the one player they share. No server, no website, no other app.
