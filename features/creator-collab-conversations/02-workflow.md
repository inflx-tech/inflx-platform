# Workflow — creator collab conversations

## Order, and why

Slices 1–3 are backend and land first because slices 4–6 read what they produce. Slices
1–3 are also **safe for un-updated app builds** — additive columns, one new route, and
corrections that only fire in states no shipped client can currently produce. So the
backend can deploy ahead of the OTA without breaking a phone that has not updated.

| # | slice | targets | depends on |
|---|---|---|---|
| 1 | Migration 152 · pitch terms validation · three corrections | backend | — |
| 2 | `GET /collab-threads` | backend | 1 |
| 3 | Creator counter route + notification | backend | 1 |
| 4 | Collabs list — two front stages, threaded rows | Mobile (influencer) | 2 |
| 5 | Thread detail — timeline + all actions, `ig` restyle | Mobile (influencer) | 2, 3 |
| 6 | Brand answers a creator counter | brand-web, Mobile (brand) | 3 |
| 7 | Discovery — area filter, industry facet, per-row eligibility | backend, Mobile (influencer) | — |
| 8 | Pitch composer — four-step wizard, shared vocabulary, importance markers | Mobile (influencer), backend | 1 |
| 9 | City normalisation + the `accepts_proposals` decision | backend, migration | founder decision |

Slice 6 is not optional and does not slip. A creator who can counter into a brand that
cannot answer is worse off than one who could not counter at all.

Slices 7 and 8 are independent of 1–6 and can run in parallel. Slice 9 is **blocked on a
founder decision** (spec §1.6, options A/B/C) and is the only slice that is.

---

## Slice 1 — the pitch becomes negotiable

**Migration 152**, additive:

```sql
ALTER TABLE influencer_proposals
  ADD COLUMN IF NOT EXISTS brand_rounds_used   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_rounds_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS counter_by          text;
```

Backfill, in the same transaction:

```sql
UPDATE influencer_proposals
   SET counter_by = 'brand', brand_rounds_used = 1
 WHERE counter_terms IS NOT NULL AND counter_by IS NULL;
```

Only a brand can have countered until now, so this records a fact rather than guessing at
one. Run via `backend/scripts/run-152.js`, against prod **before** the push, per
`project_prod_migration_mechanism`.

**Corrections** (each gets a test that fails before the fix):

1. `acceptProposal` — settle the **latest** terms. Today `acceptedFlow(proposal, false)`
   always uses the creator's original. Becomes: use `counter_terms` when `counter_by` is
   set, else the original. `respondToCounter`'s accept path already passes `true` and is
   unchanged.
2. `counterProposal` (brand) — refuse when
   `brand_rounds_used >= handshake_settings.counter_rounds_per_side`; increment on success.
3. `respondToCounter` (creator) — refuse unless `counter_by = 'brand'`. Today it checks
   only `status = 'countered'`, which after slice 3 is also true when the creator
   countered, letting a creator "accept" their own counter.

Pitch counters validate through **`collabTerms.model`** — the same module the handshake
uses — so the two directions cannot drift on what a term means or on which terms are
counterable.

## Slice 2 — the threaded read

`GET /v1/influencers/me/collab-threads`. One query set, assembled server-side.

Thread identity: the chain `brand_collab_requests.id` → `collab_agreements.source_request_id`
→ `campaign_influencers.agreement_id`, and the same via `source_proposal_id`. A cold
campaign invite (`agreement_id IS NULL`) is a thread of one.

Each thread returns: `brand`, `direction`, `state`, `turn`, `latest_terms`, `moved_by`,
`rounds_left`, `deadline`, and `timeline[]`.

Built on the server, not in the app, for the reason Part 6 recorded: two apps deriving the
same story from raw rows will drift, and a payload can be asserted by a test where a
render cannot.

The existing `listCreatorRequests` and `listMyProposals` stay. This is additive — nothing
is removed until the app has shipped and been verified on a device.

## Slice 3 — the creator counters

