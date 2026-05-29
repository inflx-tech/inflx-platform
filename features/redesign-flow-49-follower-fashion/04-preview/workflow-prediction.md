# Flow 49 — Workflow prediction (pre-implementation)

## ProductDetail
1. Tap a fashion product (creator store / deals / category / home) → ProductDetail.
2. Fashion-pale hero with the product image + ink/yellow discount badge; Outfit name;
   muted "from {brand}" row → BrandStore.
3. Creator's take in an ink note-bar (yellow attribution). Ink-mono price + struck MRP
   + successText savings. Description.
4. `availing_modes` drive the CTAs: primary (ink/yellow sticky footer — Buy/Pay/Book/
   Enquire by category) + ink-outline secondaries. "More from brand" horizontal tiles.
5. `dispatchCta` routes to OnlineOrder/PayAtStore/PreBook/Enquiry with 4-ID tracking.

## LookbookDetail
1. Open a creator lookbook → fashion-pale cover.
2. White creator card (yellow avatar) + "Visit store" → InfluencerStore.
3. Title/description/meta; 2-col product grid — each card: fashion-pale image tint,
   ink variant badge, ink-mono price, yellowPale creator-note ("wearing M in this").
4. Tap a product → BrandStore with creator-attribution tracking (credits the curator).

## No behavioural change
Every CTA dispatch, API call, tracking field, discount calc, and nav is identical to
today — only colors/fonts shift (dark→light brandPalette), and the per-business accent
moves from CTAs/prices to hero/image tints per the F0 rule.
