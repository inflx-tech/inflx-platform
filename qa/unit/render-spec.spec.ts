import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: Phase 4a — Adaptive Renderer decision logic (pure-calc L1).
 * Contract: features/adaptive-renderer/.
 *
 * Locks the invariants of resolveSlots + pickFeatured in
 * backend/src/services/renderSpec.service.js. No DB, no network, no app —
 * the module is dependency-free. A change to slot resolution or aspect
 * picking fails this loudly.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rs = require('../../backend/src/services/renderSpec.service');
const { pickFeatured, resolveSlots, SAMPLE_PACK } = rs;

const HERO = { required: ['background', 'featured_image', 'title'], optional: ['subtitle', 'cta', 'offer_badge', 'avatar', 'creator_name'], hidden: ['products', 'price'] };
const STORY = { required: ['featured_image', 'avatar'], optional: ['title', 'offer_badge'], hidden: ['subtitle', 'cta', 'products', 'price'] };

const TOKENS = { palette: { accent: '#FFC400' }, typography: { family: 'Inter' }, background: { avg_color: '#3a3a3d' }, radius: 12, shadow: 'soft' };
const COPY = { title: 'Street Style', subtitle: 'Urban looks…', cta: 'Explore' };
const CTX = { pack: SAMPLE_PACK, tokens: TOKENS, copy: COPY };

test.describe('WORKFLOW: adaptive renderer decision logic', () => {
  test('pickFeatured chooses the image whose aspect fits the layout', () => {
    const imgs = SAMPLE_PACK.featured_images;
    expect(pickFeatured('16:9', imgs).aspect).toBe('landscape');
    expect(pickFeatured('9:16', imgs).aspect).toBe('portrait');
    expect(pickFeatured('1:1', imgs).aspect).toBe('square');
    expect(pickFeatured('4:5', imgs).aspect).toBe('portrait');
    expect(pickFeatured('flex', imgs).aspect).toBe('landscape'); // default
    expect(pickFeatured('16:9', [])).toBeNull();
    expect(pickFeatured('16:9', [{ url: 'x', aspect: 'square' }]).aspect).toBe('square'); // no match → first
  });

  test('required slots always visible, hidden slots never visible', () => {
    const r = resolveSlots(HERO, CTX);
    for (const s of HERO.required) expect(r.visible_slots).toContain(s);
    for (const s of HERO.hidden) expect(r.visible_slots).not.toContain(s);
    expect(r.blocked).toBe(false);
  });

  test('optional slots appear only when the pack carries their data', () => {
    const r = resolveSlots(STORY, CTX);
    // title + offer_badge are optional and present → visible
    expect(r.visible_slots).toContain('title');
    expect(r.visible_slots).toContain('offer_badge');
    // hidden dropped
    for (const s of STORY.hidden) expect(r.visible_slots).not.toContain(s);
  });

  test('a missing required slot blocks with a reason', () => {
    const packNoImg = { ...SAMPLE_PACK, featured_images: [] };
    const r = resolveSlots(HERO, { pack: packNoImg, tokens: TOKENS, copy: COPY });
    expect(r.blocked).toBe(true);
    expect(r.missing).toContain('featured_image');
  });
});
