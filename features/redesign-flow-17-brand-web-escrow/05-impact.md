# Flow 17 · impact

**Terse verdict:** zero functional / backend / logic / DB impact — visual + UX only.

## Files

| File | LOC |
|---|---:|
| `Packages/brand-web/app/dashboard/campaigns/[id]/escrow/page.js` | 155 → ~260 |
| `design/wave2/flow-17.../web.html` | +292 |
| contract artifacts | +300 |

## NO-TOUCH preserved
- `backend/**`
- `lib/api.js` (brandApi.getCampaignEscrow consumed as-is)
- All view states preserved (loading/error/conversion-only/empty/normal)

## What changes
- Undefined Tailwind tokens (text-t1/t2/t3, border-border, bg-orange-50, text-yellow-600/blue-700/emerald-600, status bg variants) → palette CSS vars
- Multi-color status mappings → palette (queued=yellow-pale, locked=info-pale, released=success-pale)
- 4 white summary cards → INK 4-KPI hero with mono numbers (yellow Locked + light green/info accents for Released/Queued)
- Bordered per-influencer cards → palette cards with mono tranche count + Outfit handle header
- Orange conversion-only notice → yellow-pale gradient notice with palette CTA link
- Loading "Loading..." text + bordered error card → palette spinner + palette error band
- Empty "No escrow entries" → yellow-pale gradient empty card

## Scope correction
- Handoff §11 mentioned `/waiting` but route doesn't exist. Flow 17 = single escrow page only.
- /billing + /subscription are 6-LOC server redirects (Window A's Phase A9). No restyle needed.

## After Flow 17 ships
- **Brand-web bucket COMPLETE** per handoff §5 locked sequence
- Next bucket: **mobile brand** (`Packages/Mobile/src/screens/brand/**`)

## Deploy class
**production-impacting** — Vercel auto-deploys brand-web. `release.maestro_green = "n/a"`.
