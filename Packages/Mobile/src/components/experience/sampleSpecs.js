/**
 * sampleSpecs.js — bundled render specs for the Experience Preview (Phase 4b).
 *
 * These mirror the shape GET /v1/admin/experience-preview returns (resolved by
 * the 4a renderSpec.service). Bundled + offline so the preview screen and the
 * jest test render deterministically with no network/auth. Real specs are
 * fetched live once experiences exist (Phase 6). One theme (Street Style) across
 * four layouts — same pack, different contracts.
 */

const TOKENS = {
  palette: { primary: '#26262A', secondary: '#5F5E5A', accent: '#FFC400', bg: '#1C1C1E', text: '#FFFFFF' },
  typography: { family: 'Inter', weight: 800, spacing: '-0.02em' },
  background: { type: 'texture', avg_color: '#3a3a3d', asset_r2_key: null },
  radius: 12,
  shadow: 'soft',
};

const THEME = { key: 'street_style', name: 'Street Style', title: 'Street Style', subtitle: 'Urban looks curated for everyday confidence.', cta: 'Explore collection' };

const PACK = {
  creator_name: 'Rahul',
  avatar_url: '/media/sample/street/avatar.png',
  featured_images: [
    { url: '/media/sample/street/landscape.jpg', aspect: 'landscape' },
    { url: '/media/sample/street/portrait.jpg', aspect: 'portrait' },
    { url: '/media/sample/street/square.jpg', aspect: 'square' },
  ],
  offer_badge: '20% OFF',
  products: [{ name: 'Oversized Tee', price: 1299 }, { name: 'Sneakers', price: 2499 }],
};

const mk = (layout_key, aspect_hint, visible_slots, featuredAspect) => ({
  theme: THEME,
  design: { layout_key, aspect_hint },
  tokens: TOKENS,
  pack: PACK,
  resolved: {
    visible_slots,
    featured_pick: PACK.featured_images.find((i) => i.aspect === featuredAspect) || PACK.featured_images[0],
    blocked: false,
    missing: [],
  },
});

export const SAMPLE_SPECS = [
  { key: 'hero_banner', label: 'Hero', spec: mk('hero_banner', '16:9', ['background', 'featured_image', 'title', 'subtitle', 'cta', 'offer_badge', 'avatar', 'creator_name'], 'landscape') },
  { key: 'story_card', label: 'Story', spec: mk('story_card', '9:16', ['featured_image', 'avatar', 'title', 'offer_badge'], 'portrait') },
  { key: 'small_tile', label: 'Tile', spec: mk('small_tile', '1:1', ['featured_image', 'title', 'avatar'], 'square') },
  { key: 'magazine_card', label: 'Magazine', spec: mk('magazine_card', '4:5', ['background', 'featured_image', 'title', 'subtitle', 'creator_name', 'avatar'], 'portrait') },
];

export default SAMPLE_SPECS;
