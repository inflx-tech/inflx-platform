import { creatorVibe as C, getBusinessAccentLight } from '../../theme/tokens';

/**
 * vibe/palette — derive a card's warm 2-stop gradient + emoji from a brand
 * category, so deal/feature/hero backgrounds are data-driven (no per-item magic
 * colours) and OTA-safe (consumed by the pure-JS <Gradient> primitive).
 *
 * gradientFor → [paleStop, accentStop] (light→saturated, so white overlay text
 * stays legible on the saturated end). emojiFor → category glyph fallback.
 */

// Warm fallback pair (terracotta family) for categories without a focus accent.
const FALLBACK = ['#F3D9A8', '#C87A3C'];

export function gradientFor(category) {
  const cfg = getBusinessAccentLight(category);
  // focus verticals (restaurant/fashion/salon/car…) get pale→accent;
  // everything else falls back to the warm terracotta pair.
  if (cfg && cfg.pale && cfg.accent && cfg.pale !== undefined) {
    if (cfg.accent === C.brown || cfg.accent === '#6B5A00') return FALLBACK; // yellow-family fallback → warm
    return [cfg.pale, cfg.accent];
  }
  return FALLBACK;
}

export function emojiFor(category) {
  return getBusinessAccentLight(category).icon || '🏪';
}

// Story ring (creator-vibe signature) — coral → amber.
export const RING = [C.ring1, C.ring2];
