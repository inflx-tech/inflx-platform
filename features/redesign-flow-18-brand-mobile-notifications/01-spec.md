# Feature Spec — Flow 18 · brand-mobile notifications surface

> First flow of the mobile-brand bucket. Brand-web bucket completed 2026-05-25 (Flows 1-17 live on prod). Mobile sequence per locked roadmap: brand → influencer → follower mobile. Admin web deferred.

## Problem / goal

The mobile brand notifications screen (`BrandNotificationsScreen.js`) currently uses the navy-based legacy `colors` palette from `theme/tokens.js`. It is visually inconsistent with the locked palette adopted across the 17 brand-web flows shipped this wave (yellow `#FFC107` + ink `#0A0A0A` + Outfit/PJS/JetBrains-Mono fonts). Bring it to parity so a brand opening the mobile app sees the same brand identity as the brand-web dashboard.

This is also the **rhythm-validating first mobile flow** for the bucket. Choices made here (palette source, OTA ceremony, Maestro posture) become the pattern for Flows 19-33.

## Scope

**In scope:**
- Visual rewrite of `Packages/Mobile/src/screens/brand/BrandNotificationsScreen.js` to consume the locked palette
- New `brandPalette` export added to `Packages/Mobile/src/theme/tokens.js` (8 hex + extensions: yellow, yellow_pale, ink, muted ladder, status pales, font aliases)
- Preserve all behavior 1:1: API calls, `routeNotification()` data-driven nav, all 14 `TYPE_ICONS`, optimistic mark-read, empty state, pull-to-refresh
- Type-coloured avatar tiles per notification kind (mirrors Flow 15 brand-web pattern)
- Relative-date timestamps via inline helper (mirrors Flows 10/11/12/13/15 web pattern)

**Explicitly out of scope:**
- All other 15 remaining mobile-brand screens (separate flows 19-33)
- Touching legacy `colors`, `lightColors`, or `darkColors` exports (preserves 24 Wave-3 follower/restaurant screens currently consuming them — verify-twice grep confirmed zero brand-bucket usage of `lightColors`)
- Adding a per-notification mark-read endpoint (backend doesn't expose one yet; preserves current optimistic-local pattern)
- Maestro setup itself (will be its own contract; this flow ships with `GOVERNANCE_OVERRIDE`)

## Surfaces touched

- **App(s)**: mobile-brand (the BrandNotificationsScreen.js file) + mobile-shared (theme/tokens.js, additive change only)
- **Roles involved**: brand (no influencer / follower / admin affected — but the shared `theme/tokens.js` is consumed by all 3 audiences, so the additive `brandPalette` export ships to all 3 bundles)

## Data / contracts

- **New or changed tables / columns / migrations**: none
- **New or changed API endpoints**: none — consumes existing `GET /v1/notifications` + `POST /v1/notifications/mark-all-read` from `brandApi`
- **Money/units, attribution IDs, status machines**: none affected

## Non-functional

- **Auth/role gates**: unchanged — screen sits behind the brand-app role-routed entry, no new gate
- **Failure modes the feature must handle**:
  - Empty list (no notifications) → empty-card state with [BELL] placeholder
  - Network failure on initial load → silent (existing behaviour: ActivityIndicator clears, list stays empty until pull-to-refresh)
  - Unknown `data.screen` value → notification renders without "tap to open" hint and is non-interactive (preserved)
  - Mark-all-read API failure → optimistic UI is NOT reverted (preserved current behaviour)
