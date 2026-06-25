# 06 — Before/After · App Builder (Phase 2)

Before: two admin pages, two models — App Sections (screen tabs incl. Offers +
a global/city/vertical "scope_type" selector that collided with the founder's
mental "scope") and a separate Home Builder (worlds + tiles). Home not
arrangeable from App Sections. Follower app had an Offers bottom tab.

After (admin-web): one **App Builder** page —
- **1 · Scope** buttons: Home / Creator Store / Business page (Offers dropped),
  mapped to screens category / creator_category / business; all per-world.
- **2 · World** pills (food/fashion/furniture/beauty/car_rental), hidden worlds
  shown struck-through; **⚙ Manage worlds** panel absorbs Home Builder
  (reorder · show/hide · rename via the home-verticals API).
- **3 · Sections** — the existing add/reorder/sticky/Template+Rule/Publish list.
- Nav: "App Sections" → "App Builder"; **Home Builder link removed** (absorbed).

After (mobile): the **Offers bottom tab + DealsScreen deleted** (founder — not
required); SavedScreen "Browse" now routes Home.

Verify: brand-web next build exit 0; metro bundle compiles; mobile jest 20/20
(only the known FollowerWallet transform fails, pre-existing); pnpm qa GREEN(79).
Deploys: admin → Vercel, mobile → OTA. No migration (Phase 1 added scopes).
