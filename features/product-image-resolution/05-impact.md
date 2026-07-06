# Impact — product image resolution

**Verdict: backend-only, additive read resolution. No migration, no OTA, no
mobile change. Deploys on push.**

- Read surfaces now resolve the cover from richer sources when image_url is
  empty; when image_url is set, behaviour is byte-identical (explicit wins).
- Two follower product SELECTs gained variants_json + facets columns — small
  payload increase per product row, already selected on the browse path.
- Create path derives image_url when absent — only affects products created
  without a cover, which previously rendered blank.
- Backfill is a separate, gated, dry-run-default script (prod write) — run on
  explicit go; not part of the code deploy.
- Follower visible effect on deploy day: none in prod (0 broken rows today);
  going forward, any product with an image anywhere renders everywhere.
