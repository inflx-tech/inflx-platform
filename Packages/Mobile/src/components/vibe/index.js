/**
 * vibe — mockup-accurate follower card kit (Phase 0 of the follower-app rebuild).
 *
 * The shared component library every follower discovery screen (Home, Category,
 * Offers, Creator Store, Creator's Category) renders its admin-controlled shelves
 * with, matching the agreed Creator-Vibe comprehensive mockups
 * (design/wave4-creator-vibe/*-comprehensive.html). Pure JS / OTA-safe (gradients
 * via the in-house <Gradient> primitive — no native dep). Consumes the existing
 * section-engine item shapes; no backend change. Backend-first: no fabricated
 * rating/distance. Contract: features/follower-card-foundation/.
 *
 * Usage:
 *   import { ShelfHeader, StoryRail, CategoryRail, DealCard } from '@/components/vibe';
 */

export { default as Gradient }         from './Gradient';
export { default as ShelfHeader }      from './ShelfHeader';
export { default as StoryCircle, StoryRail }       from './StoryCircle';
export { default as CategoryCircle, CategoryRail } from './CategoryCircle';
export { default as FeatureCard }      from './FeatureCard';
export { default as DealCard }         from './DealCard';
export { default as ShelfProductCard } from './ShelfProductCard';
export { default as ShelfBrandCard }   from './ShelfBrandCard';
export { default as ShelfBrandListRow } from './ShelfBrandListRow';
export { default as ViaCreatorChip }   from './ViaCreatorChip';
export { default as RankBadge }        from './RankBadge';
export { gradientFor, emojiFor, RING } from './palette';
