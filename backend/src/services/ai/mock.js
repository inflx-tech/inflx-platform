'use strict';

/**
 * ai/mock.js — deterministic Meals AI (AI_MOCK / no key).
 *
 * A rule-based stand-in for the Anthropic models so local + test runs
 * are fully deterministic and need no key. It is ALSO the baseline the
 * X2 AI-eval lane scores against. Returns STRUCTURE only — never prices.
 */

const NUM_TO_PARTY = { 1: 'single', 2: 'duo', 3: 'trio', 4: 'family' };

function detectPartySize(t) {
  if (/\boffice\b|corporate|colleagues|\bteam lunch\b/.test(t)) return 'office';
  if (/\bfamily\b/.test(t)) return 'family';
  if (/\bsolo\b|just me|\bmyself\b/.test(t)) return 'single';
  if (/\bcouple\b|\bduo\b/.test(t)) return 'duo';
  if (/\btrio\b/.test(t)) return 'trio';
  // explicit "for N" / "N people"
  const m = t.match(/(?:for\s+)?(\d{1,2})\s*(?:people|ppl|persons|pax|of us|heads?)/) || t.match(/\bfor\s+(\d{1,2})\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 10) return 'office';
    if (n >= 4) return 'family';
    return NUM_TO_PARTY[n] || null;
  }
  return null;
}

function sumMatches(t, re) {
  let total = 0;
  let found = false;
  let m;
  const g = new RegExp(re, 'g');
  // eslint-disable-next-line no-cond-assign
  while ((m = g.exec(t)) !== null) { total += parseInt(m[1], 10); found = true; }
  return found ? total : null;
}

function detectCounts(t) {
  // Explicit "N non-veg" / "N veg" wins; otherwise infer from dish names
  // (chicken/mutton/egg/fish/prawn = non-veg; paneer/veg = veg).
  const nonVeg = t.match(/(\d+)\s*non[-\s]?veg/);
  const nonvegExplicit = nonVeg ? parseInt(nonVeg[1], 10) : null;
  const stripped = t.replace(/\d+\s*non[-\s]?veg/g, '');
  const veg = stripped.match(/(\d+)\s*veg/);
  const vegExplicit = veg ? parseInt(veg[1], 10) : null;

  const nonvegFromDish = sumMatches(stripped, /(\d+)\s*(?:chicken|mutton|egg|fish|prawn)/);
  const vegFromDish = sumMatches(stripped, /(\d+)\s*paneer/);

  return {
    veg_count: vegExplicit != null ? vegExplicit : vegFromDish,
    nonveg_count: nonvegExplicit != null ? nonvegExplicit : nonvegFromDish,
  };
}

function detectSpice(t, memory) {
  // Check mild/medium BEFORE spicy so "medium spicy" → medium.
  if (/\bmild\b|less spicy|not spicy/.test(t)) return 'mild';
  if (/\bmedium\b/.test(t)) return 'medium';
  if (/extra spicy|very spicy|extra hot|\bspicy\b|\bhot\b/.test(t)) return 'spicy';
  return memory.spice_pref || null;
}

function detectSlot(t) {
  if (/\bdinner\b|tonight|evening/.test(t)) return 'Dinner';
  if (/\blunch\b|afternoon|midday/.test(t)) return 'Lunch';
  return null;
}

function detectSlotDate(t) {
  const now = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  if (/tomorrow/.test(t)) return fmt(new Date(now.getTime() + 86400000));
  if (/today|tonight/.test(t)) return fmt(now);
  return null;
}

function detectBudget(t, memory) {
  const m = t.match(/under\s*₹?\s*(\d{2,5})/) ||
            t.match(/₹\s*(\d{2,5})\s*(?:per head|each|pp|a head)/) ||
            t.match(/budget\s*(?:of|is)?\s*₹?\s*(\d{2,5})/);
  if (m) return parseInt(m[1], 10);
  return memory.budget_per_head != null ? Number(memory.budget_per_head) : null;
}

