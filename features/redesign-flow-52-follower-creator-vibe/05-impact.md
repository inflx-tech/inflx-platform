# Flow 52 — Impact analysis (Creator Vibe follower redesign)

## Terse verdict (chat-level)
**Visual re-theme (cream/brown) + nav restructure + 2 new surfaces (Offers,
Creator's Category) + a gated new system (Reels).** Repaint flows are
visual/UX-only with zero functional change; the functional surface area is the
nav restructure and the 2 new screens. **Follower-scoped — brand-web and
mobile-brand are untouched.** One hard deploy fact: **Fraunces is a native font
→ APK rebuild** unless we accept a serif fallback (D1).

## Production-impacting? YES (mobile runtime). Surfaced for explicit go.

## Change classes
1. **Tokens (`theme/tokens.js`)** — ADDITIVE. New `creatorVibe` palette export +
   (if D1=Fraunces) `fonts.serifDisplay`. `brandPalette`/`lightColors`/`darkColors`
   NOT mutated → brand-web + mobile-brand + any non-migrated screen unaffected.
   Risk: LOW (additive).
2. **Nav (`FollowerNavigator.js`)** — STRUCTURAL. 4→5 tabs, custom center Reels
   FAB, tab rename (Deals→Offers, MyStuff→Orders, Me→Profile). Audit result: no
   screen navigates to a tab by name; only the navigator references them. All
   existing stack screens must be re-parented under the new tabs (Find, SavedList,
   OrderHistory, OrderDetail, Address, FollowedInfluencers, Wallet, +SHARED_SCREENS).
   Risk: MEDIUM — a dropped stack screen = a dead route. Mitigated by porting
   `SHARED_SCREENS` verbatim and a route-presence test.
3. **Repaint screens (1,2,3,4b,5,O)** — visual only. Swap palette tokens + font;
   preserve every API call, `availing_modes` dispatch, 4-ID tracking, discount
   math, nav. Risk: LOW per-screen (mirrors Flows 38–51 method: token swap +
   integrity grep for 0 orphaned old tokens + preserved logic markers).
4. **New screen 4a (`CreatorCategoryScreen`)** — NEW. Creator-scoped product grid.
   Reuses existing `getStoreProducts`/`getStore` data filtered by category; new
   route in the Creators/Home stack. Risk: MEDIUM (new data-wiring, but on
   existing endpoints — no backend change).
5. **Offers (`DealsScreen`)** — repaint + restructure into by-category sections
   with creator-backed deal cards. Uses existing deals/offers data (offers already
   carry the backing influencer for attribution). Risk: LOW–MEDIUM.
6. **Reels (52.8)** — NEW SYSTEM. Needs: video hosting (R2), a `reels` table with
   a reel→entity tag (product/brand/offer id) + creator iid for attribution, a
   feed endpoint, and a player screen. **Backend + native (video player) — its own
   contract, own deploy (Render + APK).** NOT in the repaint OTA train.

## Deploy
- **Repaint + nav + Offers + Creator's Category:** pure JS → ship via **OTA ×3**
  (`publish-ota:all`; brand/influencer/follower share the bundle — no brand/
  influencer-screen change). Per OTA strategy: single `publish-ota:all` process.
- **Fraunces (D1=bundle):** `react-native.config.js` already auto-links
  `src/assets/fonts/`; adding `Fraunces-*.ttf` requires `react-native-asset` +
  **a new APK build + store/side-load distribution.** This is the ONLY native
  blocker. D1=fallback avoids it entirely (headings use a system serif, ships OTA).
- **Reels (52.8):** Render backend deploy + APK (video player native dep).
- No DB migration for repaint flows. Reels needs a migration (52.8).

## Test strategy (per Flow 49 precedent)
- `pnpm qa` — 76 web Playwright; mobile-only change ⇒ must stay GREEN (proves
  zero web regression).
- `pnpm qa:db` — informational lane, not a gate.
- Per screen: **babel transform** via Mobile metro preset (compiles) + **integrity
  grep** (0 orphaned old-palette tokens; all API/dispatch/tracking/discount markers
  present and unchanged).
- **Maestro mobile E2E** (`pnpm qa:maestro`) — the [ENFORCED] mobile-verify gate;
  `release.maestro_green` required to flip `released=true` on a
  `Packages/Mobile/src/**` commit.
- Founder physical APK smoke-test for deep data-gated screens (as Flow 49).
- **06-diff/notes.md** before/after — required gate before prod deploy.

## Rollback
OTA flows: revert to prior bundle version (follower last = v62, Flow 49). Native
(Fraunces/Reels): previous APK. No data migration on repaint ⇒ clean rollback.

## Net
Big *visual* surface, small *functional* surface (nav + 2 screens), all
follower-scoped, all OTA-able **except** Fraunces (D1) and Reels (52.8, gated).
