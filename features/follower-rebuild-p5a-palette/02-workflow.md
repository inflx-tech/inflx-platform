# Workflow — Follower gold/cream palette foundation (Phase 5a)

1. Retune `theme/tokens.js` creatorVibe → gold/cream/ink/terracotta-sale + gold rings + aliases.
2. Flip text→ink on shared/Home-reachable gold backgrounds: SectionRenderer hero, Reels FAB,
   RankBadge, StoryCircle follow, ProductDetail primaryCta, InfluencerStore follow.
3. Verify: `pnpm qa` GREEN gate 0 (no backend/web change); mobile JS bundles at OTA.
4. Deploy (founder go): OTA follower bundle. released=false until visual verify on Home.

End state: the follower app reads gold/cream/ink everywhere; Home is the verification screen.
Home layout polish + remaining per-screen CTA sweeps follow (5b+).
