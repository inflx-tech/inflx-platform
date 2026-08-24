const { toMode } = require('./workingStyle');

/**
 * collabCounter.js — which terms she actually moved.
 * Contract: features/collab-terms-by-aim (item 7)
 *
 * Countering now happens on the terms themselves, with every control pre-filled from the
 * brand's own offer. That makes "no change" the default — but it also means the screen
 * holds a complete copy of the deal, and sending all of it would record four moves where
 * one happened.
 *
 * So this compares what she is looking at against what she was sent, and names only the
 * differences. It decides what travels and what the button says, which is why it lives
 * here rather than inside the screen: a mistake would show as a counter that quietly
 * changed something she never touched, and that is precisely the fault item 7 removes.
 */

const FORMATS = ['reel', 'post', 'story', 'youtube_video', 'youtube_short'];

/** How the brand's own figure appears in an edit control, so equality is comparable. */
function asText(v) {
  return v == null ? '' : String(v);
}

/**
 * @param {object} original  the terms she was sent
 * @param {object} edits     { commission, fee, postBy, place, shipping, deliverables }
 * @returns {string[]}       'money' | 'time' | 'mode' | 'deliverables'
 */
function changedTerms(original, edits) {
  const t = original || {};
  const e = edits || {};
  const out = [];

  // Money is one term even when it has two parts: a hybrid deal moving either the fee or
  // the percentage has moved "the money" once, not twice.
  const movedPct = t.money?.commission_pct != null
    && asText(e.commission) !== asText(t.money.commission_pct);
  const movedFee = t.money?.fee != null
    && asText(e.fee) !== asText(t.money.fee);
  if (movedPct || movedFee) out.push('money');

  const origDate = t.time?.post_by || t.time?.window_end || '';
  if (asText(e.postBy) !== asText(origDate)) out.push('time');

  // Compared as the stored value, so choosing "remote" then "store visit" again counts as
  // no change — she ended up where she started.
  if (toMode(e.place, e.shipping) !== (t.mode || '')) out.push('mode');

  const paid = t.aim === 'engagement' || t.aim === 'hybrid';
  if (paid && e.deliverables) {
    const asked = (type) => {
      const hit = (t.deliverables || []).find(x => x.type === type);
      return hit ? Number(hit.count) : 0;
    };
    const same = FORMATS.every(f => (Number(e.deliverables[f]) || 0) === asked(f));
    if (!same) out.push('deliverables');
  }

  return out;
}

/**
 * Build the counter payload from the changes — and only from the changes.
 *
 * No importance marker anywhere: deliverables and working style are always negotiable, and
 * the terms model refuses a marker on either.
 */
function buildCounter(original, edits, changed) {
  const t = original || {};
  const e = edits || {};
  const moved = changed || changedTerms(t, e);
  const c = {};

  if (moved.includes('money')) {
    const money = { ...t.money };
    if (t.money?.commission_pct != null && e.commission !== '' && e.commission != null) {
      money.commission_pct = Number(e.commission);
    }
    if (t.money?.fee != null && e.fee !== '' && e.fee != null) {
      money.fee = Number(e.fee);
    }
    c.money = money;
  }

  // Always post_by. A window is refused by the terms model, and a counter that silently
  // fails is worse than one that never offered the option.
  if (moved.includes('time') && e.postBy) c.time = { post_by: e.postBy };

  if (moved.includes('mode')) {
    const m = toMode(e.place, e.shipping);
    if (m) c.mode = m;
  }

  if (moved.includes('deliverables') && e.deliverables) {
    const list = FORMATS
      .filter(f => Number(e.deliverables[f]) > 0)
      .map(f => ({ type: f, count: Number(e.deliverables[f]) }));
    if (list.length) c.deliverables = list;
  }

  return c;
}

module.exports = { changedTerms, buildCounter, FORMATS };
