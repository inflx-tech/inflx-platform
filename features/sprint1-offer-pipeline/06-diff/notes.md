# Before / after — offer tap-through

**Before:** offers rendered on shelves but every tap died — the card sent the
LIBRARY offer id where a campaign offer id was expected, the backend looked it
up in the dead campaign_offers table → "Offer not found". Store-published
offers were doubly dead (no creator handle → the products route was
unaddressable; no detail endpoint existed). Past the 404, feed tracking used
short keys {cid,sid,oid,iid} while payments validate long keys → 422.
Founder hit this live (walkthrough P1: "if click on any offer it is showing
offer not found").

**After (per 04-preview/mockups/tap-flow.html):** three working channels —
store-direct (new GET /follower/store-offer/:id → OfferBlock mechanics →
existing store-offer/pay), creator assignment (explicit ci_id → proven
/store/:handle/products path → long-form 4-ID tracking → commission
attributes), showcase (same detail endpoint, promotional, no tracking by
design). No visual changes — the locked Offers/Product designs simply start
working.

Proof: journey 30/30 incl. S6.6a/b/c; qa 79/79. Founder on-device tap-through
is the release gate.