`POST /v1/influencers/me/proposals/:id/counter`, mirroring
`/collab-requests/:id/counter`: validate through `collabTerms.model`, refuse a counter that
touches a requirement, refuse when the creator's rounds are spent, write `counter_terms` +
`counter_by='creator'`, increment `creator_rounds_used`, notify the brand with
`proposal.countered_by_creator`.

## Slices 4–5 — the app

`COLLAB_STAGES` gains `invitations` and `pitches` at the front; the existing `invites`
stage is absorbed into `invitations`. `deriveStage` keeps its one-record-one-stage rule.

Retired: `ProposalsHub`'s REQUESTS and MY PITCHES tabs. Kept: DISCOVER. The Profile row is
relabelled **"Find brands to pitch"**. Notification deep links repoint from
`Profile → ProposalsHub` to the thread. `CollabRequestDetailScreen` and
`CollabPreferencesScreen` are restyled from `brandPalette` to `ig` and moved into the
Collabs stack.

## Slice 7 — discovery that can be filtered

`discoverEligibleBrands` gains `locality` and drops its dependence on `users.city` as the
only geo field. The eligibility conditions are untouched — these filters **narrow, never
widen**, the rule Part 6 set.

Facets extend to localities grouped by city, derived from the same eligibility conditions as
the list so a filter that returns nothing is never offered. The industry row is **omitted
when the facet has one entry**.

Each row carries `{ eligible, reason }` from the existing `checkEligibility`, run per brand
in the list query rather than only on submit. Ineligible rows render greyed with the reason.

Asserted on the payload, not the query: a row whose eligibility is computed and then dropped
by a serializer is the exact failure `feedback_computed_is_not_delivered` records.

## Slice 8 — the pitch composer

`SendProposalScreen` becomes four steps. The aim adopts the invitation's words — *Pay per
sale · Pay for content · Fee + commission* — over the same `campaign_goal` enum; no new
enum, no new vocabulary. Every term gains an importance marker, and the payload validates
through `collabTerms.model` server-side, so a pitch and a request are checked by one module.

`createProposal` keeps its existing columns and gains the importance markers alongside the
terms. Eligibility resolves at step 4, before Send, using the check that already exists.

## Slice 9 — the empty pool, once decided

Blocked on spec §1.6. If option A: one migration setting `accepts_proposals = true` for
`status = 'approved'` brands, per-brand toggle unchanged. Independently, a canonical city
per brand backfilled from `formatted_address` / `pincode`, with the unresolvable handful
listed for manual review rather than guessed at.

## Slice 6 — the brand answers

`dashboard/proposals/page.js` and `BrandProposalInboxScreen.js` show the creator's counter
as an old→new diff and offer Accept / Counter / Reject with rounds remaining. The Accept
button names the terms it will settle — "Accept ₹14,000 + 6%", not "Accept proposal" — so
settling stale terms would be visible rather than silent.

---

## Verification

Per contract, and honestly labelled:

- `pnpm qa` green, gate 0, with the new tests. Baseline at Part 6 close: **386**.
- The three corrections each get a test that **fails before the fix** — a correction with a
  test written after the fix proves only that the code does what it does.
- `collab-threads` asserted on the **response payload**, not on the query
  (`feedback_computed_is_not_delivered`): a thread whose timeline is computed and then
  dropped by a serializer is a feature that does not exist.
- Threading asserted on a real chain: request → agreement → consumed CI must return **one**
  thread, not three.
- Mobile: Babel parse, jest, and a full production RN bundle build.
- Maestro: run it, or record it as skipped with `released` staying false. This would be the
  sixth consecutive mobile release without on-device verification — say so plainly rather
  than letting it pass unremarked.

## Deploy

Migration 152 to prod first, then `commit → push → OTA`, per `feedback_deploy_cadence`.
Push is the deploy on this repo, so the founder go comes **before** the push
(`feedback_push_is_the_deploy`).

Targets: Render (backend), Vercel (brand-web), OTA (Mobile — brand + influencer).

Per `feedback_e2e_verification_at_end`, `released` stays false and the founder verifies
this alongside the rest of the redesign in one pass.
