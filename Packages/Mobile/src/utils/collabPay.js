const { fmtRupees } = require('../theme/tokens');

/**
 * collabPay.js — what a creator actually earns, in the shape the deal has.
 * Contract: features/collab-terms-by-aim (item 1)
 *
 * THE BUG THIS EXISTS TO KILL:
 * Every money line on the creator's campaign screen read
 *   agreed_fee || influencer_budget || 0
 * A sales collaboration has no fee — she earns a percentage of what she sells — so all
 * four of them rendered "₹0" and told her the work was unpaid. The commission was being
 * sent by the server the whole time; the screen never asked for it.
 *
 * Four live campaigns were in that state when this was written: 18%, 15%, 20% and 22%,
 * every one of them displaying ₹0 to the creator.
 *
 * It lives here rather than inside the screen because it is money. A number that decides
 * whether someone accepts work should be checkable without a handset.
 *
 * ON READING THE SHAPE RATHER THAN TRUSTING THE LABEL:
 * `goal` is the campaign's stated aim, but a row can disagree with it — a conversion set
 * carrying a fee, or an older row with no goal at all. So the money present decides, and
 * the goal only breaks the tie. Showing "₹0" because a label said conversion would be the
 * same failure wearing a different hat.
 */

/**
 * @param {object} c   the campaign row: goal, commission_pct, agreed_fee, influencer_budget
 * @returns {{headline:string, note:string|null, label:string, value:string, short:string}}
 *   headline — the big number
 *   note     — the sentence under it; a bare percentage still leaves her guessing
 *   label    — what to call it in a terms list
 *   value    — the same figure, inline
 *   short    — for a confirmation prompt, where there is no room for two lines
 */
function describePay(c = {}) {
  const pct = c.commission_pct != null && c.commission_pct !== '' ? Number(c.commission_pct) : null;
  const feeRaw = c.agreed_fee != null && c.agreed_fee !== '' ? c.agreed_fee
    : (c.influencer_budget != null && c.influencer_budget !== '' ? c.influencer_budget : null);
  const fee = feeRaw != null ? Number(feeRaw) : null;

  const hasPct = pct != null && !Number.isNaN(pct) && pct > 0;
  const hasFee = fee != null && !Number.isNaN(fee) && fee > 0;

  // Both — she is paid to make it AND paid again on what it sells.
  if (hasPct && hasFee) {
    return {
      headline: fmtRupees(fee),
      note: `plus ${pct}% of what you sell`,
      label: 'Fee + commission',
      value: `${fmtRupees(fee)} + ${pct}%`,
      short: `${fmtRupees(fee)} + ${pct}%`,
    };
  }

  // Commission only. The note is not decoration: "18%" alone does not say of what.
  if (hasPct) {
    return {
      headline: `${pct}%`,
      note: 'of everything you sell',
      label: 'Commission',
      value: `${pct}%`,
      short: `${pct}% commission`,
    };
  }

  if (hasFee) {
    return {
      headline: fmtRupees(fee),
      note: null,
      label: 'Fee',
      value: fmtRupees(fee),
      short: fmtRupees(fee),
    };
  }

  // Nothing settled yet. "Not set yet" is honest; "₹0" is a claim that she works for
  // nothing, and that is the exact lie this module was written to stop.
  return {
    headline: c.goal === 'conversion' ? '—' : fmtRupees(0),
    note: c.goal === 'conversion' ? 'commission not set yet' : null,
    label: c.goal === 'conversion' ? 'Commission' : 'Fee',
    value: c.goal === 'conversion' ? 'Not set yet' : fmtRupees(0),
    short: c.goal === 'conversion' ? 'commission to be agreed' : fmtRupees(0),
  };
}

module.exports = { describePay };