function detectItems(t) {
  const items = [];
  if (/paneer/.test(t)) items.push({ name: 'Paneer Biryani' });
  if (/chicken/.test(t)) items.push({ name: 'Chicken Biryani' });
  if (/mutton/.test(t)) items.push({ name: 'Mutton Biryani' });
  if (/\begg\b/.test(t)) items.push({ name: 'Egg Biryani' });
  if (items.length === 0 && /veg biryani|\bveg\b/.test(t)) items.push({ name: 'Veg Biryani' });
  if (items.length === 0 && /biryani/.test(t)) items.push({ name: 'Biryani' });
  return items;
}

function detectOccasion(t) {
  if (/birthday/.test(t)) return 'birthday';
  if (/\boffice\b|corporate/.test(t)) return 'office';
  if (/guests|visitors|relatives/.test(t)) return 'guests';
  return null;
}

function extractIntent(rawText, memory = {}) {
  const t = String(rawText || '').toLowerCase();
  const party_size = detectPartySize(t);
  const { veg_count, nonveg_count } = detectCounts(t);
  const intent = {
    party_size,
    veg_count,
    nonveg_count,
    items: detectItems(t),
    spice_level: detectSpice(t, memory),
    occasion: detectOccasion(t),
    slot_label: detectSlot(t),
    slot_date: detectSlotDate(t),
    budget_per_head: detectBudget(t, memory),
  };

  // Meaningful, memory-aware follow-up: only ask what's genuinely missing.
  const missing = [];
  if (!intent.party_size) missing.push('party_size');
  // Office/bulk orders are pack-based — no per-dish clarification needed.
  if (intent.party_size !== 'office'
      && intent.items.length === 0 && intent.veg_count == null && intent.nonveg_count == null) {
    missing.push('items');
  }
  if (!intent.slot_label) missing.push('slot');

  let clarify_question = null;
  if (missing.includes('party_size')) clarify_question = 'How many people are you ordering for?';
  else if (missing.includes('items')) clarify_question = 'What would you like — any veg / non-veg preference?';
  else if (missing.includes('slot')) clarify_question = 'Lunch or dinner?';

  return { ...intent, missing_fields: missing, clarify_question };
}

/**
 * Deterministic offer-combination suggester (AI_MOCK fallback). The AI
 * returns STRUCTURE only — items reference real brand_products by id,
 * party_size + offer_kind + freebies + suggested_name + reasoning.
 * Prices are NEVER set here — the backend joins brand_products.price.
 */
// Heuristic: cheap sides / drinks / sweets are the low-cost loyalty add-ons.
function isAddon(m) {
  return /raita|gulab|jamun|soda|coke|cola|pepsi|drink|water|lassi|papad|fries|salad|dessert|sweet|ice ?cream/i.test(m.name)
    || (m.section && /side|dessert|sweet|drink|beverage|add[\s-]?on|starter/i.test(m.section));
}

/**
 * Deterministic offer-combination suggester (AI_MOCK fallback). Menu-generic
 * (works for any cuisine, not just biryani): ranks mains by price, picks a
 * low-cost add-on, and emits MULTIPLE combos across party sizes — each with a
 * small high-loyalty freebie and owner-facing reasoning. Marks the family pack
 * recommended. The AI returns STRUCTURE only — items reference real
 * product_ids; prices are joined later from brand_products.
 */
