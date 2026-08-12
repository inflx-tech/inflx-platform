# Workflow — pre-campaign handshake

## Brand initiates

**W1 — brand requests one creator.** Brand opens Influencers → a creator → Request
collaboration. Sets aim, money, time; optionally scope, mode, deliverables, each marked
requirement or preference. Sends.
**End state:** the creator has an incoming request. No campaign, no set, no contract exists.

**W2 — brand requests a saved group.** Same terms to all members, with a per-creator override
on money or time.
**End state:** one request record per creator, each negotiable independently.

**W3 — brand broadcasts to matches.** Filters on tier, niche, city, engagement, gender.
**End state:** matched once, as a snapshot. Creators over the admin broadcast cap are not
contacted, muted creators are excluded, and the brand is told how many were reached vs matched.

**W4 — a brand hits its limit.** Active / per-day / per-week caps come from settings.
**End state:** refused with the limit named, not silently dropped.

## Creator responds

**W5 — creator accepts.** **End state:** an **agreement** exists. No campaign, no contract.

**W6 — creator counters.** Moves money and/or time, may decline a preference, may fill in
deliverables the brand left open.
**End state:** the brand sees a side-by-side diff; one of the creator's two rounds is used.

**W7 — a requirement cannot be countered.** It is not editable in the counter composer.
**End state:** the creator either accepts it or declines the whole request.

**W8 — rounds run out.** Both sides have used two counters.
**End state:** settle or drop — no further counters offered.

**W9 — creator declines.** **End state:** cooldown starts; that brand cannot re-request until
it lapses.

**W10 — nobody answers.** **End state:** the request expires on the settings TTL and stops
occupying an active slot on either side.

## Creator controls

**W11 — creator mutes brand requests.** **End state:** no brand can send one, and the brand is
told why rather than being ignored.

**W12 — creator sets a bar.** Minimum commission, minimum fee, aims they take.
**End state:** a request below the bar cannot be sent, and the brand is told.

## Both directions share the machinery

**W13 — a creator pitch still works exactly as today**, and produces the same kind of agreement
on acceptance.
**End state:** two record types, one terms model, one response flow. A pitch is never converted
into a request or vice versa.

## Handoff

**W14 — acceptance no longer fabricates a campaign.**
**End state:** no campaign, no set, no campaign_influencer and no contract is created at
acceptance. This is the single biggest behaviour change in the contract.

**W15 — campaign creation starts from agreements.**
**End state:** agreed creators are offered, terms pre-filled, and the set chosen by the aim they
agreed to. Several agreements go into one campaign.

**W16 — an agreement is consumed.** **End state:** it leaves Ready to brief when briefed, so
that list always shows exactly what is outstanding.

**W17 — an agreement expires.** Three months unbriefed.
**End state:** lapsed, no longer offered in campaign creation, and both sides can see why.

**W18 — editing an agreed term warns.** Brand changes 15% to 12% in the campaign.
**End state:** allowed, but flagged — the creator must agree again. Never silent.

## Creator accepts the campaign

**W19 — agreement-backed: one click.** Settled terms shown locked; new campaign specifics
(code, allocation, offer, brief) shown as new.
**End state:** Accept generates the contract. **No Negotiate offered.** Decline still available.

**W20 — invited cold: unchanged.** No prior agreement.
**End state:** Accept / Decline / Negotiate, exactly as today.

## Admin

**W21 — an admin changes a limit.** **End state:** takes effect without a deploy, on both sides.

## Regression guard

`pnpm qa` green. The existing creator-pitch lifecycle, campaign invite, negotiation, contract
and deliverable flows must be unaffected except where listed above.
