# Workflow

## What she sees now

1. Asha opens **Collabs → Active**. Her Kanchi Silks Pay for Content card reads
   **"₹3,000 is in your wallet. Signed 16 Sep."** — the money the brand's signature moved.
2. Her Pay for Sale card reads **"Signed 16 Sep. You earn as you sell."** Nothing was paid at the
   signature, and that is not a zero.
3. She taps **Wallet**. Instead of "coming soon":
   - **Yours now ₹3,000** — money released to her
   - **Still to come ₹9,000** — held, with the condition on each part: *"When your post goes live
     and the brand confirms it"*, *"After your post has stayed live"*
   - **Earned so far ₹3,000**
   - a note saying this is a simple view while the full wallet is designed

## What has to stay true

- The card never prints a number the server did not send. If `firstPayment` is missing, the card
  says the payment is on its way — never that it is zero.
- A commission-only collaboration is never described as having paid zero.
- Nothing about locking, tranches or release changes. This contract reads; it does not pay.

## Order of build

1. Backend: carry `released_amount` and `influencer_fee` through the creator query — lateral join
   AND outer select — and put `firstPayment` / `hasUpfrontMoney` on the card.
2. The words, then the card's three cases.
3. The temporary wallet screen, over the earnings endpoint.
4. Tests at both ends: the payload, and the sentence.