function suggestOffers({ menu = [], party_sizes = ['single', 'duo', 'trio', 'family', 'office'] } = {}) {
  if (!menu.length) return { suggestions: [] };

  const mains = menu.filter((m) => !isAddon(m)).sort((a, b) => Number(b.price) - Number(a.price));
  const addons = menu.filter(isAddon).sort((a, b) => Number(a.price) - Number(b.price));
  const main = mains.find((m) => m.veg_flag === 'non_veg') || mains[0];
  if (!main) return { suggestions: [] };
  const veg = mains.find((m) => m.veg_flag === 'veg' && m.id !== main.id) || mains[1] || main;
  const addon = addons[0] || null;          // cheapest side/drink = loyalty lever
  const addon2 = addons[1] || null;
  const addonName = addon ? addon.name : 'a small complimentary side';

  const ref = (item, qty) => ({ product_id: item.id, name: item.name, qty });
  const loyalty = (lead) =>
    `${lead} Adding a low-cost extra like ${addonName} barely touches your margin, but the extra perceived value is what brings the customer back next time.`;
  const out = [];

  for (const ps of party_sizes) {
    if (ps === 'single') {
      out.push({ party_size: 'single', offer_kind: addon ? 'free_addon' : 'discount', suggested_name: 'Solo Treat',
        items: [ref(main, 1)], freebies: addon ? [addonName] : [], recommended: false,
        reasoning: loyalty('A welcoming single-portion combo to win first-time solo diners.') });
    }
    if (ps === 'duo') {
      const mixed = veg.id !== main.id;
      out.push({ party_size: 'duo', offer_kind: mixed ? 'mixed' : 'free_addon', suggested_name: 'Duo Combo',
        items: mixed ? [ref(main, 1), ref(veg, 1)] : [ref(main, 2)], freebies: addon ? [addonName] : [], recommended: false,
        reasoning: loyalty('A shareable pack for two that covers both diets.') });
    }
    if (ps === 'trio') {
      const mixed = veg.id !== main.id;
      out.push({ party_size: 'trio', offer_kind: 'mixed', suggested_name: 'Trio Share-pack',
        items: mixed ? [ref(main, 2), ref(veg, 1)] : [ref(main, 3)], freebies: addon ? [addonName] : [], recommended: false,
        reasoning: loyalty('Balanced share for three.') });
    }
    if (ps === 'family') {
      const mixed = veg.id !== main.id;
      const fb = [];
      if (addon) fb.push(addonName);
      if (addon2) fb.push(addon2.name);
      out.push({ party_size: 'family', offer_kind: 'mixed', suggested_name: 'Family Feast',
        items: mixed ? [ref(main, 2), ref(veg, 2)] : [ref(main, 4)], freebies: fb, recommended: true,
        reasoning: loyalty('Your strongest repeat-customer driver: a family pack with a couple of cheap extras (e.g. a small drink + a sweet).') });
    }
    if (ps === 'office') {
      out.push({ party_size: 'office', offer_kind: 'early_order', suggested_name: 'Office Pre-book',
        items: [ref(main, 12)], freebies: ['Free delivery'], recommended: false,
        reasoning: loyalty('Bulk office pre-book — locks tomorrow\'s lunch the day before.') });
    }
  }
  return { suggestions: out };
}

/**
 * Restaurant-side offer MODIFIER (AI_MOCK fallback). Applies an owner's
 * plain-English change to an existing offer and returns the FULL updated
 * structure (cheaper / add-a-freebie / swap-a-dish). Never sets a price the
 * owner did not state.
 */
