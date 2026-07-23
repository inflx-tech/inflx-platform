# Workflow — concept-p4-eligibility

## W1 — A post keeps its promise
Approved post under "Jeans Under ₹499", 3 attached products, one still at
₹449 → detail returns the post; that product concept_eligible: true and
sorted first; the ₹599 one stays purchasable below (live price on screen).

## W2 — A post goes dark
Brand raises every attached product past the band → sweep sets
eligible_product_count = 0 + went_dark_at, creator gets the post.dark push
("hidden from followers — your other posts are unaffected"), the feed stops
returning it, direct detail hits 404. Products qualify again → count > 0,
went_dark_at clears, post reappears. No republish at any point.

## W3 — Fresh post is never punished
Newly approved post has NULL cache → visible in the feed immediately; the
detail's live check is the guard until the next sweep tick.

## W4 — Inspector
/admin/concepts → "In use" tab → concepts ranked by approved posts with
visible/approved/pending/rejected counts → click a row → per-creator
breakdown (@handle · visible/approved/pending). Collections section below.
Empty state before any posts exist.

## Expected end state
node --check green; routes + jobs load; pnpm qa GREEN; gov 0. Deploy =
run-142 (additive columns) + push; no OTA (My Posts dark state is payload-
only until the next mobile release).
