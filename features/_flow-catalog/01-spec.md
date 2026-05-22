# INFLX Flow Catalog (showcase / reference)

> **Status: showcase.** This is NOT a feature contract — it is a
> code-verified reference map of every major user flow in the
> INFLX platform, produced 2026-05-22 to ground the founder's
> testing plan. The `_` prefix excludes it from gov-check (same
> as `_demo-preview`).

## What this is

A complete inventory of the platform's flows, grounded in the
ACTUAL backend routes/controllers/services + mobile screens +
web pages (verify-twice — every flow cites real code, not the
spec). Five domains:

1. **Auth & onboarding** — login (phone+OTP), JWT/refresh,
   brand/influencer/follower registration, admin RBAC, approval
   gating.
2. **Campaign creation** — the 3 goal types (engagement /
   conversion / hybrid) × the 2 influencer modes (handpick /
   open-group), sets, offers, publish.
3. **Acceptance & negotiation** — accept / reject / negotiate
   branches, the brand-approve gate, contract sign → brand-sign
   → active, deliverables.
4. **Finance** — wallet top-up → escrow lock → 3 tranches →
   follower-purchase commission → withdrawal + TDS, crons.
5. **Follower & admin** — discovery/browse, the 4 transaction
   types (pay-at-store / booking / online-order / enquiry),
   share-link attribution, admin approvals + escrow + payouts.

## Deliverables in this folder

- `MASTER-CATALOG.md` — the complete text inventory (every flow,
  endpoints, state machines, edge cases).
- `04-preview/mockups/*.html` — 5 visual flow-diagram decks
  (one per domain). View with `pnpm preview:open _flow-catalog`.
- `DEFECTS-FOUND.md` — genuine defects + doc-drift surfaced
  during the mapping (NOT fixed — each is gated production work).

## How to view

```
pnpm preview:open _flow-catalog
```
Opens all 5 domain decks in the browser.
