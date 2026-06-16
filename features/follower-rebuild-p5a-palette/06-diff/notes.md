# 06-diff notes — Phase 5a (gold/cream palette foundation)

Built to the founder's recolored mockups (04-preview/mockups/home-creator-recolored.html).

## What was implemented
- **`theme/tokens.js` creatorVibe** (follower-scoped) retuned:
  - `brown` #8B4A2F → **#F6B11E (gold)**; `brownDark` → #E8A200; surfaces → white/cream
    (screenBg #F7F4EC, soft #FBF1D9); `ink` #1A1A1A; `muted` #6B6B6B; `line` #EBE3D2;
    `offer` → **#D9663C (terracotta, sale only)**; story rings → gold; added
    `gold`/`goldDeep`/`cream`/`onGold` aliases. (Key `brown` kept — value now gold — to avoid
    touching 150+ call sites; all accent/text usages become gold automatically.)
- **Text-on-gold → ink** (`onGold`) on shared + Home-reachable gold backgrounds:
  SectionRenderer hero (label/title/discount), Reels FAB (icon + label), RankBadge,
  StoryCircle follow pill, ProductDetail primary CTA, InfluencerStore follow button.

## Mockup → build: matches
- Gold primary, cream/white canvas, ink text, terracotta sale, serif hero — matches the
  recolored mockup's palette (gold #F6B11E + cream + ink + gold-button-with-ink-text).

## Known not-yet-swept (intentional — handled in each screen's flow)
A few gold backgrounds on NON-Home screens still carry white text until their flow polishes them:
Deals tab active chips/pills, Me wallet card + buttons, Restaurant-detail action button,
Order-history active tabs, Category/CreatorCategory active chips, ErrorBoundary button,
HomeScreenV2 misc circle, ProductDetail toggle. Listed so it's not mistaken for "done".

## What to check in prod (founder)
- Home: gold/cream/ink look + serif hero; gold buttons have dark (ink) text, not white.
- Tap a product → ProductDetail CTA ink-on-gold; tap a creator → follow button ink-on-gold.
- Flag any remaining white-on-gold you spot on deeper screens — those get swept in their flow.
