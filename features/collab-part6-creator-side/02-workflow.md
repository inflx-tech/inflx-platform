# Part 6 — workflows

The end states `pnpm qa` must prove.

---

## W1 — Asha opens a collaboration she already agreed

1. Kanchi Silks and Asha settle 15% and a 15 Sep post-by date at the handshake (Part 2).
2. Kanchi Silks briefs it into a campaign; Asha gets the invite.
3. Asha opens it and sees two clearly separated groups:
   - **Already agreed with you** — 15% commission, post by 15 Sep, with the date agreed.
   - **New in this campaign** — coupon code, what she can sell, the brief, any offer.
4. She taps Accept once. The contract is generated.
5. At no point is she offered a negotiate button for the settled terms.

**End state:** the screen matches what the server already enforces — the terms she settled
are shown as settled, not re-presented as a fresh decision.

## W2 — A cold invite is untouched

1. Kanchi Silks invites Meera directly, with no prior agreement.
2. Meera sees one set of terms, no "already agreed" group, and the full
   accept / decline / negotiate choice exactly as today.

**End state:** zero change for the flow that has always worked.

## W3 — Asha can tell what she is allowed to sell

1. Asha's collaboration says **"You can sell: their whole store"**.
2. Kanchi Silks lists a new saree next week.
3. Asha's products screen shows it, without anyone re-inviting her.
4. A creator allocated a category sees the category name; one given a hand-picked list sees
   the count.

**End state:** the allocation scope is legible to the person it constrains — today the
products are reachable but the rule behind them is never stated.

## W4 — Asha finds brands in her industry

1. Asha opens brand discovery and filters to **Fashion** in **Bengaluru**.
2. Only brands accepting proposals, in that category and city, are listed.
3. Clearing a filter restores the full list; filters compose with the name search.
4. Only categories and cities that actually have listed brands are offered.

**End state:** the two fields already in the payload became usable, on web and mobile.

## W5 — The unreachable application flow stays visibly unreachable

1. No creator-facing route exists to browse open campaigns or to apply to one.
2. The brand's approve/reject application handlers remain, untouched.
3. A test pins the absence, so a future half-build is deliberate rather than accidental.

**End state:** a known gap stays known instead of decaying into a feature people assume
works.

## W6 — Nothing that worked stops working

1. Pitches, requests, agreements, briefing and one-click accept all behave as they did.
2. The creator's existing collaboration list, products screen and negotiation flow are
   unchanged for every collaboration that has no agreement behind it.

**End state:** zero regression, proven by the existing suite staying green.
