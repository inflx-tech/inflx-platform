# "₹0 is in your wallet" — when there was ₹3,000 in it

**Found:** founder, 2026-09-17, on Asha's Collabs screen.
**Rules:** v1.21 §9, §10 — *"On the Brand's signature the whole amount is locked and the first 25%
is released to the Creator."*

---

## 1. The money was never wrong

Read from production before changing anything:

| | |
|---|---|
| `influencers.wallet_balance` | **₹3,000.00** |
| `influencers.total_earned` | **₹3,000.00** |
| `contracts.locked_amount` | ₹12,960.00 |
| `contracts.released_amount` | **₹3,000.00** |

25% of ₹12,000 is ₹3,000. The platform did exactly what v1.21 §10 says, at the moment it says to
do it. **Nothing in the payment engine is being changed by this contract.**

## 2. What was wrong

Two things, and both are the app describing money it was never given.

**a. The number was computed and never delivered.** Her Collabs card renders
`card.firstPayment`, falling back to `0`. The server never sent `firstPayment` — the field does not
exist anywhere in the backend. So the card read `undefined`, printed zero, and told a creator with
₹3,000 in her wallet that she had nothing.

> The card was right to ask. The payload was wrong to be silent. **Computed is not delivered.**

**b. She had nowhere to look.** The creator app's Wallet tab is `ComingSoonScreen`. Even knowing the
money existed, there was no screen in the app that would show it.

**c. And a third, found while fixing:** a commission-only collaboration pays nothing at the
signature — correctly, there is no fixed money to take 25% of. But it rendered through the same
sentence, so Pay for Sale also read *"₹0 is in your wallet"*, describing normal behaviour as a
failure.

## 3. What changes

**Backend** — `invitationRows.service.js`, the creator card:

- `firstPayment` — `contracts.released_amount`, the money the signature actually moved. Not a
  recalculation of it; the number the payment wrote.
- `hasUpfrontMoney` — whether there is fixed money at all, so a commission deal and a broken
  payment are never described the same way.

Both required adding `con.released_amount` and `con.influencer_fee` to the creator query's outer
select as well as its lateral join — a column in a lateral that nobody selects is a column nobody
gets, which is the same class of mistake one layer down.

**Creator app**

- The card, three cases, none of which invents a number:
  · paid → *"₹3,000 is in your wallet. Signed 16 Sep."*
  · commission-only → *"Signed 16 Sep. You earn as you sell."*
  · signed but unpaid → *"Signed 16 Sep. Your first payment is on its way."*
- A **temporary Wallet screen** replacing "coming soon": what is hers now, what is still held and
  on what condition, what she has earned, and commission on the way. Read-only, over the earnings
  endpoint that already exists.

## 4. The wallet screen is deliberately a stand-in

The founder asked for *"a small frontend that simply shows creator wallet with funds… later we
design it clearly whenever the item came"*. So it does the least it can and **says so on the
screen**: no withdrawals, no filters, no history beyond what is owed and why. Payment and tax
details stay in Profile.

It is worth noting what v1.21 §10 asks for beyond this: *"Wallet state must be visible at the
points where it gates Shoot eligibility, rather than only inside a separate wallet screen."* That
is the real design, and it is not this. This is the stand-in that stops the platform hiding money
it has already paid.

## 5. Every number traces to a field that exists

| On screen | Field | Endpoint |
|---|---|---|
| Yours now | `wallet_balance` | GET /influencers/me/earnings |
| Still to come | `pending_amount` | same |
| Earned so far | `total_earned` | same |
| Held for you, per tranche | `locked_entries[].amount · tranche · campaign_name` | same |
| Commission on the way | `commission_summary.pending` | same |
| The card's amount | `firstPayment` ← `contracts.released_amount` | GET /influencers/me/invitations?tab=active |

## 6. Classification

**Production-impacting.** Backend (a payload, no behaviour) + creator app. One push, one OTA
(influencer). No migration. Nothing in the payment engine.
