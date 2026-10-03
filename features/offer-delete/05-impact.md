# offer-delete — impact

**Production-impacting.** Migration 201 (one nullable column on `brand_offers`), the server (Render)
and the brand website (Vercel). **No phone change, no OTA, no money moves.** Explicit go before the
migration and the push. Migrate first: the new server code reads the column.

## What changes for people
- **Brands:** a Delete button on Draft and Ended offers (list and the ended offer's page). Drafts are
  erased; ended offers leave the brand's lists. Running offers are unchanged.
- **Creators:** nothing. An offer the brand deletes after it ended still shows, as Ended, in her
  terms and on her posts, with its earnings.
- **Shoppers:** nothing (they never see an ended offer).
- **INFLX admin:** nothing; posts and orders still name the offer.

## Surfaces
Server: `offerLife.service.js` (delete: erase a draft, hide an ended one, refuse a running one; the
list, its counts and the brand's read skip hidden offers; the hold on past days is cleared),
`creatorTerms.service.js` (the brand's "not shown, ended" hint), `offerPool.service.js` (last-offer
hint), `offersV2.controller.js` (answer shape). Migration `201_offer_deleted_at.sql` +
`scripts/run-201.js`. Website: `OffersLibrary.js` (row buttons, confirm, toast, reload),
`OfferPage.js` (Delete on an ended offer; End box sentence), `lib/api.js` if needed. Rules v1.17.

## Risk
- Filtering hidden offers anywhere a creator, shopper, order or wallet reads would blank real records.
  The filter lives only in the brand's own reads; tests assert her side still shows it.
- "Ended" is two stored states; the check uses the same rule as the list (`displayStatus`).
- OffersLibrary is drawn on two pages (Listings › Offers and the older Products page); both get it.
- The brand phone's unused `deleteOffer` calls the same route; its behaviour for drafts is unchanged.

## Rollback
Revert the commit and push. The column can stay (nullable, unread by the old code). Said in full:
after a revert, every ended offer a brand deleted shows in its list again (the rows were never
erased); deleted drafts stay gone.
