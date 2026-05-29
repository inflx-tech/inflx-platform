# Flow 49 — Expected outputs

## Visual end state
- **ProductDetail** — fashion-pale hero tint + ink/yellow discount badge · Outfit
  name + muted brand row · ink creator-note bar (yellow attribution + yellowPale
  quote) · ink-mono price + muted3 MRP strike + successText "You save" · ink-outline
  secondary CTAs · fashion-pale "More from brand" tiles (ink-mono price) · sticky
  ink/yellow primary CTA.
- **LookbookDetail** — fashion-pale cover tint · white creator card (yellow avatar +
  ink initial, mono handle) + bg2 "Visit store" · Outfit title + muted desc + mono
  meta · 2-col grid (white cards, fashion-pale image tint, ink variant badge,
  ink-mono price, yellowPale creator-note w/ yellow left-border).

## Functional end state (UNCHANGED)
availing_modes CTA dispatch + category-aware verbs, dispatchCta nav with 4-ID
tracking, discount math + price computation, getStoreProducts/getLookbook, "More from
brand" replace-nav, lookbook openProduct creator-tracking — all identical.

## QA gate
`pnpm qa` → **76 passed, gate 0, STATE=GREEN**. JS-only; OTA (NATIVE_RUNTIME=2), no
native rebuild.

## Deploy
`pnpm publish-ota:all` → brand v99 / influencer v88 / follower v62 (shared bundle).
production-impacting (follower OTA serves the 2 restyled fashion screens).
