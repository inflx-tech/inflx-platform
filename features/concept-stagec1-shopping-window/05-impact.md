# Impact — concept-stagec1-shopping-window

**Verdict: production-impacting (mobile OTA only). No backend, no migration,
no web. One shared-component behaviour change, scoped.**

- PostViewerScreen fully rewritten (immersive); PostProductScreen new;
  ShopThisPostSheet rewritten (grid + quick-add) with a SIGNATURE change
  (navigation → onOpenProduct) — both callers (viewer, feed) updated in the
  same commit; no other consumers exist.
- Cart: uses the existing addItem with cartKind 'shop' (multi-brand path,
  no cross-brand prompt) + claim from post tracking — no CartContext edits.
- Legacy ProductDetailScreen untouched — old-app entries unaffected.
- Follow pill uses idempotent follow/unfollow; initial state defaults to
  "Follow" (detail payload doesn't carry followed yet — cosmetic; noted for
  a later payload addition).
- Rollback = previous OTA bundle.
