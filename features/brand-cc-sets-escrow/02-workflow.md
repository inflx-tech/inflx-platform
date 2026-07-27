# Workflow — A4 fold sets + escrow
## Actor
Brand on a campaign with tranches.
## Steps
1. Open a campaign → a **Payout** tab shows total escrowed / locked / released / queued +
   each influencer's tranche breakdown — no leaving the campaign screen.
2. The header money strip's "detail" opens the Payout tab (not a separate page).
3. Visiting old `/dashboard/campaigns/:id/escrow` → redirect to `…?tab=payout`.
   Visiting `/dashboard/campaigns/:id/sets` → redirect to the hub.
4. "Create the first set" → the campaign wizard (campaigns/new).
## Success
- Money/payout lives in the hub Payout tab; /escrow + /sets redirect; sets still creatable
  via the wizard; numbers unchanged.
## Failure/edge
- Commission-only campaign → Payout tab shows the "no tranches" explainer, no crash.
