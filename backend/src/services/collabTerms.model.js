'use strict';

/**
 * collabTerms.model.js — the ONE definition of what a handshake term is.
 * Contract: features/collab-part2-precampaign-handshake
 *
 * THE MODEL (founder, 2026-08-11)
 *
 * Not every term matters equally, and the model says so.
 *
 *   MONEY and TIME are PRIMARY. Always stated, always negotiable.
 *     money — commission % for conversion, a fee for engagement, both for hybrid
 *     time  — when content is expected to go up. NOT a campaign duration: a conversion
 *             collaboration has no duration, so for conversion this is a single post-by
 *             date; content work gets a window.
 *
 *   EVERYTHING ELSE IS OPTIONAL — including deliverables, deliberately. A brand
 *   often does not know which channels a creator has and should not have to guess;
 *   the creator proposes them and it becomes part of the agreement.
 *
 *   ANYTHING STATED CARRIES AN IMPORTANCE MARKER:
 *     'requirement' — must be settled before agreement. NOT counterable: if the
 *                     other side cannot live with it, the honest outcome is a
 *                     decline, not a counter that quietly changes it and looks
 *                     like agreement.
 *     'preference'  — put to the other party as a question ("we'd prefer X, what
 *                     works for you?"). Declining it does not break the deal.
 *
 * This is what keeps a handshake cheap enough to be worth doing: two things must be
 * agreed, everything else is a conversation.
 *
 * Shared by BOTH record types — a brand request and a creator pitch. One module, so
 * the two sides cannot drift on what a term means. Two copies of this would be the
 * same fault this program has already had to fix twice (a duplicated offer
 * vocabulary, a duplicated offer-type normaliser).
 */

/**
 * The aim vocabulary is the EXISTING `campaign_goal` enum — deliberately not a new one.
 *
 * A first draft of this module invented 'sales' | 'content' | 'both' to match the
 * friendly labels in the mockup. That would have been a second vocabulary for the same
 * concept, needing translation at every boundary — most importantly when an agreement
 * is briefed into a campaign set, whose goal column IS this enum. This program has
 * already had to clean up two duplicated vocabularies (offer types written differently
 * by web and mobile, and a duplicated offer-type normaliser); a third was not worth it.
 *
 * Friendly labels stay in the UI: conversion = "pay per sale", engagement = "pay for
 * content", hybrid = "both".
 */
const AIMS = ['engagement', 'conversion', 'hybrid'];
const IMPORTANCE = ['requirement', 'preference'];
const MODES = ['visit', 'shipment', 'remote'];
const SCOPES = ['store', 'category', 'products'];

/** Terms that must appear on every request or pitch. */
const PRIMARY_TERMS = ['money', 'time'];

/** Optional terms. Each, if stated, needs an importance marker. */
const OPTIONAL_TERMS = ['scope', 'mode', 'deliverables'];

/** Only these may be changed by a counter — a requirement never can. */
const NEGOTIABLE_TERMS = ['money', 'time'];

const fail = (field, message) => ({ ok: false, field, message });
const OK = { ok: true };

const isPosNum = v => typeof v === 'number' ? v > 0 && Number.isFinite(v)
  : (v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0);
const isDate = v => !!v && !Number.isNaN(new Date(v).getTime());

/**
 * What money means for an aim. Conversion is commission-only — no fee and no
 * budget, which Part 4 established and the backend already agrees with.
 */
function moneyShapeFor(aim) {
  if (aim === 'conversion') return { commission_pct: true, fee: false };
  if (aim === 'engagement') return { commission_pct: false, fee: true };
  return { commission_pct: true, fee: true };            // hybrid
}

function validateMoney(aim, money) {
  if (!money || typeof money !== 'object') return fail('terms.money', 'money is required');
  const want = moneyShapeFor(aim);

  if (want.commission_pct) {
    if (!isPosNum(money.commission_pct)) {
      return fail('terms.money.commission_pct', 'a commission % is required for this aim');
    }
    if (Number(money.commission_pct) > 100) {
      return fail('terms.money.commission_pct', 'commission % cannot exceed 100');
    }
  } else if (money.commission_pct != null) {
    return fail('terms.money.commission_pct', 'an engagement collaboration pays a fee, not commission');
  }

  if (want.fee) {
    if (!isPosNum(money.fee)) return fail('terms.money.fee', 'a fee is required for this aim');
  } else if (money.fee != null) {
    // Conversion is commission-only. Accepting a fee here would quietly reintroduce the
    // budget a sales campaign is not supposed to have.
    return fail('terms.money.fee', 'a conversion collaboration is commission-only — no fee');
  }
  return OK;
}

function validateTime(aim, time) {
  if (!time || typeof time !== 'object') return fail('terms.time', 'time is required');

  if (aim === 'conversion') {
    // A single post-by date. A conversion collaboration has no duration, so a window
    // would be meaningless here.
    if (!isDate(time.post_by)) return fail('terms.time.post_by', 'a post-by date is required');
    if (time.window_start || time.window_end) {
      return fail('terms.time', 'a conversion collaboration has no duration — use post_by, not a window');
    }
    return OK;
  }

  // engagement / hybrid — a real posting window
  if (!isDate(time.window_start)) return fail('terms.time.window_start', 'a posting window start is required');
  if (!isDate(time.window_end))   return fail('terms.time.window_end', 'a posting window end is required');
  if (new Date(time.window_end) < new Date(time.window_start)) {
    return fail('terms.time.window_end', 'the window cannot end before it starts');
  }
  return OK;
}

