# Before / after — the negotiation door

**Screens:** the creator's negotiation screen · her notifications list · the collab
detail screen (which now hands the goal across).

## Screenshots

**Not captured, and not faked.** Reaching this screen needs a real invited collaboration
on a signed-in creator account. What replaces them is seven tests that **mount the real
screen and press the real button** — stronger evidence than a picture, and the discipline
that caught the "storys" bug and the shadowed-import bug earlier in this programme.

## What was implemented

| | Before | After |
|---|---|---|
| Tapping **Negotiate** | *"No negotiation yet — tap Negotiate on an offer to start a conversation"* — the button that brought her there | A form: what fee, what commission, an optional note |
| Which fields she is asked for | n/a | Fee, commission, or both — **matching the kind of collaboration** |
| The brand's reply notification | opened a page showing nothing | opens the conversation |
| *"Your contract is ready to sign"* | error, then *"Contract not found"* | opens the contract |
| Notification icons | every one showed a generic bell | the right icon |

## The finding behind the notification fix

The audit reported two broken taps. The real number was worse.

The server names notifications with **dots** — `contract.ready`, `negotiation.turn`,
`deliverable.approved`, `tranche.released`. The app matched **underscores** —
`contract_ready`, `negotiation_update`, `content_approved`, `tranche_released`.

Of the **19** types the app handled, exactly **one** (`campaign.ended`) was a name the
server actually sends. Verified by extracting every type from both sides and comparing:
106 server types, one overlap.

So the fix is not to patch 18 labels. **The server already tells the app which screen to
open**, in `data.screen`, written by the same code that sends the notification. The app
now routes on that. It cannot drift the way two hand-kept lists of names did.

## What was NOT changed

**The server.** Whose turn it is, the 48-hour clock, the refusal when terms were already
settled — all correct already, all untouched. This adds a door to a room that was
already built.

## What to check — the device walk

1. **As a brand:** invite a creator into a set and publish.
2. **As that creator:** open the invitation and tap **Negotiate**. You should get a form,
   not a dead end. Enter a number and send it.
3. **As the brand:** you should be notified, and be able to reply.
4. **As the creator:** tap the notification — it should open the conversation.
5. **Agree**, and check the "contract ready to sign" notification opens the contract.
6. **Sign it.**

That is the complete journey, and step 2 is the one that was impossible before today.
