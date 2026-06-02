'use strict';

/**
 * ai/client.js — Anthropic Claude client for Meals (prod path only).
 *
 * Loaded lazily so AI_MOCK / no-key environments never need the SDK
 * installed. Uses:
 *   - tool-use with a forced JSON tool → structured intent (no prose
 *     parsing, deterministic shape)
 *   - prompt caching (cache_control) on the static system + restaurant/
 *     user memory blocks so repeat turns are cheap
 *   - Haiku-class for extraction/clarify, Sonnet-class for ranking
 *
 * AI returns STRUCTURE only — prices come from the deterministic engine.
 */

const env = require('../../config/env');

let _sdk = null;
function sdk() {
  if (_sdk) return _sdk;
  // eslint-disable-next-line global-require
  const Anthropic = require('@anthropic-ai/sdk');
  _sdk = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return _sdk;
}

const INTENT_TOOL = {
  name: 'emit_intent',
  description: 'Emit the structured meal-order intent extracted from the customer message.',
  input_schema: {
    type: 'object',
    properties: {
      party_size: { type: ['string', 'null'], enum: ['single', 'duo', 'trio', 'family', 'office', null] },
      veg_count: { type: ['integer', 'null'] },
      nonveg_count: { type: ['integer', 'null'] },
      items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' } } } },
      spice_level: { type: ['string', 'null'] },
      occasion: { type: ['string', 'null'] },
      slot_label: { type: ['string', 'null'] },
      slot_date: { type: ['string', 'null'] },
      budget_per_head: { type: ['number', 'null'] },
      missing_fields: { type: 'array', items: { type: 'string' } },
      clarify_question: { type: ['string', 'null'] },
    },
    required: ['party_size', 'missing_fields'],
  },
};

const SYSTEM = `You extract structured meal-order intent for a planned-meal marketplace in India.
Return ONLY the emit_intent tool call. Never invent prices or restaurants.
Ask a single meaningful clarify_question only for genuinely missing fields,
using the customer's remembered preferences so you never re-ask what is known.`;

async function extractIntent(rawText, ctx = {}) {
  const memoryBlock = ctx.memory
    ? `Customer remembered preferences (use to pre-fill, do not re-ask):\n${JSON.stringify(ctx.memory)}`
    : 'No remembered preferences.';
  const res = await sdk().messages.create({
    model: env.AI_MODEL_EXTRACT,
    max_tokens: 512,
    tools: [INTENT_TOOL],
    tool_choice: { type: 'tool', name: 'emit_intent' },
    system: [
      { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: memoryBlock, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: rawText }],
  });
  const tool = (res.content || []).find((c) => c.type === 'tool_use');
  if (!tool) throw new Error('AI returned no tool_use');
  return tool.input;
}

const SUGGEST_TOOL = {
  name: 'emit_offers',
  description: 'Emit N planned-meal offer COMBINATIONS for this restaurant. Items must reference real product_ids from the menu. NEVER include prices or discounts — those are computed by the system.',
  input_schema: {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            party_size: { type: 'string', enum: ['single', 'duo', 'trio', 'family', 'office'] },
            offer_kind: { type: 'string', enum: ['discount', 'free_addon', 'mixed', 'early_order', 'custom'] },
            suggested_name: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product_id: { type: 'string' },
                  name: { type: 'string' },
                  qty: { type: 'integer' },
                },
                required: ['product_id', 'qty'],
              },
            },
            freebies: { type: 'array', items: { type: 'string' } },
            recommended: { type: 'boolean', description: 'true for the 1–2 strongest combos overall (your best repeat-customer drivers).' },
            reasoning: { type: 'string', description: 'Plain advice to the OWNER: why this combo, and the low-cost/high-loyalty rationale for any add-on.' },
          },
          required: ['party_size', 'offer_kind', 'suggested_name', 'items'],
        },
      },
    },
    required: ['suggestions'],
  },
};