function validateScope(scope) {
  if (!scope || typeof scope !== 'object') return fail('terms.scope', 'scope must be an object');
  const level = String(scope.level || '').toLowerCase();
  if (!SCOPES.includes(level)) {
    return fail('terms.scope.level', `scope.level must be one of: ${SCOPES.join(', ')}`);
  }
  if (level === 'category' && !scope.category_node_id && !scope.category) {
    return fail('terms.scope.category', 'a category is required when scope.level is "category"');
  }
  if (level === 'products' && !(Array.isArray(scope.product_ids) && scope.product_ids.length)) {
    return fail('terms.scope.product_ids', 'at least one product is required when scope.level is "products"');
  }
  return OK;
}

function validateDeliverables(d) {
  if (!Array.isArray(d) || d.length === 0) {
    return fail('terms.deliverables', 'deliverables must be a non-empty list when stated');
  }
  for (let i = 0; i < d.length; i += 1) {
    if (!d[i] || !d[i].type) return fail(`terms.deliverables[${i}].type`, 'each deliverable needs a type');
    if (!isPosNum(d[i].count)) return fail(`terms.deliverables[${i}].count`, 'each deliverable needs a count');
  }
  return OK;
}

/**
 * Validate a full terms payload.
 * @returns {{ok:true} | {ok:false, field, message}}
 */
function validateTerms(terms) {
  if (!terms || typeof terms !== 'object' || Array.isArray(terms)) {
    return fail('terms', 'terms must be an object');
  }

  const aim = String(terms.aim || '').toLowerCase();
  if (!AIMS.includes(aim)) return fail('terms.aim', `aim must be one of: ${AIMS.join(', ')}`);

  const money = validateMoney(aim, terms.money);
  if (!money.ok) return money;

  const time = validateTime(aim, terms.time);
  if (!time.ok) return time;

  const importance = terms.importance && typeof terms.importance === 'object' ? terms.importance : {};

  for (const key of OPTIONAL_TERMS) {
    const stated = terms[key] != null;
    const marked = importance[key] != null;

    if (!stated) {
      // Not stated is fine — that is the point of optional. But a marker with no
      // value is a half-filled form, and silently ignoring it would lose intent.
      if (marked) return fail(`terms.importance.${key}`, `${key} is marked but not stated`);
      continue;
    }

    if (!marked) {
      return fail(`terms.importance.${key}`, `${key} is stated, so say whether it is a requirement or a preference`);
    }
    if (!IMPORTANCE.includes(importance[key])) {
      return fail(`terms.importance.${key}`, `importance must be one of: ${IMPORTANCE.join(', ')}`);
    }

    if (key === 'scope') { const r = validateScope(terms.scope); if (!r.ok) return r; }
    if (key === 'mode') {
      if (!MODES.includes(String(terms.mode).toLowerCase())) {
        return fail('terms.mode', `mode must be one of: ${MODES.join(', ')}`);
      }
    }
    if (key === 'deliverables') { const r = validateDeliverables(terms.deliverables); if (!r.ok) return r; }
  }

  return OK;
}

/**
 * Validate a counter against the terms it answers.
 *
 * A counter may move money and time, may reject a PREFERENCE, and may fill in an
 * optional term the other side left open. It may NOT change a REQUIREMENT — that is
 * the whole meaning of the marker, and allowing it would let a counter look like
 * agreement while quietly changing the deal.
 */
function validateCounter(original, counter) {
  if (!counter || typeof counter !== 'object') return fail('counter', 'counter must be an object');

  // Merge via settle(), not a shallow spread. A shallow spread lets the counter's
  // `importance` object REPLACE the original's, so a counter that only fills in
  // deliverables would drop the markers on every other term — and the merged payload
  // would then fail as "stated but unmarked" for a term the counter never touched.
  const base = validateTerms(settle(original, counter));
  if (!base.ok) return base;

  const importance = (original && original.importance) || {};

  for (const key of OPTIONAL_TERMS) {
    if (counter[key] === undefined) continue;                 // untouched
    if (importance[key] !== 'requirement') continue;          // preference or unstated — fair game
    if (original[key] == null) continue;                      // was left open, so filling it is fine

    if (JSON.stringify(counter[key]) !== JSON.stringify(original[key])) {
      return fail(
        `counter.${key}`,
        `${key} was stated as a requirement and cannot be countered — accept it or decline the request`
      );
    }
  }
  return OK;
}

/** Which terms this side is allowed to edit in a counter. Drives the UI. */
function counterableTerms(original) {
  const importance = (original && original.importance) || {};
  const optional = OPTIONAL_TERMS.filter(k => importance[k] !== 'requirement' || original[k] == null);
  return [...NEGOTIABLE_TERMS, ...optional];
}

/** Merge an accepted counter into the settled terms an agreement records. */
function settle(original, counter) {
  if (!counter) return { ...original };
  const merged = { ...original, ...counter };
  merged.importance = { ...(original.importance || {}), ...(counter.importance || {}) };
  return merged;
}

module.exports = {
  AIMS, IMPORTANCE, MODES, SCOPES,
  PRIMARY_TERMS, OPTIONAL_TERMS, NEGOTIABLE_TERMS,
  moneyShapeFor,
  validateTerms,
  validateCounter,
  counterableTerms,
  settle,
};
