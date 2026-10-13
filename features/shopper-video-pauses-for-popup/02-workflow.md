# Workflow Definition — a video stops while its products are open

## Actor
A shopper (signed in or a guest) in the INFLX shopper app.

## Preconditions
A video post in her feed; the app build that has the video player.

## Workflow steps (user-observable)
1. She opens the ▶ feed. A video plays, with sound if she has sound on.
2. She taps the button under it ("Shop this video · 2 items"). The products come up → the video
   stops: no movement, no sound.
3. She looks at the products, picks a size, adds to her bag — the video stays stopped throughout.
4. She closes the products (✕, a tap above them, or they close by themselves a second after an
   add) → the same video carries on from where it stopped, with the sound as she had it.
5. The same on Home, on an opened post's feed and on an offer's posts, where a video plays
   silently in its card.
6. As a guest she taps ♥ → "Sign in to continue" comes up → the video stops; closing the prompt
   carries it on.

## Success definition
Nothing plays behind the products or the sign-in prompt; closing them resumes the same video.

## Failure / edge workflows
- She had paused the video herself, then opened the products → on closing it is still paused; her
  own tap starts it.
- From the products she opens a product's own page (another page) → the video is stopped as it
  already was; back on the products it is still stopped; closing them resumes it.
- She swipes to the next video after closing → that one plays; the one she left is stopped.
