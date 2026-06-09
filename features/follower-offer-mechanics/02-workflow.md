# follower-offer-mechanics — workflow

## Actor
Follower browsing the app; brand authors the offer (campaign / Offer Zone).

## Golden path (per offer type)
1. Follower opens a product that has an offer attached (offer reaches the screen
   via the section feed → `brandOffers.adapter.toFeedItem`, now carrying `config`).
2. `ProductDetailScreen` renders `<OfferBlock offer={offer} />` under the price:
   - **discount** → "X% / ₹X off" banner ("works in-store and online").
   - **volume** → tier ladder (each `{min_spend, pct_off}`), "applied at checkout".
   - **bogo** → buy → get(₹0) pair, "we'll add the free one".
   - **bundle** → product list + bundle price + savings.
   - **free_gift** → main + gift(₹0) pair.
3. Follower taps a CTA (**Order online** or **Pay at store** — both derived from
   `offer.availing_modes`).
4. `dispatchCta` calls `composeCart(offer, baseItem)`: BOGO adds the free get
   (qty-matched), bundle adds all set products, free_gift adds the gift,
   discount/volume pass the single item.
5. The composed `items` flow into the existing checkout (`OnlineOrder` →
   `POST /follower/orders`, or pay-at-store), which calls
   `offer.service.resolveOfferDiscount` server-side → authoritative discount,
   net, commission, fee. Order persists with `items_json` + `offer_type` +
   `adjustments`.

## Expected end state
- Each offer type renders its correct block (verified visually on device).
- The server charges the engine-computed discounted total (already true).
- Discount + Volume testable on live prod data today; BOGO/Bundle/Free-gift
  render + compose correctly once such an offer is authored.

## Rule
Discount & Volume apply to any bill (incl. free-form walk-in). BOGO/Bundle/Gift
need the items picked in-app (deal shown at the counter for pay-at-store); they
cannot apply to a pure free-form bill total.
