# Before / After — A4 fold Sets + Escrow into the hub

**Before:** money/payout lived on a standalone `/escrow` route (3.8 kB, scoped `.esc` CSS
outlier) and the set rollup on a standalone `/sets` route (2.9 kB) — both a click away from
the campaign. The hub only showed a tiny escrow summary in the header strip with a "detail ↗"
link OUT to /escrow.

**After:** a hub **Payout** tab (new `PayoutSection.js`, IG-clean) shows total escrowed /
locked / released / queued + each influencer's tranche breakdown — self-fetching the rich
shape via `brandApi.getCampaignEscrow` (same call /escrow used). The header "detail ↗" and
the completed-stage PrimeBar CTA now open the Payout tab. `/escrow` → redirect to
`?tab=payout` (520 B stub); `/sets` → redirect to the hub (505 B stub); the "create first
set" link → the campaign wizard (where sets are actually created).

## Changed
- New `PayoutSection.js`.
- `[id]/page.js`: import + Payout tab (array + body); `?tab=` deep-link generalized to
  accept `payout`; header escrow "detail" → `setTab('payout')`; "create first set" →
  `campaigns/new?id=`.
- `CommandRail.js`: completed-stage CTA → Payout tab (was /escrow href).
- `escrow/page.js` + `sets/page.js` → redirect stubs.

## Verification
- **`next build` compiled clean** (77 pages); `/escrow` 3.8kB→520 B, `/sets` 2.9kB→505 B
  (redirect stubs) — confirms both routes retired.
- **Pending (web verify):** founder on Vercel — Payout tab shows tranches; old /escrow +
  /sets URLs redirect; set creation still works via the wizard.

## Known delta
- Payout is a hub TAB (not the mockup's right-rail money panel) — same data, one place.
  /sets rollup is now the Hierarchy (grouped by set); creation stays in campaigns/new.
