# Impact — product detail hero fit

**Verdict: one mobile style/prop change on the follower product-detail hero.
No backend, no data, no migration. Reaches phones via OTA only.**

- Hero box → portrait 3:4; hero image resizeMode cover → contain. No logic,
  data, or navigation change; carousel paging (HERO_W) unchanged.
- Taller hero → the page scrolls a bit more before the buy row; standard for
  an image-led PDP.
- Contain may show a thin pale letterbox margin for non-3:4 photos — intended
  (full image over a hard crop).
- Rollback = OTA republish of the prior bundle.
