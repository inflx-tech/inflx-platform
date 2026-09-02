'use strict';

/**
 * campaignChannels.js — what "which channels will she drive traffic on" means.
 * Contract: features/stage-2-build-a-campaign-from-the-phone (§5.3) · action ledger #69
 *
 * THE POINT OF THE FIELD
 * On a CONTENT set the brand buys labour, so it says what it is buying — that is
 * formats_json, and it already works. On a SALES set the creator only earns if she sells,
 * so dictating post counts is unfair and unenforceable. The question inverts: what reach
 * does she bring. This is the mirror of formats_json, on the same row.
 *
 * GUIDANCE, NOT A GATE. It blocks no invite, no publish and no sale. Everyone in the set
 * has already shaken hands; refusing to brief someone for being one channel short would
 * invalidate a negotiation both sides completed. The screen says so in words.
 *
 * ONE VOCABULARY, LIKE collabTerms.model
 * This lives in its own module rather than inside campaign.controller so that the phone,
 * the web wizard and any later reader all name the same channels. This programme has
 * already had to clean up two duplicated vocabularies (offer types written differently by
 * web and mobile, and a duplicated offer-type normaliser). A third is not worth it.
 *
 * Returns { ok } or { ok: false, field, message } rather than throwing, so the HTTP layer
 * owns the error shape and the rule can be executed in a test without an Express request.
 */

/**
 * Instagram, YouTube, WhatsApp and the creator's own INFLX shop are the four the board
 * draws. Facebook, X and LinkedIn are here because Stage 7 of Docs/THE_PLAN.md gives every
 * one of them its own tracked link, and a set that cannot name a channel the platform will
 * shortly count would have to be migrated the moment that lands. Adding a value to a JSON
 * array costs nothing; adding one to an enum costs a migration.
 */
const VALID_CHANNELS = ['instagram', 'youtube', 'whatsapp', 'inflx_shop', 'facebook', 'x', 'linkedin'];

const CHANNEL_LABELS = {
  instagram:  'Instagram',
  youtube:    'YouTube',
  whatsapp:   'WhatsApp',
  inflx_shop: 'Their INFLX shop',
  facebook:   'Facebook',
  x:          'X',
  linkedin:   'LinkedIn',
};

const ok = { ok: true };
const fail = (field, message) => ({ ok: false, field, message });

/**
 * @param {string|null} goal        campaign_sets.goal — engagement | conversion | hybrid
 * @param {object|null} channels    { allowed: string[], minimum: number } or null
 */
function validateChannels(goal, channels) {
  if (channels == null) return ok;                 // never stated — the normal case today

  if (typeof channels !== 'object' || Array.isArray(channels)) {
    return fail('channels_json', 'channels_json must be an object like { allowed: [], minimum: 1 }');
  }

  // Asking a content set which channels drive traffic is a category error: nothing is
  // being sold there, so there is no traffic to drive. Saying so beats storing a field
  // that quietly means nothing.
  if (goal === 'engagement') {
    return fail('channels_json', 'channels_json does not apply to a content set — you are buying deliverables, not reach');
  }

  const { allowed, minimum } = channels;

  if (allowed !== undefined && allowed !== null) {
    if (!Array.isArray(allowed)) {
      return fail('channels_json', 'channels_json.allowed must be an array');
    }
    for (const ch of allowed) {
      if (!VALID_CHANNELS.includes(ch)) {
        return fail('channels_json', `channels_json.allowed contains "${ch}" — must be one of: ${VALID_CHANNELS.join(', ')}`);
      }
    }
    if (new Set(allowed).size !== allowed.length) {
      return fail('channels_json', 'channels_json.allowed lists the same channel twice');
    }
  }

  if (minimum !== undefined && minimum !== null) {
    const n = Number(minimum);
    if (!Number.isInteger(n) || n < 0) {
      return fail('channels_json', 'channels_json.minimum must be a whole number of 0 or more');
    }
    // A minimum higher than the number of channels on offer can never be met, so it is a
    // typo rather than a policy. Catching it here beats a brand wondering why the guidance
    // line reads as impossible.
    if (Array.isArray(allowed) && n > allowed.length) {
      return fail('channels_json', `channels_json.minimum is ${n} but only ${allowed.length} channel(s) are allowed on this set`);
    }
  }

  return ok;
}

/** "Instagram · YouTube · their INFLX shop" — for a screen or a notification. */
function describeChannels(channels) {
  if (!channels || !Array.isArray(channels.allowed) || !channels.allowed.length) return null;
  const names = channels.allowed.map(c => CHANNEL_LABELS[c] || c);
  const list = names.join(' · ');
  const min = Number(channels.minimum);
  return Number.isInteger(min) && min > 0
    ? `${list} — at least ${min}`
    : list;
}

/**
 * stage-a — channels_json moved down to the creator (migration 166), same reading rule as
 * formats_json: her value, else the set's, else nothing. The set-level ask is what the old
 * wizard wrote; nothing new writes it, but it must keep resolving for sets built before today.
 *
 * @param {*} herChannels  campaign_influencers.channels_json
 * @param {*} setChannels  campaign_sets.channels_json
 */
function resolveChannels(herChannels, setChannels) {
  const nonEmpty = (v) => v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.allowed) && v.allowed.length > 0;
  if (nonEmpty(herChannels)) return herChannels;
  if (nonEmpty(setChannels)) return setChannels;
  return null;
}

module.exports = { VALID_CHANNELS, CHANNEL_LABELS, validateChannels, describeChannels, resolveChannels };
