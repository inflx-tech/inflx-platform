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
 * A paid set's own budget, when the caller did not type one.
 * Contract: features/stage-2-build-a-campaign-from-the-phone (§5.2)
 *
 * THE BOARD vs THE CODE
 * FINAL 2 draws a content set's budget as "calculated — adds up from what you agreed with
 * each creator at step 3". createSet, until this change, REQUIRED it to be typed. The
 * phone wizard has no sensible moment to type it: the fees are already settled, one per
 * creator, and asking the brand to re-enter their sum is asking them to get it wrong.
 *
 * WHY THIS ONLY FILLS NULLS, AND ONLY FOR HANDPICK SETS
 * The first draft of this made the derivation unconditional — every paid set's budget
 * becomes the sum of its creators' fees. Reading brand-web's own validation stopped that:
 *
 *   · web line 827 allows the typed budget to EXCEED the sum of the per-creator fees, on
 *     purpose. That headroom is the brand's, and overwriting it would shrink a budget they
 *     deliberately padded.
 *   · an OPEN-GROUP paid set has no creator list at all — its money is a projection,
 *     per_influencer_budget × max_cap. Summing an empty roster would write zero and then
 *     publish would refuse the campaign for having no budget.
 *
 * So: a typed budget is always kept. NULL on a paid HANDPICK set means "derive me", which
 * is the same idiom campaign_influencers.alloc_scope already uses for "not yet set".
 *
 * AND ONLY WHILE THE CAMPAIGN IS A DRAFT. This guard was NOT in the design — it came out
 * of checking production before shipping. There is a LIVE campaign ("Festive Season 2026",
 * status active) whose engagement set carries set_budget NULL while its two creators hold
 * ₹55,000 of agreed fees. Without this line, the first later set write would have filled
 * that in and moved an ACTIVE campaign's total_budget from NULL to 55000 — a money field
 * that escrow and the wallet gate both read, on a campaign whose fee base was locked at
 * publish. More "correct" is not the same as safe to change underneath a running
 * campaign. Building a campaign only ever happens in draft, so the board loses nothing.
 *
 * The status exclusions below are the real enum, checked against production: 'cancelled'
 * is NOT a campaign_influencer_status value, so it must not appear here.
 */
const SPENT_STATUSES_EXCLUDED = ['declined', 'expired', 'rejected_by_brand', 'slots_filled'];

async function recomputeSetBudgets(campaignId, conn) {
  const { rows } = await conn.query(
    `UPDATE campaign_sets s
        SET set_budget = COALESCE((
              SELECT SUM(COALESCE(ci.agreed_fee, 0))
                FROM campaign_influencers ci
               WHERE ci.set_id = s.id
                 AND ci.status <> ALL($3::campaign_influencer_status[])
            ), 0)
       FROM campaigns c
      WHERE c.id = s.campaign_id
        AND s.campaign_id = $1
        AND c.status = 'draft'
        AND s.goal = ANY($2)
        AND s.set_budget IS NULL
        AND COALESCE(s.influencer_mode, 'handpick') = 'handpick'
      RETURNING s.id, s.set_budget`,
    [campaignId, PAID_GOALS, SPENT_STATUSES_EXCLUDED]
  );
  return rows;
}

/**
 * Recompute and persist a campaign's derived total_budget and end_date from its sets.
 * Safe to call inside a transaction by passing the client.
 * Returns the values written, so callers can hand them straight back to the client
 * instead of re-reading (and so tests can assert the delivered value, not the query).
 *
 * Set budgets are filled FIRST, so the campaign total is a sum over numbers that are
 * themselves already correct. Two entry points expressing that order separately is how
 * they would eventually disagree.
 */
async function recompute(campaignId, client = null) {
  // eslint-disable-next-line global-require
  const conn = client || require('../config/db');
  await recomputeSetBudgets(campaignId, conn);
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

module.exports = { recompute, recomputeSetBudgets, derive, PAID_GOALS };
