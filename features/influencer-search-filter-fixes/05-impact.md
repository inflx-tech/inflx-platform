# 05 — Impact

**Verdict: one added facet query per search; the chip row becomes a
working tier switcher and the counts stop lying. No schema, no
migration.**

## Mechanics

- **Schema:** none.
- **API contract:** additive only — `meta.tier_counts`. Existing
  consumers ignoring it are unaffected; `data.creators`, `page`,
  `limit` and `total` are unchanged.
- **Query cost:** one extra `GROUP BY tier` against
  `v_searchable_creators` per search, reusing the already-built
  conditions. Same view, same filters, no joins added.
- **Ordering dependency (important):** the tier condition is now
  pushed **last**, after every other filter, so the facet snapshot can
  reuse the earlier params positionally. A future filter added *after*
  the tier block would silently be excluded from the facet counts —
  the code carries a comment saying so.

## Risk

Low. The one behavioural subtlety is that a disabled zero-count chip
is new UI; previously such chips did not render at all.

The sequence guard cannot strand the spinner: the discarded branch
returns before `setLoading(false)`, but the newer in-flight request
always sets it on completion, and every search increments the ref
before awaiting.

## What this does not fix

- Creator city coverage — 37 of 73 rows have no city, so city filters
  remain aggressive by construction.
- Cold-start latency. The race is fixed; the wait is not.

## Classification

**Production-impacting** — `backend/src/**` (Render) and
`Packages/brand-web/app/**` (Vercel). No migration, no OTA.
Explicit founder go required before push.
