'use strict';

/**
 * What a creator is allowed to sell, said in words.
 *
 * Contract: features/brief-straight-to-signing
 *
 * Founder, 2026-08-28: the contract must "contain all details of campaign clearly".
 *
 * A creator's entire commission depends on WHICH of the brand's products she may sell, and until
 * now no creator-facing screen said so anywhere. The brand picked it in the set wizard ("Set what
 * she can sell"), it was stored on campaign_influencers, and it was read by the follower storefront
 * and the payout maths — but never shown to the one person whose earnings it decides.
 *
 * ONE describer, on the server, so the contract screen and the collab screen cannot end up saying
 * two different things about the same row. This repo has paid for a duplicated vocabulary three
 * times: the offer builders, the offer-type normaliser, and the second step model deleted in
 * Stage 3. Not a fourth time.
 */

/**
 * @param {object} alloc   the alloc_* columns off campaign_influencers
 * @returns {{ label: string, detail: string|null }}
 *   label  — the short answer, for a field value
 *   detail — the longer sentence, or null when the label already says everything
 */
function describeAllocation(alloc) {
  const scope = alloc && alloc.alloc_scope;

  if (scope === 'store') {
    return {
      label: 'Everything in the store',
      detail: 'Any product the brand sells counts towards your commission.',
    };
  }

  if (scope === 'category') {
    const name = (alloc.alloc_category || '').trim();
    return {
      // Without a name we must not invent one. "One category" is less useful and still true.
      label: name || 'One category',
      detail: name
        ? `Only ${name} counts towards your commission. Sales of anything else do not.`
        : 'Only one category counts towards your commission. Ask the brand which one.',
    };
  }

  if (scope === 'products') {
    const ids = Array.isArray(alloc.alloc_product_ids) ? alloc.alloc_product_ids : [];
    const n = ids.length;
    return {
      // Not '0 chosen products' — that reads like a number she should accept.
      label: n === 0 ? 'Nothing chosen yet' : n === 1 ? '1 chosen product' : `${n} chosen products`,
      detail: n === 0
        // A 'products' scope with an empty list earns her nothing. Say that, rather than
        // printing "0 chosen products" and letting her sign it.
        ? 'No products have been chosen yet — nothing would count towards your commission. Ask the brand to fix this before you sign.'
        : `Only these ${n === 1 ? 'product' : `${n} products`} count towards your commission. Sales of anything else do not.`,
    };
  }

  // Nothing set. On a commission collaboration that is a real problem and she should not have to
  // discover it after signing; on a pay-for-content one it is simply not applicable, and the
  // caller decides whether to show this card at all.
  return { label: 'Not set yet', detail: null };
}

module.exports = { describeAllocation };