function modifyOffer(current = {}, instruction = '', ctx = {}) {
  const t = String(instruction || '').toLowerCase();
  const menu = Array.isArray(ctx.menu) ? ctx.menu : [];
  const next = {
    party_size: current.party_size || null,
    offer_kind: current.offer_kind || 'mixed',
    suggested_name: current.name || current.suggested_name || 'Updated offer',
    items: Array.isArray(current.items)
      ? current.items.map((it) => ({ product_id: it.product_id, name: it.name, qty: Number(it.qty) || 1 }))
      : [],
    base_price: current.base_price != null ? Number(current.base_price) : null,
    discount_type: current.discount_type || null,
    discount_value: current.discount_value != null ? Number(current.discount_value) : null,
    freebies: Array.isArray(current.freebies) ? current.freebies.slice() : [],
    reasoning: null,
    missing_fields: [],
    clarify_question: null,
  };
  const notes = [];

  // Cheaper / discount.
  const pctM = t.match(/(\d{1,2})\s*%\s*(?:off|discount|cheaper)/);
  const flatM = t.match(/(?:₹|rs\.?|flat)\s*(\d{2,4})/) || t.match(/(\d{2,4})\s*(?:₹|rupees?)?\s*off/);
  if (pctM) { next.discount_type = 'percentage'; next.discount_value = parseInt(pctM[1], 10); notes.push(`applied ${pctM[1]}% off`); }
  else if (flatM) { next.discount_type = 'flat'; next.discount_value = parseInt(flatM[1], 10); notes.push(`applied ₹${flatM[1]} off`); }
  else if (/cheaper|reduce|lower|discount|less/.test(t)) {
    next.discount_type = 'percentage'; next.discount_value = Math.max(5, Number(next.discount_value) || 10);
    notes.push(`nudged the price down ${next.discount_value}%`);
  }

  // Add a free item.
  const freeM = t.match(/(?:add|with|plus|\+)\s*(?:a\s+)?free\s+([a-z][a-z\s]{1,28}?)(?:[,.!]|$|\s+(?:to|for))/)
    || t.match(/free\s+([a-z][a-z\s]{1,28}?)(?:[,.!]|$)/);
  if (freeM) {
    const f = freeM[1].trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (f && !next.freebies.some((x) => x.toLowerCase() === f.toLowerCase())) next.freebies.push(f);
    next.offer_kind = next.discount_value != null ? 'mixed' : 'free_addon';
    notes.push(`added free ${f}`);
  }

  // Swap dish A for dish B (menu-aware).
  const swapM = t.match(/swap\s+([a-z0-9\s]+?)\s+(?:for|with|to)\s+([a-z0-9\s]+)/);
  if (swapM && menu.length) {
    const from = menu.find((m) => String(m.name).toLowerCase().includes(swapM[1].trim()));
    const to = menu.find((m) => String(m.name).toLowerCase().includes(swapM[2].trim()));
    if (from && to) {
      next.items = next.items.map((it) => (it.product_id === from.id ? { product_id: to.id, name: to.name, qty: it.qty } : it));
      notes.push(`swapped ${from.name} → ${to.name}`);
    }
  }

  if (!notes.length) {
    next.missing_fields = ['instruction'];
    next.clarify_question = 'What should I change — make it cheaper, add a free item, or swap a dish?';
    next.reasoning = 'I kept the offer as-is.';
  } else {
    next.reasoning = `Done — ${notes.join(', ')}. Small low-cost extras like this lift perceived value and bring customers back without hurting your margin.`;
  }
  return next;
}

function recommend(offers = [], memory = {}) {
  if (!offers.length) return { recommended_offer_id: null, reasoning: null };
  // Engine already ranked (favourites → cheapest → nearest); recommend rank 1.
  const top = offers[0];
  const bits = [];
  if (memory.budget_per_head != null && top.price != null) bits.push('within your usual budget');
  if (memory.spice_pref) bits.push(`${memory.spice_pref} spice as you like`);
  const reasoning = bits.length
    ? `Best value — ${bits.join(', ')}.`
    : 'Best value for your party size.';
  return { recommended_offer_id: top.id, reasoning };
}

/**
 * Restaurant-side offer extractor (P-RCHAT, AI_MOCK fallback). Parses an
 * owner's plain-English description of an offer they want to create, against
 * THEIR menu, and emits a structured proposal. AI never sets prices — the
 * backend joins menu prices. The owner's discount + freebies, however, are
 * authoritative when stated.
 */
