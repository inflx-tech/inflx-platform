# Impact Analysis — offer-engine Sub-contract A

## Verdict (terse)
**Zero functional disturbance — additive backend foundation, ships dormant.**
New table + nullable/defaulted columns unread by existing code; one
behaviour-preserving validator extraction. Nothing in production changes until
Sub-contracts B/C/D wire callers.

## Mechanics
- **Migration 084 is purely additive + idempotent.** A new table and
  `ADD COLUMN IF NOT EXISTS` on `campaign_influencers` (both nullable) +
  `brand_offers` store columns (defaulted). No column drops, type changes,
  backfills, or constraint tightenings on existing data. Existing rows get
  `brand_offer_id=NULL`, `allocation=NULL` — no current query reads them.
- **No existing read/write path consumes the new columns.** `campaign.controller`
  create, `transaction.controller` flows, `follower.service.resolveBusinessStore`,
  and `offer.service.resolveOfferDiscount` are unchanged in behaviour. The store
  columns on `brand_offers` are read only by Sub-contract D.
- **The shared validator is new + library-only in A.** `campaign.controller` is
  not modified: its legacy validator uses a different offer-type vocabulary
  (`flat/percentage/.../prebook`, HTTP 422) than the library
  (`discount/volume/bogo/bundle/free_gift`), so reusing it there would *change*
  behaviour. The new `offerConfig.validator.js` is consumed only by the new CRUD;
  bridging the two vocabularies is deferred to Sub-contract C. Net: campaign
  create/validate is byte-for-byte unchanged in A.
- **New CRUD surface is brand-scoped and isolated.** `/brands/me/offers` touches
  only `brand_offers` (a new table) and read-only `brand_products` (for ownership
  checks). It cannot affect campaigns, escrow, transactions, or attribution.

## Blast radius if it failed
Contained to the new `/brands/me/offers` endpoints (which no UI calls yet in this
contract). A bug there cannot corrupt campaigns or money paths — the new columns
are write-only by future code and read by none today.

## Regression guard
`pnpm qa` rerun, C1/gate confirmed, money-path + campaign suites green, and the
4-pre-existing-RED-jest baseline (if still present) proven identical with/without
these edits (backend-test-debt, not a regression). `resolveOfferDiscount` output
diffed pre/post for an existing config → identical.

## Deploy posture
PRODUCTION-IMPACTING (migration + `backend/src`) but DORMANT. Surfaced for
explicit founder go before prod migrate + `git push` — never silent.
Backend-only ⇒ no OTA/web deploy; Render auto-deploys backend on push.
