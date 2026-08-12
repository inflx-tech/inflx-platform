'use strict';

// db is required lazily inside recompute() so the pure rule below can be imported and
// tested without booting the database config. The rule is the part worth pinning.

/**
 * The campaign's money and its end date are DERIVED from its sets — never typed by the
 * brand. Contract: features/collab-part5-sales-aim-separation.
 *
 * Why derive at all: the brand was previously asked for a total budget and an end date on
 * screen 1, before a single set existed and therefore before the campaign's aim was known.
 * Both answers then had to agree with details entered later, which is where
 * "set budgets exceed campaign budget" and "window end cannot be after campaign end" came
 * from. A value defined as a function of its own parts cannot disagree with them, so both
 * error classes disappear by construction rather than by being suppressed.
 *
 *   total_budget — the sum of set_budget over PAID sets (engagement/hybrid). A conversion
 *                  set carries no upfront money by design, so it contributes nothing.
 *
 *   end_date     — NULL if ANY set is conversion. A sales collaboration has no end (the
 *                  founder's model: it runs until stock is gone), and a paid set sharing
 *                  the campaign must not impose its deadline on open-ended selling. Only
 *                  when every set is paid does the campaign take the latest posting-window
 *                  end among them.
 *
 * The end-date rule is the one that looks wrong until you check: EVERY set carries a
 * posting window regardless of aim, sales sets included. Deriving the campaign end from
 * all windows — the symmetrical move to the budget sum — would have closed a sales
 * campaign on its post-by date and pulled every product out of follower discovery while
 * stock remained. Posting and selling are different clocks.
 *
 * `window_end` is the field the wizard actually writes. `campaign_sets.content_end_date`
 * exists and is read by production.service, but nothing in either app has ever written it,
 * so it cannot contribute here.
 */

const PAID_GOALS = ['engagement', 'hybrid'];

/**
 * Recompute and persist a campaign's derived total_budget and end_date from its sets.
 * Safe to call inside a transaction by passing the client.
 * Returns the values written, so callers can hand them straight back to the client
 * instead of re-reading (and so tests can assert the delivered value, not the query).
 */
async function recompute(campaignId, client = null) {
  // eslint-disable-next-line global-require
  const conn = client || require('../config/db');
  const { rows: sets } = await conn.query(
    `SELECT goal, set_budget, window_end FROM campaign_sets WHERE campaign_id = $1`,
    [campaignId]
  );

  // The rule lives in derive() alone — recompute is read, derive, write. Stating it twice
  // is how the two paths would eventually disagree.
  const { total_budget: totalBudget, end_date: endDate } = derive(sets);

  await conn.query(
    `UPDATE campaigns SET total_budget = $2, end_date = $3 WHERE id = $1`,
    [campaignId, totalBudget, endDate]
  );

  return { total_budget: totalBudget, end_date: endDate };
}

/** The rule. The single place either path may express it. */
function derive(sets) {
  const total = sets.reduce(
    (sum, s) => (PAID_GOALS.includes(s.goal) ? sum + parseFloat(s.set_budget || 0) : sum),
    0
  );
  const hasSales = sets.some(s => s.goal === 'conversion');
  const paidEnds = sets
    .filter(s => PAID_GOALS.includes(s.goal))
    .map(s => s.window_end)
    .filter(Boolean);
  return {
    total_budget: total > 0 ? parseFloat(total.toFixed(2)) : null,
    end_date: !hasSales && paidEnds.length > 0
      ? paidEnds.reduce((latest, d) => (d > latest ? d : latest))
      : null,
  };
}

module.exports = { recompute, derive, PAID_GOALS };
