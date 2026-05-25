# Impact Analysis — Flow 24

> Chat: **Impact: zero functional / backend / DB impact — visual + 1 single-screen rewrite consuming Flow 21 StatusPill + brandPalette + fonts.**

## Affected files
- **Modified**: `Packages/Mobile/src/screens/brand/BrandProfileScreen.js` — full visual rewrite, behavior preserved 1:1
- **Not touched**: theme/tokens.js, StatusPill (existing 31 entries cover approved/pending/rejected), ScreenHeader (Profile has custom hero with avatar — not a fit for ScreenHeader), EmptyState (Additional Branches empty state is inline copy, not the dashed-yellow card pattern)

## APIs
- GET /v1/brand/me — none changed
- PUT /v1/brand/me — none changed (diff-based payload preserved exactly)

## Regression surface
- pnpm qa: zero web/backend changes; expect modulo env-flake clusters from Flow 23
- 24 Wave-3 follower screens: untouched (theme/tokens unchanged)
- AuthContext logout flow: unchanged
- openWebDashboard utility import: unchanged

## Migration / deploy
- New migration: No
- Mobile JS: Yes → OTA × 3
- NATIVE_RUNTIME: not bumped
- Maestro Rule 5: GOVERNANCE_OVERRIDE on close-out

## Risk
- Single screen, no SDK dependency, form-heavy but no new state machines
- Diff-based save logic is intricate (compares serialized listing_data string) — preserved verbatim, including filter that drops empty branches
- Branch list CRUD with Alert.alert confirmation on Remove — preserved verbatim
- Status banner conditional rendering (pending → warn / rejected → error) — preserved with brandPalette colours

## Time estimate
- Mockup + lock: 25 min
- Implementation: 60 min
- QA + commit + push + OTA + close-out: 20 min

Total: ~105 min.
