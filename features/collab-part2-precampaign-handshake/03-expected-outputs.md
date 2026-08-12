# Expected outputs — pre-campaign handshake

## Schema (additive)

- **`brand_collab_requests`** — the new record type. Brand → creator, carrying the shared terms
  payload, status (sent / viewed / countered / agreed / declined / withdrawn / expired),
  per-side counter-round counts, expiry, origin (direct / group / broadcast) and a broadcast
  batch id so a brand can see who one broadcast reached.
- **`collab_agreements`** — produced by acceptance from **either** record type. One brand, one
  creator, the settled terms, a reference to the source record, expiry, and a
  consumed-by-campaign reference that stays null until briefed.
- **`handshake_settings`** — single admin-editable row, following the pattern of
  `referral_settings` / `world_rule_settings` / `follower_app_config`. Holds both sides' caps,
  TTLs, cooldown, counter rounds, broadcast cap and agreement expiry. Seeded with today's
  hardcoded values so behaviour is unchanged on day one.
- **Creator preferences** on `influencers` — accepts brand requests (default true), include in
  broadcasts (default true), minimum commission, minimum fee, aims accepted.

Existing `influencer_proposals` is **not** restructured. It keeps working and gains only what it
needs to produce an agreement.

## Backend

**Shared terms model** — one module defining the term shape, the primary/optional split, the
requirement/preference marker and validation. Used by both record types. Money and time are
required on every request; everything else is optional; a stated optional term must carry an
importance marker.

**Settings service** — reads `handshake_settings`, falling back to today's constants so a
missing row cannot break the flow. `proposal.service`'s hardcoded `RATE_LIMITS`,
`PROPOSAL_TTL_DAYS` and `COOLDOWN_DAYS_AFTER_REJECT` are replaced by reads through it.

**Brand endpoints** — create a request (direct / group / broadcast, with per-creator override),
list sent requests, respond to a counter (accept / counter back / decline), withdraw, and preview
a broadcast's recipients before sending.

**Creator endpoints** — list incoming requests, accept / counter / decline, and read/update
collaboration preferences.

**Agreement** — created on acceptance from either side. `proposal.controller` **stops
fabricating a campaign, set, campaign_influencer and contract** and creates an agreement
instead. Plus a listing for Ready to brief and an expiry job that lapses unbriefed agreements.

**Campaign creation** — reads unconsumed agreements for the brand, pre-fills a creator's terms
from one, and marks it consumed. Editing an agreed term returns a warning flag the UI surfaces.

**Creator campaign acceptance** — when the collaboration traces to an agreement the negotiate
route is refused with a reason; accept behaves as today and generates the contract. A cold invite
is unchanged.

**Admin endpoints** — read and update `handshake_settings` behind the usual admin role gate.

## Web (brand-web)

The Influencers tab gains Requests and Ready to brief; a request composer; a broadcast preview;
a counter diff view; and agreed creators offered inside campaign creation.

## Mobile

Brand: the same handshake inside the Influencers tab. Creator: incoming requests alongside their
own pitches, the counter composer, and collaboration preferences.

## Verification

`pnpm qa` green. New tests must cover: the terms model's requirement/preference rules · limits
read from settings rather than constants · a requirement not being counterable · round
exhaustion · acceptance producing an agreement and **not** a campaign · consumption on brief ·
expiry · negotiate refused for agreement-backed collaborations and allowed for cold ones.

Before/after diff notes in `06-diff/notes.md`. Maestro is parked by founder decision, so the
mobile leg is held.

## Explicitly NOT in the output

Open-campaign discovery (a creator asking to join a live campaign). Any change to negotiation
mechanics, contracts, deliverables, allocation, offers, commission or money. Restructuring the
existing creator pitch. Converting the existing fabricated stub campaigns — founder decided to
leave them.
