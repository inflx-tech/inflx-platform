# Part 2 — The pre-campaign handshake

Program: Collaboration Restructure (`Docs/COLLAB_RESTRUCTURE_PLAN.md`).
**Covers what the plan listed as Parts 2 AND 3** — founder, 2026-08-11: *"make it single
instead of two."* An agreement with nowhere to go is not useful, so the handshake and its
handoff into a campaign are one piece of work.

Status: **DRAFT — not locked.** No code until locked.

---

## The shape

Two stages, and today the platform only has the second one.

**Stage 1 — the handshake.** Cheap. Establishes that two parties want to work together and
settles the terms that matter. Either side can start it.

**Stage 2 — the campaign.** The brand builds the detailed campaign *afterwards*, starting
from the creators who already agreed. The campaign remains the spine: collaborations,
product allocation, offers, money and analytics all source from it.

The point of separating them is the founder's: *"if brand creates campaign without knowing
their interest is waste of energy."*

---

## What exists today (verified 2026-08-11)

| Capability | Reality |
|---|---|
| Creator → brand pitch | **Fully built.** 15 endpoints, full lifecycle. |
| Pitch contents | title, message, aim, proposed fee, proposed commission %, deliverables, posting window, up to 3 portfolio links, scope (store/category/product) + product ids, theme |
| Creator discovery of brands | `discover-brands` (brands that opted in) + browse that brand's catalogue |
| Spam controls (creator side) | 5 active · 3/day · 10/week · 7-day expiry · 30-day cooldown after rejection · brand opt-in **off by default** · brand eligibility bar (min tier, allowed niches, same-city, min engagement, past-collab-only) · admin suspend/ban |
| Brand → creator request | **Does not exist.** No table, no endpoint. |
| What a brand can do instead | Invite into a campaign that already exists, or invite an **unclaimed scraped creator** to join the platform |
| On acceptance | **Fabricates a campaign** — "Proposal: \<title\>", one set, one creator, no dates — plus a contract draft. The agreed creator never enters a real campaign. |
| Targeting machinery | Handpick, saved creator groups (server-persisted with members), and a filter matcher (tier · niche incl. secondary · city · min engagement · gender). All working, but the matcher fires **once, at campaign publish**. |
| Negotiation / contract / deliverables | Fully built and unchanged by this contract. |

---

## Founder decisions (2026-08-11)

1. **Parts 2 and 3 are one contract.**
2. **Two record types, not one.** A creator pitch says *"I want to work with you"*; a brand
   request says *"I want you for something."* Different shapes, separate records — but they
   **share the terms model and the response flow**.
3. **Existing fabricated stub campaigns are left alone.** The new flow carries fresh ones.
4. **An agreement expires after three months** if no detailed campaign has been made from it.
5. **Creators are open to brand requests by default, and can mute.** Opt-in would leave most
   creators unreachable and the feature unused.
6. **A filter-matched request is a one-time snapshot.** Matches once and sends; the brand
   knows exactly who was contacted. Standing recruitment belongs to open sales campaigns, not
   to a handshake.
7. **Two counters each, then settle or drop** — matching the existing campaign contract rule
   so both negotiations feel the same.

---

## The terms model (founder's design)

Not every term matters equally, and the model says so.

**Money and time are primary.** Always stated, always negotiable.
- *Money* — commission % for sales, fee for engagement, both for hybrid.
- *Time* — when content is expected to go up. **Not** campaign duration: a sales
  collaboration has no duration, so time means the posting expectation.

**Everything else is optional**, including deliverables — a brand often does not know which
channels a creator has and should not have to guess.

