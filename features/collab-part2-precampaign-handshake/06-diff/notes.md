# Before / after — the pre-campaign handshake

Two UI surfaces changed, both brand-web: the **Influencers tab** and **campaign
creation's terms sub-step**. Everything else is backend, summarised at the end.

Mockup: `04-preview/mockups/handshake.html` (11 screens, locked 2026-08-11 after the
first 6-screen version was rejected as a flow skeleton).

Rendered-page proof: `qa/web/brand/handshake-ui.spec.ts` (6 tests) and
`qa/web/brand/wizard-agreement-prefill.spec.ts` (3 tests), all against the real running
pages with the API stubbed.

---

## Influencers tab

**Before.** Three sub-tabs: Discover, Proposals (the creator→brand pitches), Groups. A
claimed creator's row action was **"Add" — which navigated to the campaigns list**: the
campaign-first flow this contract exists to invert. A brand had no way to say "I'd like
to work with you" without a campaign already built.

**After.** Five sub-tabs. **Requests** (badge = counters awaiting the brand's answer) and
**Ready to brief** (badge = agreed creators waiting for a campaign) join the original
three. The row action becomes **"Request collab"**, opening the composer:

- Aim first (friendly labels; the wire carries the `campaign_goal` enum).
- **Money and time asked per aim** — commission + post-by for pay-per-sale, fee + posting
  window for content — both marked *negotiable*.
- Scope and working style optional, each with the **Requirement / Preference** picker and
  a one-line explanation of what the marker means for the other side.
- **Deliverables deliberately absent** — the composer says the creator proposes what they
  can do.
- Sending reports the honest outcome: sent count, skipped count, and each skip's reason.

A creator's counter renders as a **side-by-side diff** — old value struck through, new
value highlighted — with *Accept their terms* / *Decline*. Ready-to-brief rows carry the
agreed summary and a **"Brief into a campaign →"** CTA.

## Campaign creation

**Before.** Always started empty. A creator who had agreed terms via a pitch was not
offered — they were marooned in a fabricated one-person stub campaign.

**After.** Arriving with `?agreement=<id>` (the Ready-to-brief CTA), the wizard jumps
straight to the terms sub-step with the **first set's goal set to the agreed aim** and the
creator pre-filled: agreed commission or fee, post-by date, the agreed scope as their
allocation, deliverables as the set's formats. `agreement_id` rides the invite payload so
the server **consumes the agreement** — and if the brand edits an agreed term, the
server's per-field warnings surface in the wizard (*"Asha agreed different terms: …"*),
never silently.

A consumed or expired agreement fails loudly: *"no longer available — it may have been
briefed or expired."*

## Deltas vs the locked mockup

- Group-send and broadcast composers exist at the API level (with per-creator overrides
  and the reached-vs-matched preview); the web composer currently opens from a single
  creator row. The group/broadcast entry points are recorded as remaining, not silently
  dropped.
- The mockup's "rounds left" dots render as counts from the server's
  `counter_rounds_per_side` rather than hardcoded dots.

## Verification notes — what the browser runs caught

- A stub with `data.influencers` where the page reads `data.creators` made every row
  silently vanish (shape, not logic — the same fault family as the computed-then-
  discarded display fields).
- The creator row is itself `role="button"` and its accessible name contains the inner
  button's text, so an inexact locator clicked the **row** and navigated to a profile.
  Only `exact: true` hits the real button.
- "Request sent" appears twice on success — modal heading and toast — which is the two
  surfaces both confirming; the test scoped rather than the page changing.

---

## Not visible in this diff (backend)

- Migration 149: `brand_collab_requests`, `collab_agreements` (CHECK: exactly one
  source), `handshake_settings` seeded with today's values, `brand_request_cooldowns`,
  creator preference columns, `campaign_influencers.agreement_id`.
- The shared terms model — aim vocabulary aligned to the `campaign_goal` enum after a
  first draft invented a second vocabulary; requirement not counterable; conversion has
  a post-by, not a window.
- **Acceptance stops fabricating a campaign** — an agreement is produced instead; the
  notification stops promising a contract that doesn't exist.
- 17 handshake endpoints; limits admin-editable on both sides with safe fallbacks;
  hourly expiry job; one-click accept (negotiate 403s with the true reason for
  agreement-backed collaborations; cold invites unchanged).

Tests: 60+ new across 6 unit specs + 2 web specs. Suite 319 passed, gate 0, STATE=GREEN.

## Mobile (built 2026-08-12, founder: "skip maestro and build mobile")

**Creator app.** ProposalsHub gains a REQUESTS tab ("My Proposals" retitled "My Pitches" so
the two record types read as what they are). Request detail shows the terms model the way
the creator should feel it: money and time negotiable, a requirement locked and absent from
the counter composer, a preference framed as the brand asking. The counter composer moves
money/time, answers preferences, and proposes deliverables when the brand left them open.
Preferences screen: the mute, broadcast opt-out, minimum commission/fee, aims.

**Brand app.** "Request Collaboration" on the creator profile — above the campaign invite,
because agreeing first is the point. The composer mirrors web. Sent requests show a
creator's counter as an old→new diff with accept/decline; agreed creators sit under READY
TO BRIEF with an honest note that the campaign gets built on web (web-only by locked
scope), rather than a tap that pretends otherwise.

**Verification without a device:** 12/12 files Babel-parse with the RN preset, mobile jest
64/64, and a full production react-native bundle builds — the same module-graph resolution
the OTA publish performs. On-device verification is owed at the founder walkthrough.

**Held:** the web group/broadcast composer entry points (API complete), and Maestro —
skipped a third time by founder decision, so released stays false.

## Fix — brand-side counter, mobile (2026-08-27)

Founder walkthrough (screenshot, "Creators" tab) found the mobile brand screen offered
only **Accept / Decline** on a creator's counter — no way for the brand to counter back.
The locked mockup's view ⑥ ("The brand reads the counter") always showed a third button,
**"Counter back (N left)"**, and the spec's founder decision #7 is explicitly symmetric
("two counters each, then settle or drop"). The backend route
(`POST /brands/me/collab-requests/:id/counter`) and its mobile API client function
(`brandApi.counterCollabRequest`) were built at the same time as the rest of the handshake
but never wired to a button — dead code since 2026-08-12.

`Packages/Mobile/src/screens/brand/BrandCollabRequestsScreen.js` gains a "COUNTER BACK (N
LEFT)" button next to Accept/Decline (shown while rounds remain), opening an inline
counter form — commission/fee, post-by date, working style, deliverables for paid deals —
reusing the same side-agnostic `utils/collabCounter.js` diff/build logic and
`utils/workingStyle.js` mode mapping the creator's counter screen already used. No backend
or API change; brand-web carries the identical gap and is explicitly out of scope for this
fix (founder: mobile only, 2026-08-27 chat).