async function suggestOffers(ctx = {}) {
  const menuBlock = ctx.menu
    ? `Restaurant menu (use product_id refs; never invent items):\n${JSON.stringify(ctx.menu)}`
    : 'No menu supplied.';
  const memoryBlock = ctx.memory ? `Restaurant memory (learnings + owner-confirmed costs):\n${JSON.stringify(ctx.memory)}` : '';
  const res = await sdk().messages.create({
    model: env.AI_MODEL_REASON,
    max_tokens: 2048,
    tools: [SUGGEST_TOOL],
    tool_choice: { type: 'tool', name: 'emit_offers' },
    system: [
      { type: 'text', text:
        'You are a revenue + customer-loyalty advisor for an Indian restaurant, not just a combo builder. ' +
        'Generate MULTIPLE varied offer combinations from the menu — several per party_size where the menu supports it, ' +
        'across single/duo/trio/family/office. ' +
        'STRATEGY: on main-dish combos, recommend a LOW-COST, HIGH-LOYALTY add-on — a small drink, 2–3 small protein bites, ' +
        'a small sweet, a complimentary side. In each `reasoning`, speak to the OWNER and explain the trade-off plainly ' +
        '("a small Coke and 3 small chicken-65 pieces cost you very little, but the extra perceived value is what brings ' +
        'the customer back"). When owner-confirmed item costs are present in memory, use them to keep add-ons genuinely cheap ' +
        'and say so; when costs are absent, frame it as a suggestion, do not assert exact margins. ' +
        'Mark the strongest 1–2 combos overall with recommended=true. ' +
        'Items MUST reference real product_ids from the menu — never invent dishes. ' +
        'NEVER set prices or discounts — the system computes those from menu prices.',
        cache_control: { type: 'ephemeral' } },
      { type: 'text', text: menuBlock,  cache_control: { type: 'ephemeral' } },
      ...(memoryBlock ? [{ type: 'text', text: memoryBlock }] : []),
    ],
    messages: [{ role: 'user', content: 'Propose a varied set of offer combinations with low-cost loyalty add-ons, and flag your best picks.' }],
  });
  const tool = (res.content || []).find((c) => c.type === 'tool_use');
  if (!tool) throw new Error('AI returned no tool_use');
  return tool.input;
}

async function recommendOffer(offers, ctx = {}) {
  // Sonnet-class: pick the best among the engine-priced candidates +
  // explain. Prices are fixed by the engine; AI only orders/justifies.
  const res = await sdk().messages.create({
    model: env.AI_MODEL_REASON,
    max_tokens: 256,
    system: [{ type: 'text', text: 'Pick the best offer id for this customer and give one short reason. Never change prices.', cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: JSON.stringify({ offers, memory: ctx.memory || {} }) }],
  });
  const text = (res.content || []).map((c) => c.text || '').join(' ');
  return { recommended_offer_id: offers[0] && offers[0].id, reasoning: text.trim() || 'Best value for your party size.' };
}

const RESTAURANT_OFFER_TOOL = {
  name: 'emit_restaurant_offer',
  description: 'Parse a restaurant owner\'s plain-English description of an offer they want to create. Items MUST reference real product_ids from the menu. NEVER set prices or discounts the owner did not state — pass null for unset numeric fields.',
  input_schema: {
    type: 'object',
    properties: {
      party_size: { type: ['string', 'null'], enum: ['single', 'duo', 'trio', 'family', 'office', null] },
      offer_kind: { type: 'string', enum: ['discount', 'free_addon', 'mixed', 'early_order', 'custom'] },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            product_id: { type: 'string' },
            name: { type: 'string' },
            qty: { type: 'integer' },
          },
          required: ['product_id', 'qty'],
        },
      },
      base_price: { type: ['number', 'null'] },
      discount_type: { type: ['string', 'null'], enum: ['flat', 'percentage', null] },
      discount_value: { type: ['number', 'null'] },
      freebies: { type: 'array', items: { type: 'string' } },
      trigger: { type: 'object' },
      suggested_name: { type: ['string', 'null'] },
      missing_fields: { type: 'array', items: { type: 'string' } },
      clarify_question: { type: ['string', 'null'] },
    },
    required: ['offer_kind', 'items', 'missing_fields'],
  },
};

