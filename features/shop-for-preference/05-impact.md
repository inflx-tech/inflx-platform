# shop-for-preference — impact

**Production-impacting.** Backend (Render) only. No migration, no phone update, no money.
Explicit go before push.

## What changes for people
- **Shoppers:** nobody gets an empty Home because of their Women / Men / Kids choice. A shopper who
  chose Women now sees the men's watch post too, after anything for women.
- **Creators and brands:** their posts reach every shopper, not only those who chose their group.
- **At deploy:** the one live post (KNTZXR) appears for every shopper on the next refresh.

## Surfaces touched
`backend/src/services/shopperPosts.service.js` (`livePool`: `preferred` per post, no exclusion;
`more`) · `backend/src/services/shopperFeed.service.js` (`feed`: preferred first in both stages;
`circles` now sees the whole pool) · `backend/tests/shopper-app-v2.test.js` (one check rewritten) ·
`Docs/OFFER_TERMS_POSTS_RULES.md` v1.16.

## Risk
A shopper who chose Women will see men's and kids' posts lower down. Intended. If the feed becomes
crowded later, the weight of the choice is tuned in the feed that learns — a decision for then.

## Rollback
Revert the commit and push. No data to undo.
