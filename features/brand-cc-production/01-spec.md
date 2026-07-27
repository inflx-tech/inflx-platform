# Feature Spec — Brand CC: Production stage (A5 step 1)

> Step 2. First, safe step of A5. Gives logistics a named home (a hub Production
> stage) — the visibility half — without touching the entangled 1468-LOC page or
> the parked backend. Inline scheduling/dispatch actions follow in the backend batch.

## Problem / goal
Physical logistics (store visits / product shipments / remote) is buried inside a
ContractModal on the 1468-LOC influencers page — no place to see, at a glance, "who am I
shipping to / which visits are booked." Add a hub **Production** stage that lists each
active creator's logistics need from existing roster data, and routes the actual
scheduling to the current panel.

## Scope
**In scope**
- New `ProductionSection.js` — a hub tab that lists active creators (status
  contracted/active/live) with a logistics chip derived from `physical_delivery`
  (Physical vs Remote) + delivery_address when present, and a **"Manage logistics →"**
  that opens the influencers page (where the existing ContractModal → ProductionPanel
  handles scheduling/shipment/remote).
- Hub: add the **Production** tab; generalize `?tab=` to accept `production`; PrimeBar's
  production-stage CTA → the Production tab.

**Explicitly out of scope (backend batch / later A5 steps)**
- Inline visit-scheduling / shipment-dispatch in the hub (needs a campaign-level
  production-list endpoint — parked backend).
- Splitting the 1468-LOC influencers page / moving the ProductionPanel inline.
- Folding the ContractModal into the hub.

## Surfaces touched
- App: brand-web only. Roles: brand.

## Data / contracts
- Endpoints: NONE new. Renders from the roster already in the hub payload
  (`ci.id`, status, instagram_handle, physical_delivery, delivery_address).

## Non-functional
- Additive, low-risk: a read-only overview + a deep-link; no change to the influencers
  page or the production actions.

## Design reference
`04-preview/mockups/command-center.html` — Production as a hub stage.
