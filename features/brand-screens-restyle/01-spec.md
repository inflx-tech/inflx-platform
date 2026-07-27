# Feature Spec — Brand screen-body restyle (Home body, Campaign list, Campaign detail)

> Completes the brand mobile IG-clean pass started by the tab bar (v160) and the
> Home quick-actions.

## Problem / goal
Three brand screens still carried the old visual language: **decorative yellow corner
blobs** (Home wallet card, Campaign-detail summary card) and **text-glyph icons** used as
iconography (`!` banners/action card, `·` empty states, `⊟ ★ ∼ ₹ ▶ ⊞` drill-down tiles).

## Scope
**In scope**
- Remove the 4 decorative yellow corner blobs (2 on Home, 2 on Campaign detail) and their styles.
- Replace 10 text-glyph icons with MCI vector icons:
  Home banner + action card (`alert-circle-outline`), Home + Campaign-list empty states
  (`inbox-outline` / `bullhorn-outline`), and the 6 Campaign-detail tiles (view-grid,
  account-multiple, chart-line, currency-inr, play-circle, cart).
- Remove the 5 now-dead `*IconGlyph` styles; add the missing Icon/ig imports.

**Out of scope** — the remaining brand screens (Wallet, Notifications, Profile, Contract,
drill-downs) keep their current look; semantic status colours are unchanged everywhere.

## Surfaces touched
- Mobile (brand) only — OTA. Presentation only; no data/navigation change.
