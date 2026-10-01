# shop-for-preference — workflow

1. A shopper opens Home. The phone sends her choices with the request (unchanged).
2. The server returns every live post: hers first, then the others.
3. She chose Men and nothing for men exists → she sees what exists.
4. She chose nothing → the usual order.

Build path: founder's instruction (chat, 1 Oct) → this contract → `shopperPosts.livePool` marks each
post `preferred` instead of leaving posts out; `shopperFeed.feed` and `shopperPosts.more` order by
it → tests (`shopper-app-v2`, the rewritten "choice orders the feed" check) → rules v1.16 →
**explicit go** → push (Render). No migration, no OTA.
