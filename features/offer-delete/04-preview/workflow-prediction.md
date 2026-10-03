# Workflow prediction — offer-delete
Trigger: the brand taps Delete on a Draft or an Ended offer (list row, or the ended offer's page).
End state: a draft is erased; an ended offer has `deleted_at` set and no longer appears anywhere on
the brand's side (Offers list and counts, its page, creator-terms hints, Products without offers'
last-offer hint). Its past-day product holds are cleared. Creators' terms, posts, orders, the wallet
and admin read it exactly as before. Scheduled and Live offers cannot be deleted (409 "End it first").
Edges: an offer that ended by its date (status still 'published') · an ended offer a creator signed
for · an ended offer nobody had · a second delete of the same offer (404) · a back-dated new offer on
a product the deleted offer held (allowed).
