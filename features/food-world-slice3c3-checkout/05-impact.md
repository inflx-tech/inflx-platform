# 05 — Impact
Mobile-only, OTA. New: CustomiseSheet + DishDetailSheet components; RestaurantDetailScreen
reskin + unify to CartContext (carry variation/addons/note). No backend/migration.
Risk: cart unification (local→global) — covered by tests + the existing replace-cart
guard. PRODUCTION-IMPACTING (OTA) — surfaced for go.