async function extractRestaurantOffer(rawText, ctx = {}) {
  const menuBlock = ctx.menu
    ? `Restaurant menu (use product_id refs; never invent items):\n${JSON.stringify(ctx.menu)}`
    : 'No menu supplied.';
  const res = await sdk().messages.create({
    model: env.AI_MODEL_EXTRACT,
    max_tokens: 512,
    tools: [RESTAURANT_OFFER_TOOL],
    tool_choice: { type: 'tool', name: 'emit_restaurant_offer' },
    system: [
      { type: 'text', text:
        'You parse a restaurant owner\'s plain-English description of an offer they want to create. ' +
        'Items MUST reference real product_ids from the menu — never invent dishes. ' +
        'Pass null for any price/discount the owner did not state — the system computes base_price ' +
        'from menu prices when the owner does not specify. ' +
        'If party_size or items are missing, set clarify_question to ask ONE meaningful follow-up.',
        cache_control: { type: 'ephemeral' } },
      { type: 'text', text: menuBlock, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: rawText }],
  });
  const tool = (res.content || []).find((c) => c.type === 'tool_use');
  if (!tool) throw new Error('AI returned no tool_use');
  return tool.input;
}

const MODIFY_OFFER_TOOL = {
  name: 'emit_modified_offer',
  description: 'Apply the restaurant owner\'s requested change to an EXISTING offer and return the FULL updated offer (not just the delta). Items MUST reference real product_ids from the menu. NEVER set a price the owner did not state — pass null for unset numeric fields; the system computes base_price from menu prices.',
  input_schema: {
    type: 'object',
    properties: {
      party_size: { type: ['string', 'null'], enum: ['single', 'duo', 'trio', 'family', 'office', null] },
      offer_kind: { type: 'string', enum: ['discount', 'free_addon', 'mixed', 'early_order', 'custom'] },
      suggested_name: { type: ['string', 'null'] },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            product_id: { type: 'string' },
            name: { type: 'string' },
            qty: { type: 'integer' },
          },
          required: ['product_id', 'qty'],
        },
      },
      base_price: { type: ['number', 'null'] },
      discount_type: { type: ['string', 'null'], enum: ['flat', 'percentage', null] },
      discount_value: { type: ['number', 'null'] },
      freebies: { type: 'array', items: { type: 'string' } },
      reasoning: { type: ['string', 'null'], description: 'One short line to the owner: what changed and any low-cost/loyalty rationale.' },
      missing_fields: { type: 'array', items: { type: 'string' } },
      clarify_question: { type: ['string', 'null'] },
    },
    required: ['offer_kind', 'items'],
  },
};

async function modifyOffer(current, instruction, ctx = {}) {
  const menuBlock = ctx.menu
    ? `Restaurant menu (use product_id refs; never invent items):\n${JSON.stringify(ctx.menu)}`
    : 'No menu supplied.';
  const res = await sdk().messages.create({
    model: env.AI_MODEL_EXTRACT,
    max_tokens: 700,
    tools: [MODIFY_OFFER_TOOL],
    tool_choice: { type: 'tool', name: 'emit_modified_offer' },
    system: [
      { type: 'text', text:
        'You modify an EXISTING restaurant offer per the owner\'s instruction. ' +
        'Return the complete updated offer, not just the change. Keep everything the owner did not ask to change. ' +
        'Items MUST reference real product_ids from the menu. ' +
        'Never invent prices — pass null for unset numerics; the system recomputes base_price from menu prices. ' +
        'In reasoning, give one short owner-facing line on what changed (and any low-cost loyalty rationale). ' +
        'If the instruction is too vague to apply, set clarify_question and list the gap in missing_fields.',
        cache_control: { type: 'ephemeral' } },
      { type: 'text', text: menuBlock, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: JSON.stringify({ current_offer: current, instruction }) }],
  });
  const tool = (res.content || []).find((c) => c.type === 'tool_use');
  if (!tool) throw new Error('AI returned no tool_use');
  return tool.input;
}

module.exports = { extractIntent, recommendOffer, suggestOffers, extractRestaurantOffer, modifyOffer };
