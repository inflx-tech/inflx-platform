# Before / After — A5 step 1: Production stage (visibility)

**Before:** physical logistics (store visit / product shipment / remote) had no home —
it was buried inside the ContractModal on the 1468-LOC influencers page. No way to see, at
a glance, who needs shipping or which visits are pending.

**After:** the campaign hub gets a **Production** tab (new `ProductionSection`) that lists
every active creator (contracted/active/live) with a logistics chip derived from
`physical_delivery`/`delivery_address` — Ship product (blue) · Store visit (yellow) ·
Remote (green) — and a **"Manage logistics →"** that opens the existing panel to schedule /
dispatch / flip-to-remote. Reads only the roster already in the hub payload.

## Changed
- New `ProductionSection.js`.
- `[id]/page.js`: import; Production tab entry; `?tab=production` deep-link; tab body.

## Verification
- **`next build` compiled clean** (77 pages).
- **Pending (web verify):** founder on Vercel — open the Production tab; each creator's
  logistics is visible; Manage logistics opens the panel.

## Known delta / deferred (honest)
- This is the **visibility half**. Inline scheduling/dispatch IN the hub needs a
  campaign-level production-list endpoint — **parked backend** (end-batch). The actual
  actions still run in the existing ProductionPanel (reached via Manage logistics).
- Splitting the 1468-LOC influencers page + folding the ContractModal into the hub are
  later A5 steps.
- Logistics chip depends on `physical_delivery` being in the detail payload; if absent the
  row still shows with a Manage-logistics link (graceful).
