# Workflow — concept-p3-follower-backend

## W1 — Anonymous feed
GET /v1/follower/posts (no JWT) → approved posts newest-first with creator,
generated concept name ("Winter Jeans"), cover URL (302-presign route),
slide/product counts. Empty DB → { posts: [] }, 200.

## W2 — Followed-first
Same call with a follower JWT whose follower follows creator A → A's posts
sort above equally-recent others; each creator carries followed: true/false.

## W3 — Post viewer payload
GET /v1/follower/posts/:id → media[] + pins[] (x/y% + live name/price/
discount_value/offer_price + purchasable flag) + products[] (deduped shop
list) + per-product tracking {cid,sid,oid,iid}+via_creator when the creator
has a live campaign with that brand (else null → purchase attributes as
organic — correct, not an error). Non-approved or unknown id → 404.

## W4 — PDP with offers
GET /v1/follower/products/:id on a product with a live 40% discount →
discount_value: 40, offer_price: rounded, offers:[{...discount}]. With a
live BOGO → offers carries it (type bogo), discount fields null. No live
offers → both null + offers: [] — byte-compatible with the old payload
minus nothing.

## Expected end state
node --check green; ROUTES-LOAD-OK; pnpm qa GREEN; gov-check exit 0.
No migration. No OTA. Deploy = push only.
