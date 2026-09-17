# Before / after

No mockup round: the wallet is a stand-in by instruction, and says so on itself. The "before" is a
photograph the founder sent.

## Before

| Where | Said | Was true |
|---|---|---|
| Collabs → Active, Pay for Content | **"₹0 is in your wallet. Signed 16 Sep."** | ₹3,000 was in her wallet |
| Collabs → Active, Pay for Sale | **"₹0 is in your wallet. Signed 16 Sep."** | nothing is paid at signing on a commission deal — correctly |
| Wallet tab | **"Wallet is coming soon"** | she had been paid and could not see it |

## After

| Where | Says |
|---|---|
| Pay for Content card | "₹3,000 is in your wallet. Signed 16 Sep." |
| Pay for Sale card | "Signed 16 Sep. You earn as you sell." |
| Signed but not paid | "Signed 16 Sep. Your first payment is on its way." — never a zero |
| Wallet tab | Yours now ₹3,000 · Still to come ₹9,000 · Earned so far ₹3,000, each held tranche with the condition that releases it |

## The money was never wrong

Read from production before touching anything: `wallet_balance` 3000, `total_earned` 3000,
`contracts.released_amount` 3000, `locked_amount` 12960. 25% of ₹12,000, released at the brand's
signature, exactly as rules v1.21 §10 requires. **No payment code was changed.**

## The actual defect, and the one underneath it

The card renders `card.firstPayment`, falling back to `0`. **The server never sent it** — the field
existed nowhere in the backend. Computed is not delivered.

Fixing it surfaced the same mistake one layer down: adding the column to the query's LATERAL join
was not enough, because the creator query's **outer select** lists its contract columns explicitly.
A column in a lateral that nobody selects is a column nobody gets. The first attempt at the test
failed with `null` instead of `undefined` — which is how I knew the field was being delivered and
the value was not.

## A third case the photograph contained and I nearly missed

Her second collaboration is Pay for Sale — 17% commission, no fixed money. It rendered through the
same sentence and also read "₹0 is in your wallet". That is normal behaviour being described as a
failure. `hasUpfrontMoney` now separates them, so a commission deal says she earns as she sells and
a genuinely unpaid fee deal says the payment is coming. Three cases; none of them prints a number
the server did not send.

## Evidence

- **Backend**: 2 new tests in `item7-agreement.test.js` asserting the payload she can actually see,
  not just the wallet row. Suite **221 failed / 1091 passed** against a measured baseline of
  **222 / 1084** — diffed by test name, **0 newly broken**.
- **Creator app**: 6 new tests. Mobile suite **548 passed / 0 failed**, up from 542.
- The test that matters most asserts the exact shape that caused this: `firstPayment` absent from
  the payload must never render as "₹0 is in your wallet".

## What this is not

The finished wallet. Rules v1.21 §10 also asks that "wallet state must be visible at the points
where it gates Shoot eligibility, rather than only inside a separate wallet screen" — that is the
real design, and this is not it. This is the stand-in that stops the platform hiding money it has
already paid.
