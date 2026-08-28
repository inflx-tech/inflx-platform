# The walk

## W1 · A draft resumes

1. Start a campaign, add a set, back out to the Campaigns list.
2. Tap it again.
   **You land on "Your sets" — not a 0% dashboard.**
3. A published campaign still opens its dashboard.

## W2 · A lapsed creator leaves

Hard to stage naturally at 90 days. Two ways:

* **The real one:** open a set holding a creator whose agreement has since been briefed into
  another set. She should be removed, with a message naming her.
* **The quick one:** set `agreement_expiry_days` low in `handshake_settings`, agree with someone,
  wait for it to lapse, open the set.

**What must happen:** she is gone from the list, and you are told who and why.

## W3 · Nobody is dropped who should not be

Open a set with live creators, several times. **Nobody disappears.** This is the one that
matters — the check runs against a list that arrives asynchronously, and firing early would
clear everyone.

## W4 · The backstop still works

The publish gate still refuses an already-invited creator on a dead agreement.
