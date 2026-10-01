# Workflow prediction — item 17, Wallet

**Brand:** add money → sign (lock) → payments released → sales in their window → share added at
window close → request withdrawal (on hold) → INFLX pays, marks processed → balance drops.

**Creator:** payments arrive (signing, live, final date) → commission in its window → added at
close → request withdrawal (full amount, on hold) → processed.

**Edge cases:** could not process (hold released, reason shown); a request above available, below
the minimum, or a second request (refused, each saying why); an item cancelled in its window
(shares reversed, never added); verify called twice (one credit); cancelling a signed campaign
(refused).
