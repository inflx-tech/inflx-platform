# concept-p3-follower-backend — Phase 3, backend half

**Program:** Docs/FASHION_REBUILD/POST_CONCEPT_BUILD_PLAN.md · **Depends on:** concept-p2-posts
**Scope ruling (founder, 2026-07-23):** P3 splits — backend now, follower UI
screen-by-screen from founder-supplied designs (locked working method).

## Goal (functional)

Everything the fresh follower app's first screens will read, serving before a
single screen exists:

1. **Posts feed** — `GET /v1/follower/posts` (authenticateOptional):
   approved posts, newest first, followed creators pinned on top for
   logged-in followers. Optional filters `concept_id` / `collection_id` /
   `creator` (handle) — P4 banner feeds and creator stores reuse this exact
   query. Items: creator (handle/name/avatar/city/followed), generated
   concept-or-collection name + family, cover slide + counts, caption.
2. **Post detail** — `GET /v1/follower/posts/:id`: slides (public media
   URLs), `pins` (coordinate tags joined to LIVE product data — price/best
   live discount resolve at read time, price changes show with no republish),
   `products` (the deduped Shop-this-post list), and per-product `tracking` +
   `via_creator` — the SAME 4-ID attribution block store/section items carry,
   resolved from the creator's newest live campaign for that product's brand.
   A purchase from a post therefore credits the creator through the EXISTING
   cart-claim → commission rails with zero new attribution code.
3. **PDP offer truth** — `GET /v1/follower/products/:id` now returns
   `discount_value` + `offer_price` (best live discount, OFFER_BEST_PCT) and
   `offers[]` (every live offer of any of the 5 types that APPLIES — same
   gate the cards use). Previously the PDP returned ZERO offer data.

## Non-goals

Eligibility/dark test (P4 — plugs into followerPosts.service, marked) ·
ranking beyond followed-first + recency (P4) · post likes/saves (P7) ·
any follower UI (founder supplies screens) · video (P6).
