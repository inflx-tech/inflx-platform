# Impact — dead offer join

**Verdict: a follower-visible behaviour change. Content appears where none appeared before.
No schema change, no money-path change.**

## Blast radius

| Area | Impact |
|---|---|
| Creator sections | Creators with a live collaboration become visible to non-followers |
| `has_live_deal` marker | Now true when a deal is live (was always false) |
| Follower "active deals" count | Real number (was always 0) |
| Creators-in-category | Populates (was always empty) |
| Top brands by engagement | Populates (was always empty) |
| Brands with store-direct offers | **None** — that OR leg is untouched |
| The 12 V2 offer rules | **None** — unreachable, left alone |
| Money, attribution, checkout | **None** |

## Risks

**Surfacing creators who should stay hidden.** The widened test is the same one the
storefront uses, so a creator surfaced here has a real allocation and a real store. W6
covers the negative case.

**Section volume changes.** Sections that returned nothing will now return rows. That is the
intent, but it is a visible change to the follower app and the reason this needed an
explicit go rather than riding along with Part 4.

**Scope was overstated once already.** The first version of this contract claimed 12
discovery rule queries were broken; they are not, because they short-circuit to the V2
adapter. Corrected before any code was written. The remaining four are verified reachable.

## Deploy classification

**Production-impacting** — `backend/src/**`. Target: Render. No migration.
Founder go received 2026-08-11 for the corrected four-item scope.
