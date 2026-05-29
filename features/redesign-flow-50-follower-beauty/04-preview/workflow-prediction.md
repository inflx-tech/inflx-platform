# Flow 50 — Workflow prediction (pre-implementation)

## What the user sees
Opening a salon service (SalonDetail → SchemaDetail) or any deferred-business listing:

1. bg2 hero (item image or icon) + floating back.
2. Outfit title + mono subtitle; yellowText "View {brand} →" (Path-B tracking forward).
3. yellowPale creator-deal strip ("X's deal" + @handle + ink/yellow discount badge)
   when an influencer attribution is present.
4. Schema-driven sections in template order: About (description), At-a-glance
   (spec_grid with a yellowPale emphasized field), Inclusions (feature_chips),
   Before/After (gallery), variant_selector / return_policy_notice as configured.
5. Sticky ink/yellow CTA with the template's `cta_primary.label` (e.g. "Book Slot",
   "Enquire") → `handlePrimary` → `__action_dispatch` (the parent action dispatcher).
   When `orderable === false`: muted4 disabled CTA + dangerText unavailable banner.

## No behavioural change
The engine still reads `template.card_config.detail_sections`, renders the same
section types, forwards Path-B tracking, and dispatches the same `cta_primary.action`.
Only colors/fonts shift (dark→light brandPalette), and the per-business color becomes
the brand ink/yellow spine.
