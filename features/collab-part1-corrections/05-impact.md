# Impact — Part 1 Corrections

**Verdict: behaviour-correcting, production-impacting. Removes false information and closes
one unvalidated write path. No model, layout or flow changes.**

## Blast radius

| Area | Impact |
|---|---|
| Library offer creation | Tighter — unpublished products now refused |
| In-campaign inline offers | Tighter — this path validated *nothing* before |
| Creator storefront display | A phantom discount stops appearing |
| Campaign basics money card | Honest numbers; hidden when irrelevant |
| Offer-type data | Converged to one vocabulary + migration |
| Campaign start date | Less restrictive |
| Sales / engagement / hybrid logic | **None** |
| Escrow, tranches, wallet locking, commission maths | **None** |
| Allocation, dates, publish gates | **None** |

## Risks and how they're handled

**Existing offers may reference unpublished products.** The new rule applies at write time,
so historical offers are unaffected until edited. An edit of such an offer will now fail
until the brand publishes the product or removes it — correct, but it is a behaviour change
a brand could hit on an old offer. Accepted deliberately: the alternative is letting invalid
offers stay editable.

**Wiring validation into the campaign inline path could reject payloads the wizard sends
today.** This is exactly why 1.4 ships with 1.1 — the wizard currently sends display labels
which the canonical vocabulary rejects. Both apps are updated in the same change, and the
read-side normaliser tolerates legacy values so nothing already stored breaks.

**The migration touches production rows.** Additive and idempotent; converts values only,
drops nothing, adds no constraint that could reject historical data. A row the migration
misses still resolves through the normaliser.

**Removing the commission fallback could blank a discount somewhere it was load-bearing.**
Checked: the fallback only produces a value when both real discount sources are absent, and
in that case there is genuinely no discount to apply at checkout. Removing it aligns display
with what is charged.

## Deploy classification

**Production-impacting.** Touches `backend/src/**`, a migration, `Packages/brand-web/app/**`
and `Packages/Mobile/src/**`.

Targets: Render (backend), Vercel (brand-web), OTA (mobile). Migration runs before the
backend deploy. Because `Packages/Mobile/src/**` is touched, the release needs Maestro green
per gov-check Rule 5, and the web UI change needs `06-diff/notes.md` per Rule 4.

**Explicit founder go required before push** — per the standing carve-out, production-
impacting deploys are never silent.
