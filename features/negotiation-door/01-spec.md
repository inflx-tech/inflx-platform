# The negotiation door

**Founder, 2026-09-02:** *"then we do fix those three things."*

Three defects, all on the one journey between an invitation and a signed contract.

## 1 — A creator could not start a negotiation. From anywhere.

`influencerApi.negotiateOffer` — the only call that creates a negotiation thread — has
worked for months and was **called by nothing**. A creator who tapped "Negotiate" reached
a screen that fetched a thread, found none, and said:

> *"No negotiation yet — tap Negotiate on an offer to start a conversation."*

That was the button that brought her there. A closed loop.

**So every offer on the platform was take-it-or-leave-it** — on a product whose whole
premise is brands and creators agreeing terms.

## 2 — Almost every notification tap did nothing

The audit found two broken taps. The truth was worse: the server names notifications with
dots (`contract.ready`, `negotiation.turn`, `deliverable.approved`, `tranche.released`),
and the creator app matched underscores (`contract_ready`, `negotiation_update`,
`content_approved`, `tranche_released`).

**Of the 19 types the app handled, exactly one — `campaign.ended` — was a name the server
actually sends.** Every other notification tap was dead, including *"your contract is
ready to sign"*.

## 3 — Every notification showed the same generic bell

Same root cause, in the icon map.

## The fix

The app stops matching type names. **Every notification the server sends already carries
`data.screen`** — an explicit statement of where it belongs, written by the code that
sent it. Routing on that is correct by construction and cannot drift the way two
hand-maintained lists of names did.

Type matching remains only as a fallback for rows already sitting in someone's list,
and accepts both naming conventions.

## What was NOT changed

**The server.** Every rule — whose turn it is, the 48-hour clock, the refusal when terms
were already settled — was already correct and is untouched. This contract adds a door to
a room that was already built.
