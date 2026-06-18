# 01 — Spec: Account / Profile (MeScreen) — verify + complete

**Slug:** `follower-rebuild-account`
**Track:** Follower visual rebuild (Creators Vibe Yellow). Last remaining screen.
**Governance class:** UI-governed + Mobile-governed. Mobile-only OTA. No backend/migration.

## Verify-twice finding (the honest scope)
`MeScreen.js` is **already rebuilt** to the Creators Vibe comprehensive profile mockup
(`design/wave4-creator-vibe/orders-profile-comprehensive.html`) and is already on the
**final gold palette** (5a/5f) — profile card · stats (Orders/Following/Saved) · gold
wallet card · Refer & Earn · menu rows · terracotta logout. It is **richer** than the
bare standalone source screen 12 (a flat row list). A "rebuild to source screen 12"
would be a DOWNGRADE (stripping wallet/stats/refer) — explicitly NOT done. This mirrors
the Brand Store (5e) verified-no-op precedent.

## Genuine completions delivered (the only real gaps)
1. **Returns row wiring (functional).** Today "Returns" navigates to `OrderHistory` —
   the **same screen as "My Orders"** (a dead duplicate). Root cause: `ProfileStack`
   does not spread `SHARED_SCREENS` and never registered `MyReturns`
   (`FollowerNavigator.js:136-149`). Fix: register `MyReturns` in `ProfileStack`
   (safe — not currently present, no duplicate-name crash risk per the navigator's
   own warning at :120-123) + point the Returns row at `navigate('MyReturns')`.
   `MyReturnsScreen` is self-contained (loads `listMyReturns()`, no required params,
   already Creator-Vibe themed).
2. **Wallet watermark (visual).** Add the comprehensive mockup's faint 💰 watermark
   (`.we`, ~54px, opacity .16, bottom-right) to the gold wallet card — the one visual
   element where code trailed the comprehensive mockup.

## Out of scope
Backend, follower endpoints, the "Settings & Help" placeholder (separate future),
other screens, the bare source screen 12 flat-list aesthetic (rejected as a downgrade).

## Reference
Mockup: `04-preview/mockups/account-recolored.html`. Source: comprehensive profile
mockup (above); standalone screen 12 for palette only.
