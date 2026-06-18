# 03 — Expected outputs

## Visual
- Account/Profile screen matches `04-preview/mockups/account-recolored.html`: gold/cream,
  profile card (avatar+name+phone+city), stats row, gold wallet card **with faint 💰
  watermark**, dashed-gold Refer & Earn, menu rows, terracotta LOG OUT.
- No white-on-gold; ink-on-gold throughout (already true; preserved).

## Functional (must remain true)
- All existing handlers/data unchanged (getMe, stats, wallet, logout flow).
- **Returns row now opens `MyReturns`** (the returns list), NOT OrderHistory.
- `MyReturns` reachable from ProfileStack without crash (no duplicate route name).
- Every other menu row unchanged.

## Guardrails
- No backend/API/migration. No downgrade to the bare source screen 12 (wallet/stats/
  refer retained). Watermark is decorative only (`pointerEvents="none"`).
