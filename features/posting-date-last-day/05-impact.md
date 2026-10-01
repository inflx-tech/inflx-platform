# posting-date-last-day — impact

**Production-impacting.** Backend (Render) and both phone apps (OTA brand, influencer). **No
migration. No money moves.** The shopper app needs no update: it shows what the server sends.
Explicit go before OTA and push.

## The moment it deploys
- **Every approved post whose offer is running appears in the shopper app.** Today that is one post:
  KNTZXR ("Outfits and accessories"), offer "Year end sale" 1–9 Oct. It will be visible and
  **buyable** from the deploy until 9 Oct, when its offer ends and it leaves the shop.
- **Orders become possible.** An order from the shopper app is a real order with real payment steps
  (production is the only environment; everything in it today is test data).
- Creators and brands see "Live" where they saw "Approved · in the shop from 8 Oct".

## What changes for people
- **Shoppers:** posts appear as creators finish, not in one batch on a set's posting date.
- **Creators:** a post is live the moment INFLX approves it; her link works at once. The posting
  date reads as her last day ("Go live by 8 Oct").
- **Brands:** no single launch day for a set, unless they use an offer's start date to make one.
  On the terms sheet, an offer that ends on the posting date or starts after it is no longer
  listed, and products still inside an offer today are no longer listed as "without offers".
- **Collaborations already sent:** keep what they were given (L4).

## Surfaces touched
Server: `shoppablePosts.service.js` (`liveDayOf`, `stateOf`, the post shape, the approval notice),
`shopperPosts.service.js` (the live pool, the code lookup), `saleLive.service.js` (Path 1 states,
`goesLiveOn`), `postLinks.service.js`, `postsCopy.js`, `creatorTerms.service.js` (`offerChoices`,
`freeProducts`, three sentences), `productionCopy.js` (one sentence).
Phones: eleven files, twenty-three sentences and three callers (`06-diff/notes.md`).

## Risk
- A post at normal price is now live before the posting date. Rule 4 keeps new terms safe; a
  collaboration sent before today could hold a product that is still in another offer until its
  posting date. Production has none (the only collaboration on new terms holds one offer).
- An offer post approved on a day its offer is not yet running waits — covered by rule 2 and tested.

## Rollback
Revert the commit and push; publish the previous OTA bundles. No data to undo.
