# Flow 52 — Follower "Creator Vibe" redesign (program contract)

## Goal
Re-theme the follower app from the **F0 light yellow/ink palette** (shipped
Flows 38–51) to the **"Creator Vibe" cream + terracotta-brown** language,
restructure the bottom nav, add two new surfaces (**Offers**, **Creator's
Category**), and introduce **shoppable Reels** (gated — own contract).

Mockup (founder-reviewed in chat across many turns):
`04-preview/mockups/all-screens.html` (8 phones).

## Design language (new)
- Palette: cream `#F7F3EC` · card `#FFFFFF` · terracotta-brown `#8B4A2F`/`#6E3A24`
  · ink `#1C1A17` · muted `#8A8275` · line `#ECE6DC` · offer `#D9531E` · star
  `#F2A93B` · verify `#2D9CDB`. Creator-ring gradient `#FF6A5F→#FFB24C`.
- Type: **Fraunces** (serif display) + **Plus Jakarta Sans** (body). Jakarta
  already bundled; **Fraunces is NEW → native font asset → APK rebuild** (see
  05-impact §Deploy). *Open decision D1.*
- Scope: **follower app only.** Brand-web + mobile-brand keep the locked
  yellow-ink `brandPalette`. New palette ships as a **separate token block**
  (`creatorVibe`) — `brandPalette` is NOT mutated.

## Bottom nav (4 → 5)
Today: HOME · DEALS · MY STUFF · ME (`FollowerNavigator.js`).
New: **🏠 Home · 🏷️ Offers · 🎬 Reels (center) · 🛍️ Orders · 👤 Profile**.
- Offers = `DealsScreen` elevated (platform-wide, by-category, creator-backed).
- Reels = NEW center tab (video). **Gated** behind its own contract (backend).
- Orders = OrderHistory/OrderDetail (from MyStuff).
- Profile = `MeScreen`; Saved folds in (MeScreen already has 'SavedList').
- Audit: only `FollowerNavigator.js` references the tab names; no screen
  navigates to a tab by name. Stack screens (Find, SavedList, OrderHistory,
  InfluencerStore, BrandStore, ProductDetail, Cart/PayAtStore/PreBook/…) must be
  preserved under the new tab stacks.

## Screen → file map (8 surfaces)
| # | Mockup screen | Real file | Type |
|---|---|---|---|
| 1 | Global Home | `HomeScreenV2.js` | repaint |
| 2 | Category (Global) | `CategoryListScreen.js` (+ `DiningHomeScreen.js`) | repaint + add Top-Creators rail + reels-fed picks |
| 3 | Creator Store | `InfluencerStoreScreen.js` | repaint + collab-business row + reels rail |
| 4a | Creator's Category | **NEW `CreatorCategoryScreen.js`** | new (creator-scoped product grid) |
| 4b | Business Page | `BrandStoreScreen.js` (+ `RestaurantDetailScreen.js`) | repaint; multi-mode CTA already exists |
| 5 | Product Detail | `ProductDetailScreen.js` | repaint + customize toggles + reels rail + creator-code card |
| O | Offers | `DealsScreen.js` | repaint + by-category sections + creator-backed deal cards |
| R | Shoppable Reels | **NEW `ReelsScreen.js` + backend** | NEW SYSTEM — gated (own contract) |

## CTA model (unchanged — schema-driven)
Business-driven off `availing_modes` via existing `dispatchCta`. No universal
cart. Food = pay-at-restaurant / pre-book / order-online · Salon = pay-at-store
/ pre-book · Fashion (single) = pay-at-store / order-online · Car+Bike = book.
**Zero commerce-backend change.**

## Sequencing (each = its own locked flow, deploy-after-each per the 5-step rhythm)
- **52.0 Foundation** — `creatorVibe` tokens + Fraunces + `FollowerNavigator`
  (5-tab + center Reels placeholder). [native rebuild if D1=Fraunces]
- **52.1 Global Home** → repaint `HomeScreenV2`
- **52.2 Offers** → elevate `DealsScreen`
- **52.3 Business Page** → repaint `BrandStoreScreen`
- **52.4 Product Detail** → repaint + toggles/code/reels-rail `ProductDetailScreen`
- **52.5 Creator Store** → repaint `InfluencerStoreScreen`
- **52.6 Category** → repaint `CategoryListScreen`
- **52.7 Creator's Category** → NEW `CreatorCategoryScreen`
- **52.8 Reels** → NEW screen + backend (SEPARATE, backend-gated). *Open D2.*

## Open decisions (block Step-5 lock)
- **D1 — Fraunces:** bundle the serif font (→ APK rebuild, not OTA) **or** use an
  OTA-safe system-serif fallback for headings (stays JS-only, ships via OTA)?
- **D2 — Reels:** confirm deferred to its own backend contract (52.8), so the
  repaint flows ship OTA-only without waiting on video infra?

## Non-negotiable (preserve verbatim per screen — detail in 05-impact)
All API calls (`getHomeFeed`/`getStories`/`getCategories`/`getStore`/
`getBrandStore`/`getStoreProducts`/`getCategoryStores`/deals), `availing_modes`
CTA dispatch + 4-ID tracking, discount math, navigation graph. **Visual + UX
only on repaint flows; functional change limited to nav restructure + 2 new
surfaces.**
