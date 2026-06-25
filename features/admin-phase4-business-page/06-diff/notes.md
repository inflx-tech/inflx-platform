# 06 — Before/After · Food business page as sections
Before: RestaurantDetailScreen rendered a hardcoded header + menu; no way to
compose extra sections per business; no 'business' section consumer.

After: the screen fetches the admin-composed business stack (GET
/follower/business/:id/sections) and renders header spine + the stack — Menu
(food section) + any admin sections (creator carousel auto-scoped to the brand,
offers, banner, related). Admin composes via App Builder → Business page → Food;
the 'Menu (food)' preset appears only there (vertical-aware). Uncomposed →
Menu-only (today's look).

Verify: brand-web build exit 0; metro bundle compiles; mobile jest 20/20; pnpm
qa GREEN(79); business build executes on DB. backend+admin+mobile OTA, no migration.
