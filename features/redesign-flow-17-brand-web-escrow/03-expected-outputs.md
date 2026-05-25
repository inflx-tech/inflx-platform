# Flow 17 · expected outputs

## State 1 · Normal data view
- Crumb: `/dashboard / campaigns / {name} / escrow`
- Count chip: "{tranche total} tranches across {influencer count} influencers"
- Outfit H1 "Escrow Breakdown" + yellow rule + campaign.name sub
- INK 4-KPI hero: Total · Locked yellow · Released green (light) · Queued info (light) — all mono
- Per-influencer cards stack: header (handle + fullname + tranche count) + tranche rows (status icon + Outfit N + mono meta + mono amount + status pill)

## State 2 · Conversion-only campaign
- Same header (but count chip = "No tranches")
- Yellow-pale gradient notice card with 💸 + Outfit "No escrow for conversion campaigns" + body + "Open Conversions tab →" mono yellow link

## State 3 · Empty (no entries yet)
- Same header (count chip = "0 tranches")
- Yellow-pale gradient empty card with 🔒 + Outfit "No escrow entries yet" + sub

## Cross-state invariants
- All scoped under .esc wrapper
- All numbers / dates in JetBrains Mono
- All hover/disabled re-asserts color/locks bg+color
- 3 status palette mappings: queued=yellow-pale, locked=info-pale, released=success-pale
