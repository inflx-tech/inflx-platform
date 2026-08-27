# Batch B — workflow prediction

Written **before** implementation.

| Step | Prediction | What I predict goes wrong first |
|---|---|---|
| W1 library pick | Straightforward — the library screen exists | — |
| W2 scope | The picker opens; the category is stored | **The likeliest real bug.** Nothing has ever written a non-store scope from the phone, so the path from this client to the server's validator is untried |
| W2 modes | Four chips, warning appears | **The wording is the risk.** "A paper bill cannot be scoped" is true but abstract. If it does not land, a brand unticks nothing and wonders why the offer never applies in the shop |
| W3 five kinds | All five build | **Free gift is new code** — the only type with no phone implementation at all |
| W4 dates bite | Refused outside the window | **The one to watch.** The rule is old and enforced; what is new is the value reaching it. A date that saves but never arrives at checkout would look like it worked |
| W5 web to phone | Both open each other's offers | **Round-tripping is where shapes diverge.** Web writes `category_node_id` as well as `category`; if the phone writes only one, an offer edited on the phone loses a field silently |

## The three most likely to be wrong

1. **That the phone and web write identical config.** Two builders for one shape — the exact
   fault this codebase has already had to clean up twice.
2. **That a date typed on a phone reaches checkout.** Four hops: screen, API, column,
   redemption. Any one dropping it looks like success.
3. **That the warning is believed.**

## What this deliberately does not predict

Whether the offers are commercially sensible. The founder's judgement, not a check's.
