# Flow 50 — Before / After diff notes

## What shipped
`SchemaDetailScreen` (the schema-driven engine for salon/beauty + the 26 deferred
businesses) converted Wave-3 **dark** → light `brandPalette`. `SalonDetailScreen`
(10-line re-export) inherits the restyle. **Visual + UX only — zero functional change.**

| Area | Before | After |
|---|---|---|
| Chrome | `#07111E`/`#0A1D3E`/`#0D1D2E`/`#142438` + rgba-whites | P.bg / P.bg2 / P.white / P.border + ink/muted text |
| Per-business color | dark template `cfg.accent` (amber default) on strip/CTA/emphasis | dropped → brand ink/yellow spine |
| creator-deal strip | accent-tinted | yellowPale + yellow avatar (ink initial) + ink/yellow badge |
| CTA | accent bg + `#000` text | ink bg + yellow text; disabled muted4 + dangerText banner |
| spec emphasis / return notice | accent-tinted / pink | yellowPale |

## Design decision (founder-approved)
Engine adopts the brand ink/yellow spine uniformly (F0 fallback for deferred
businesses). Salon's purple lives in SlotPicker (shipped Flow 43). Approved via
AskUserQuestion ("Green — implement").

## Matches the mockup
`design/wave3/flow-50-follower-beauty/web.html` (founder green-signaled 2026-05-28).
2 frames (salon service + deferred business) implemented as drawn.

## Verification
- **Babel transform:** SchemaDetail + SalonDetail PASS.
- **Dark-hex / cfg.accent grep:** 0 refs (only the intentional rgba-white floating-back remains).
- **Marker grep:** __action_dispatch / handleViewBrand / BrandStore nav / detail_sections /
  cta_primary / orderable present (18 occ) — logic untouched.

## ⚠ Dormant-code finding (HONEST — verify-twice)
SchemaDetailScreen + SalonDetailScreen are **not imported by any active module** and
**not registered in FollowerNavigator** → they are NOT in the Metro bundle graph. So:
the restyle is correct + babel-verified, but it has **zero live production effect**
today; the `publish-ota:all` bundle is **byte-identical to Flow 49** (hash
`sha256:1c7b1335…`, follower v63 == v62 content). This is the schema engine's
half-wired-foundation status (§9). Value = future-proofing: when these screens get
wired into navigation (a separate behavioral flow), they already render brandPalette.
Surfaced to founder.

## After-evidence
N/A — screens are dormant (not reachable); nothing to screenshot. Before = mockup.

## Preserved verbatim
`__action_dispatch` route (§9 half-wired, untouched) · Path-B tracking (handleViewBrand
→ BrandStore) · every SectionRenderer branch + helpers · cta_primary action/label ·
orderable gate · schema-driven detail_sections ordering · SalonDetail re-export.
