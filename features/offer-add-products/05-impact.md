# offer-add-products — impact

**Production-impacting.** Backend (Render) and brand website (Vercel). **No migration, no phone
change, no OTA.** No money moves: nothing here touches checkout, wallets or escrow. Explicit go
required before push.

## What changes for people
- **Brands (website):** a published offer no creator has yet gets an **Add products** button next to
  Remove products. Once the offer is in any invitation or collaboration, both buttons are greyed out
  and the page says why. End offer now is unchanged.
- **Brands lose:** taking single products out of an offer a creator already has. Ways out: end the
  offer, or take the product off sale (it then leaves her posts under the existing rule).
- **Creators:** never again see "N products removed from <offer>" from the brand's button, because
  that removal can't happen once they have the offer. Their posts keep every product for the offer's
  life (unless a product goes off sale or sells out — unchanged).
- **Shoppers:** nothing.

## Surfaces touched
- `backend/src/services/offerLife.service.js` — `addProducts`, `assertNotGiven`, `joinsFrom`,
  `pool_open` on the offer view; the guard on `removePreview` / `removeProducts`.
- `backend/src/services/offerPool.service.js` — `candidates` takes the first held day (`from`), so a
  published offer's picker doesn't show a product as locked by an offer that already let it go.
  Drafts are unchanged (no `from` passed).
- `backend/src/controllers/offersV2.controller.js`, `backend/src/routes/brandOffer.routes.js` —
  `POST /v1/brands/me/offers/:id/add-products`.
- `Packages/brand-web/components/offers/OfferPage.js`, new `AddProductsPanel.js`; `PoolBuilder.js`
  exports two helpers; `lib/api.js` one call.
- `Docs/OFFER_TERMS_POSTS_RULES.md` v1.14.

## Production data at deploy
Offers on production are few and test data. An offer already given to a creator simply shows the
frozen state. Nothing is rewritten; no row changes at deploy.

## Risk
- A brand that relied on "remove a product from a live offer creators have" is now told to end the
  offer or take the product off sale. Intended (founder's rule).
- Deploy order: Render and Vercel deploy independently. Old page + new server: Remove on a given offer
  shows the server's refusal in the dialog. New page + old server: Add products would answer 404 for
  the minute or two until Render is live. Neither harms data.

## Rollback
Revert the commit and push. No data to undo: products added through the new button are ordinary pool
items and stay valid under the old code.
