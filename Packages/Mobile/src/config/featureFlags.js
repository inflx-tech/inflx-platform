/**
 * featureFlags.js — runtime feature toggles for the follower app.
 *
 * Flags default to the SAFE (current-behavior) value so shipping new code is
 * inert until a flag is deliberately flipped. Flip = a code change + OTA, gated
 * by the contract's release step (before/after-diff + Maestro + founder go).
 *
 * SECTION_ENGINE_HOME — when true, HomeScreenV2 renders from the backend
 *   { sections:[…] } payload (GET /v1/follower/home) via <SectionRenderer>
 *   instead of the hardcoded feed. Default false (old hardcoded Home).
 *   Contract: features/follower-section-home/.
 */

export const FEATURE_FLAGS = {
  SECTION_ENGINE_HOME: false,
  // Creator Store + Creator's Category render from the section engine when on.
  // Default false (existing layouts).
  SECTION_ENGINE_CREATOR: false,
  // Category screen (per-vertical) from GET /v1/follower/section/category/:key.
  SECTION_ENGINE_CATEGORY: false,
  // Offers tab from GET /v1/follower/section/offers.
  SECTION_ENGINE_OFFERS: false,
};

export function isEnabled(flag) {
  return FEATURE_FLAGS[flag] === true;
}

export default FEATURE_FLAGS;
