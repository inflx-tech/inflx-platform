# creator-terms-v2 — workflow

Every step names who acts, what the server does, and what they see. D = the set's posting date.

## W1 · Brand sets what a creator can sell (T1 → T6)
1. Brand app → a set → Invite → picks creators → **Terms**. A Pay for Sale / Hybrid card shows
   "You can sell" with two rows: **Offers** and **Products without offers**.
2. **Offers** opens T2. Server (`GET /campaigns/:id/sets/:sid/offer-choices`): the brand's published
   offers running on D (or starting D+1), each with deal, products, dates and "Ends soon" when it ends
   within 7 days of D; plus those left out ("Starts 30 Oct", "Ended 5 Oct"). None → T6: "No offer runs
   on the posting date", a link to build one on the website; products can still be given.
3. **Products without offers** opens T3: None · All (n) · Choose. Choose opens T4
   (`GET …/products-without-offers`): categories, search, price range; ticks.
4. The summary line reads e.g. "2 offers + 12 products". "Use these terms for everyone" copies both.
5. Nothing picked → "Give Priya at least one offer or one product without an offer." (no network).

## W2 · Review and send (T7)
1. Review shows each creator's row "10% · 2 offers + 12 products", a Below-min chip, an **Ends soon**
   chip and banner when any offer ends soon.
2. **Send** → server (strict): re-checks commission, offers (running on D, this brand's), products
   (this brand's, not held by an offer on/after D); resolves "all" to today's list; writes the row
   (`sell_v2`, `sell_mode`, `sell_product_ids`), links the offers. No follower code.
   Refused → the reason in words; nothing is written for that creator.

## W3 · The creator reads it (C1 → C3)
1. Invitation (C1): one row "You can sell · 2 offers + 12 products ›".
2. What you can sell (C2, `GET /influencers/me/invitations/:ciId/sell`): each offer's name, deal,
   products, dates, thumbnails and "You earn · 10% of ₹2,099 = ₹210"; the normal-price list; the end
   rule. Read-only.
3. One offer (C3, `…/offers/:offerId`): how it works for shoppers, when it runs, what she earns,
   every product and gift.

## W4 · Negotiation and the agreement (2.6, 2.7, C4)
Counters change money only. The agreement lists her offers (name, deal, dates), the number of
products at normal price, and "When an offer ends, your posts using it leave the shop."

## W5 · The brand ends an offer (Q1)
1. Website → the offer → **End offer now**. The dialog adds "It's in N unsigned invitations. It drops
   out of them and the creators are told. An invitation left with nothing to sell is withdrawn."
2. Confirm → the offer ends (Level 1) and, for each unsigned invitation holding it: link dropped,
   creator told; left with nothing → withdrawn / closed and she's told. Signed collaborations: told
   the offer has ended (Level 1). Toast: "… Taken out of N unsigned invitations; M withdrawn …".

## W6 · A product changes (2.8)
Brand edits a product (website or phone): off sale / out of stock / new price → each creator who can
sell it is told; the notice opens What you can sell.

## W7 · The creator's notices (C5)
Collabs → 🔔 → Notifications. Tapping one opens What you can sell or the invitation.
