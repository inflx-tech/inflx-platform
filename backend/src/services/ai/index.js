'use strict';

/**
 * ai/index.js — Meals AI dispatcher.
 * Mock (deterministic) when AI_MOCK or no key; otherwise the Anthropic
 * client, with a safe fallback to mock on any AI error so a model
 * outage never breaks the order flow. AI returns STRUCTURE, never prices.
 */

const env = require('../../config/env');
const mock = require('./mock');

let _client = null;
function client() {
  if (!_client) _client = require('./client');
  return _client;
}

function useMock() {
  return env.AI_MOCK || !env.ANTHROPIC_API_KEY;
}

async function extractIntent(rawText, ctx = {}) {
  if (useMock()) return mock.extractIntent(rawText, ctx.memory || {});
  try {
    return await client().extractIntent(rawText, ctx);
  } catch (e) {
    console.error('[meals-ai] extractIntent fell back to mock:', e.message);
    return { ...mock.extractIntent(rawText, ctx.memory || {}), _ai_fallback: true };
  }
}

async function recommendOffer(offers, ctx = {}) {
  if (useMock()) return mock.recommend(offers, ctx.memory || {});
  try {
    return await client().recommendOffer(offers, ctx);
  } catch (e) {
    console.error('[meals-ai] recommendOffer fell back to mock:', e.message);
    return mock.recommend(offers, ctx.memory || {});
  }
}

async function suggestOffers(ctx = {}) {
  if (useMock()) return mock.suggestOffers(ctx);
  try {
    return await client().suggestOffers(ctx);
  } catch (e) {
    console.error('[meals-ai] suggestOffers fell back to mock:', e.message);
    return mock.suggestOffers(ctx);
  }
}

async function extractRestaurantOffer(rawText, ctx = {}) {
  if (useMock()) return mock.extractRestaurantOffer(rawText, ctx);
  try {
    return await client().extractRestaurantOffer(rawText, ctx);
  } catch (e) {
    console.error('[meals-ai] extractRestaurantOffer fell back to mock:', e.message);
    return mock.extractRestaurantOffer(rawText, ctx);
  }
}

async function modifyOffer(current = {}, instruction = '', ctx = {}) {
  if (useMock()) return mock.modifyOffer(current, instruction, ctx);
  try {
    return await client().modifyOffer(current, instruction, ctx);
  } catch (e) {
    console.error('[meals-ai] modifyOffer fell back to mock:', e.message);
    return mock.modifyOffer(current, instruction, ctx);
  }
}

module.exports = { extractIntent, recommendOffer, suggestOffers, extractRestaurantOffer, modifyOffer, isMock: useMock };