**Anything stated carries an importance marker:**
- **Requirement** — must be settled before agreement.
- **Preference** — explicitly put to the other party as a question (*"we'd like this, what
  works for you?"*) rather than presented as fixed.

This is what keeps the handshake cheap: two things must be agreed, everything else is a
conversation.

**A request or pitch carries:** aim · money · time · what is being promoted (whole store /
category / specific products) · collaboration mode (store visit / product shipment / remote)
· deliverables (optional) · a message.

**It must NOT carry:** coupon codes, product allocation, offer configuration, the brief, or
reference assets. None can be correct before the campaign exists — and including them is
precisely why the current acceptance path has to fabricate a campaign.

---

## What we build

### A — Brand-initiated requests
A brand sends a collaboration request to a creator before any campaign exists. Both sides can
accept, reject or counter. Three ways to reach creators, reusing the existing machinery:
**one specific creator**, **a saved group**, or a **filter-matched one-time broadcast**.

### B — The shared terms model
One definition of terms, importance markers and the response flow, used by both record types.
Two copies of this would drift, and a drifted terms model means the two sides think they
agreed to different things.

### C — Spam controls, admin-configurable on both sides
The creator side has five layers; the brand side has none, because brand outreach never
existed. Brands get an equivalent — volume limits, a cooldown after a creator declines, a cap
on how many creators one broadcast can reach — plus the creator-side mute.

All of it, **both sides**, moves into a `handshake_settings` row an admin can edit, seeded
with today's hardcoded values so behaviour is unchanged on day one (§8).

### D — The agreement record
Acceptance produces an **agreement**, not a campaign. The creator lands in a *ready to brief*
list with the agreed terms attached. No campaign, no set, no contract. Expires after three
months if never briefed.

### E — Campaign creation starts from agreements
Campaign creation opens knowing how many creators have agreed and are waiting. The brand picks
some or all; they land in a set with agreed terms pre-filled and still editable. **Many
agreements become one campaign across sets** — not one campaign per agreement.

### F — The contract moves
Contract creation happens once the creator is really in a set with real terms, not at the
moment of agreement. Today it fires at acceptance, describing a campaign that is not real.
This is a reordering of an existing step, not new machinery.

### G — Negotiate once, then one click
Founder, 2026-08-11: *"we add this acceptance flow at contract level and also after agreed
detailed campaign get created and send... then we don't go again with this approval flow...
simple one click like accept and contract get generated next."*

**All negotiation happens at the handshake.** When the detailed campaign arrives, the creator
does not re-enter an approval flow. They see the settled terms as settled, press **Accept
once**, and the contract is generated.

Verified: **accept already generates the contract** — `offer.controller` accept calls
`contractService.autoCreate`. So this is mostly *removing* a step, not adding one.

What changes:
- A creator who arrived **via an agreement** sees settled terms displayed as settled, with
  **Accept** and **Decline** only. **No Negotiate** — renegotiating what was already agreed
  would mean the handshake bought nothing.
- A creator **invited cold**, with no prior agreement, keeps today's flow unchanged:
  Accept / Decline / **Negotiate**. Nothing was agreed with them, so there is nothing to
  protect.

**Decline stays** in both cases. One click to accept is the goal; nobody is trapped into a
collaboration.

### H — Where it lives
**In the Influencers tab**, because that is where a brand already starts. **Web and mobile
both** — a brand needs to answer a creator and agree money and timing from their phone.
Detailed campaign creation stays web-only.

---

## What is true after this

- A brand can say "I'd like to work with you" without building a campaign first.
- A creator can be approached by a brand that found them, not only by one they pitched.
- Agreeing costs a message, not a campaign.
- A brand builds one campaign from several agreed creators, with terms already filled in.
- Nobody renegotiates what they already agreed.
- Nothing is fabricated behind anyone's back.

---

## Founder decisions, round 2 (2026-08-11)

**8. Limits are ADMIN-CONTROLLED, not hardcoded.** *"we add these limits not hardcoded, we
keep admin control one."*

This follows an established pattern — `referral_settings`, `world_rule_settings`,
`platform_meals_settings` and `follower_app_config` are all single-row settings tables with an
admin read/write surface. A `handshake_settings` row does the same.

**Consequence worth stating: this should cover the creator side too.** Those limits are
hardcoded today — `RATE_LIMITS = { 5 active, 3/day, 10/week }`, a 7-day expiry and a 30-day
rejection cooldown, all constants in `proposal.service`. Making brand limits configurable
while creator limits stay frozen in code would be inconsistent and confusing to whoever
operates it. Both sides move into settings, seeded with today's values so nothing changes
behaviour on day one.

Settings to expose: per-side active / per-day / per-week caps · pitch and request expiry ·
rejection cooldown · maximum creators reachable by one broadcast · agreement expiry (default
three months).

**9. One agreement is one agreed collaboration.** *"agreement is done means only with one
creator or brand... intention is only one... don't over complicate."*

An agreement is strictly between **one brand and one creator**, and is **consumed** when it is
briefed into a campaign. Once consumed it leaves the *ready to brief* list, so that list always
shows exactly what is still outstanding.

*Reading being taken — say if wrong:* several agreements can still be briefed into **one**
campaign across its sets, each one consumed as it goes in. Mapping one agreement to one whole
campaign would recreate the per-creator campaign fragmentation this contract exists to remove.

**10. Mobile surface confirmed** — the Influencers tab in the brand app, where search,
proposals and groups already live, mirroring web.

## Still open

- **Maestro.** This touches `Packages/Mobile/src/**`, so gov-check requires a Maestro run
  before `released` can flip. It was skipped for Part 1 and that mobile leg is still held.
  Decide whether to run it this time or hold the mobile leg again.

## Out of scope

Open-campaign discovery (a creator asking to join a live sales campaign) — that is a
different question from the handshake and belongs with the creator-side work. Parts 5, 6 and
7 of the program. Any change to negotiation, contracts, deliverables, allocation, offers or
money.