function extractRestaurantOffer(rawText, ctx = {}) {
  const t = String(rawText || '').toLowerCase();
  const menu = Array.isArray(ctx.menu) ? ctx.menu : [];

  // party size — reuse the same heuristics as customer intent
  const party_size = detectPartySize(t);

  // items: only with an EXPLICIT quantity ("2 chicken biryani"). Owners
  // who say things like "free raita" mean it as a freebie, not an item;
  // dropping the substring fallback prevents that ambiguity here.
  const items = [];
  for (const m of menu) {
    const name = String(m.name || '').toLowerCase();
    const key = name.replace(/\s+/g, '\\s+');
    const rx = new RegExp(`(\\d+)\\s*x?\\s*${key}`);
    const match = t.match(rx);
    if (match) items.push({ product_id: m.id, name: m.name, qty: parseInt(match[1], 10) || 1 });
  }

  // owner-asserted base price ("for ₹1000", "at 1000 rupees", "total 1000")
  let base_price = null;
  const baseM = t.match(/(?:for|at|total|price|priced?\s*at)\s*₹?\s*(\d{2,5})/) ||
                t.match(/₹\s*(\d{2,5})\s*(?:total|all in|all-in)?/);
  if (baseM) base_price = parseInt(baseM[1], 10);

  // owner-set discount ("₹90 off", "10% off", "flat 50", "50 discount")
  let discount_type = null;
  let discount_value = null;
  const pctM = t.match(/(\d{1,2})\s*%\s*(?:off|discount)/);
  const flatM = t.match(/(?:₹|rs\.?|flat|discount\s*of?)\s*(\d{2,4})\s*(?:off|discount)?/) ||
                t.match(/(\d{2,4})\s*₹?\s*off/) ||
                t.match(/(\d{2,4})\s*rupees?\s*off/);
  if (pctM) { discount_type = 'percentage'; discount_value = parseInt(pctM[1], 10); }
  else if (flatM) { discount_type = 'flat'; discount_value = parseInt(flatM[1], 10); }

  // freebies ("+ free raita", "with free soda", "free dessert")
  const freebies = [];
  const freebieMatches = t.matchAll(/(?:\+\s*free|with\s+(?:a\s+)?free|free)\s+([a-z][a-z\s]{1,30}?)(?:[,.!]|$|\s+(?:for|at|to))/g);
  for (const fm of freebieMatches) {
    const f = fm[1].trim().replace(/\s+/g, ' ');
    if (f && !freebies.some((x) => x.toLowerCase() === f)) freebies.push(f.replace(/\b\w/g, (c) => c.toUpperCase()));
  }

  // trigger context ("if raining" / "rainy day" / "within 3 km" / "weekends")
  const trigger = {};
  if (/(?:if\s+raining|rainy|rain\b)/.test(t)) trigger.weather = 'rain';
  const kmM = t.match(/within\s+(\d{1,2})\s*km/);
  if (kmM) trigger.max_km = parseInt(kmM[1], 10);
  if (/weekend/.test(t)) trigger.days = 'weekend';
  if (/(?:tuesday|monday|wednesday|thursday|friday|saturday|sunday)/.test(t)) {
    trigger.day_of_week = t.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)[1];
  }

  // offer_kind — derive from what we found
  let offer_kind = 'mixed';
  if (Object.keys(trigger).length > 0) offer_kind = 'custom';
  else if (/pre[-\s]?book|early|day before/.test(t)) offer_kind = 'early_order';
  else if (discount_value != null && freebies.length === 0) offer_kind = 'discount';
  else if (freebies.length > 0 && discount_value == null) offer_kind = 'free_addon';
  else if (freebies.length > 0 && discount_value != null) offer_kind = 'mixed';

  // suggested name — owner-typed name wins, else compose
  let suggested_name = null;
  const nameM = rawText && String(rawText).match(/^([A-Z][\w\s]{2,40}?)[:\-—]/);
  if (nameM) suggested_name = nameM[1].trim();
  if (!suggested_name && party_size) {
    suggested_name = `${party_size.charAt(0).toUpperCase() + party_size.slice(1)} ${offer_kind === 'free_addon' ? 'Freebie' : offer_kind === 'early_order' ? 'Pre-book' : 'Pack'}`;
  }

  // clarify priorities: party_size first, then items if neither dishes nor counts
  const missing_fields = [];
  if (!party_size) missing_fields.push('party_size');
  if (items.length === 0 && party_size !== 'office') missing_fields.push('items');

  let clarify_question = null;
  if (missing_fields.includes('party_size')) clarify_question = 'Which party size is this offer for — Single, For 2, For 3, Family, or Office?';
  else if (missing_fields.includes('items')) clarify_question = 'Which dishes from your menu should this offer include?';

  return {
    party_size,
    offer_kind,
    items,
    base_price,
    discount_type,
    discount_value,
    freebies,
    trigger,
    suggested_name,
    missing_fields,
    clarify_question,
    raw_text: rawText,
  };
}

module.exports = { extractIntent, recommend, suggestOffers, extractRestaurantOffer, modifyOffer };
