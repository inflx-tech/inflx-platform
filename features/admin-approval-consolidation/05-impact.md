# 05 — Impact

**Verdict: restores a decision path that has never worked, and closes
two lifecycle dead ends. One deliberate UI removal.**

## Mechanics

- **Schema:** none.
- **API contract:** none. `PATCH /admin/{brands,influencers}/:id/status`
  keeps its shape; the frontend now sends the key the handler has
  always read.
- **Data:** the suspend branch stops nulling `approved_at` /
  `approved_by`. No backfill — rows suspended before this ship have
  already lost their provenance and cannot be recovered.
- **Behaviour removed:** Approve/Reject on `/admin/brands`. This is
  intentional (founder-directed). Anyone relying on that page to
  approve must use `/admin/approvals`, which is linked from the row.

## Risk

Low, with one real edge worth stating: `/admin/approvals` reject has
**never** succeeded, so there is no production behaviour to regress —
only behaviour to gain. The removal on `/admin/brands` is the sharper
edge, which is why D1 lands in the same commit rather than after.

The unreachable `rejected` branch left in the `/admin/brands` modal
is dead but harmless; removing it would touch more lines than the
change warrants.

## Classification

**Production-impacting.** Backend (`backend/src/**` → Render) and
brand-web (`Packages/brand-web/app/**` → Vercel). Explicit founder go
required before push.

## Verification performed

- `pnpm qa` → **GREEN, 79 passed, gate 0** (run after the backend
  edits, before the frontend edits; re-run required before release).
- Live reject cannot be smoke-tested without a disposable pending
  brand — founder to confirm on a throwaway row post-deploy.
