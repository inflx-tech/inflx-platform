# Workflow prediction — "Done" on a post that is with INFLX

What a creator will see and do on the screen of `mockups/post-sent-done-button.html`.

1. She taps "Send to INFLX for review" on the Review step. "With INFLX" opens as today, with one
   addition: a yellow **Done** button pinned at the bottom, in the place and colour of the button
   she has just tapped.
2. She taps **Done**. Home is in front, with the bottom tabs. Under Waiting it lists "Your post is
   being checked · With INFLX".
3. She taps the Create tab: her posts. The post she sent is there, "With INFLX".
4. Opening that post again shows the same screen and the same button.

**What changes versus today**
| | Today | After |
|---|---|---|
| Leaving "With INFLX" after sending | the back arrow, once for every step of the post | Done, once |
| The Create tab afterwards | whatever step Back stopped on | her posts |

**Predicted questions**
- "Where does Done take me?" → Home.
- "I opened the post from my list; why is Done there too?" → the screen is the same; Back still
  returns to the list.

**Blast radius** — one screen of the creator app (`PostStatusScreen`, the in-review state). No
server, no website, no other app.
