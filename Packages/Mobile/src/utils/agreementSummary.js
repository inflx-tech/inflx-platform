import { fromMode } from './workingStyle';

/**
 * agreementSummary.js — how a settled agreement is described in one line.
 * Contract: features/stage-2-build-a-campaign-from-the-phone (slice 5)
 *
 * WHY THIS IS A MODULE AND NOT A FUNCTION IN A SCREEN
 * Stage 1 put this logic inside BrandCreatorsScreen, where the Agreed tab uses it. Stage 2
 * needs the same line in three more places — the wizard's agreement pick-list (#72), the
 * agreement detail it opens (#75), and the read-back at step 4 (#78). Copying it would be
 * the fault this programme has already had to fix four times: two things doing one job,
 * only one of them getting the change. So it moves here and the Creators tab reads it from
 * here too.
 *
 * The rules it encodes, all of which were learned the hard way:
 *   · a SALES agreement has no fee — showing "₹0" told creators the work was unpaid, which
 *     is the defect collabPay exists to kill. Commission is the money on those.
 *   · deliverables read as "2 reels · 1 story", never "3 deliverables". A count alone
 *     briefs nobody.
 *   · working style is read from the STORED value via workingStyle.fromMode, never by
 *     matching on the sentence a screen happens to print. Matching on prose breaks the
 *     moment that wording is edited.
 */

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const DEL_WORD = {
  reel: 'reel', post: 'post', story: 'story',
  youtube_video: 'YouTube video', youtube_short: 'YouTube Short',
};

/** The aim, in the words a brand uses rather than the enum the database stores. */
export const AIM_LABEL = {
  conversion: 'Pay per sale',
  engagement: 'Pay for content',
  hybrid:     'Fee + commission',
};

/** Friendly aim names for the wizard's three cards. */
export const AIM_SHORT = {
  conversion: 'Sales',
  engagement: 'Content',
  hybrid:     'Both',
};

export const aimOf = (terms) => (terms && terms.aim) || null;

/** Money and time — the two terms a conversation row always shows. */
export function termsLine(t) {
  if (!t) return '';
  const bits = [];
  if (t.money?.fee != null) bits.push(money(t.money.fee));
  if (t.money?.commission_pct != null) bits.push(`${t.money.commission_pct}%`);
  if (t.time?.post_by) bits.push(`post by ${String(t.time.post_by).slice(0, 10)}`);
  return bits.join(' · ');
}

/**
 * What was actually SETTLED — the reason an agreement row exists.
 *
 * termsLine above is for a conversation in flight, where money and the date are what keep
 * changing. An agreement is finished, and the brand reading it is about to brief the
 * creator: it needs to say what the fee BUYS and where she works, because those are the
 * two things a brief has to be written around.
 */
export function settledLine(t) {
  if (!t) return '';
  const bits = [];
  if (t.money?.fee != null) bits.push(money(t.money.fee));
  if (t.money?.commission_pct != null) bits.push(`${t.money.commission_pct}% per sale`);
  if (Array.isArray(t.deliverables) && t.deliverables.length) {
    t.deliverables.forEach((d) => {
      const w = DEL_WORD[d.type] || d.type;
      bits.push(`${d.count} ${w}${d.count > 1 ? 's' : ''}`);
    });
  }
  const { place, shipping } = fromMode(t.mode);
  if (place === 'visit') bits.push('store visit');
  else if (place === 'remote') bits.push(shipping === 'yes' ? 'remote, you ship' : 'remote');
  return bits.join(' · ');
}

/**
 * Days until an agreement lapses. NULL when it carries no clock — which must sort LAST
 * rather than first, so a row with no deadline never jumps ahead of one that is running
 * out. 90 days unbriefed and the whole negotiation is lost.
 */
export function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt) - Date.now()) / 86400000);
}

/** The countdown as the pick-list prints it. Red under 14 days is the caller's job. */
export function expiryLine(expiresAt) {
  const d = daysLeft(expiresAt);
  if (d == null) return 'READY TO BRIEF';
  if (d <= 0) return 'EXPIRED';
  return `${d} DAY${d === 1 ? '' : 'S'} LEFT`;
}

/** Soonest-expiring first; no-clock rows at the end. */
export function byExpiry(agreements) {
  return [...(agreements || [])].sort((x, y) => {
    const a = x.expires_at ? new Date(x.expires_at).getTime() : Infinity;
    const b = y.expires_at ? new Date(y.expires_at).getTime() : Infinity;
    return a - b;
  });
}

/**
 * The allocation an agreement already implies, if the creator stated what she'd promote.
 * Returns the shape the invite endpoint takes, or null when nothing was agreed — in which
 * case step 4 reads "Not set yet" and the brand must choose before publishing.
 */
export function allocationFromTerms(t) {
  const scope = t && t.scope;
  if (!scope || !scope.level) return null;
  return {
    alloc_scope: scope.level,
    alloc_category: scope.category || null,
    alloc_category_node_id: scope.category_node_id || null,
    alloc_product_ids: Array.isArray(scope.product_ids) ? scope.product_ids : null,
  };
}

/** "Their whole store" · "Sarees" · "3 selected products" · "Not set yet". */
export function allocationLabel(alloc) {
  if (!alloc || !alloc.alloc_scope) return 'Not set yet';
  if (alloc.alloc_scope === 'store') return 'Your whole store';
  if (alloc.alloc_scope === 'category') return alloc.alloc_category || 'A category';
  const n = Array.isArray(alloc.alloc_product_ids) ? alloc.alloc_product_ids.length : 0;
  return n ? `${n} selected product${n === 1 ? '' : 's'}` : 'Specific products — none chosen';
}

/**
 * What her shoppers get, in one line. Named so the row reads as a sentence rather than as a
 * field: "Her shoppers get — 3% off, until 30 Sep".
 *
 * "None" is deliberate rather than blank. An offer is optional, and a blank space beside a
 * label reads as something that failed to load.
 *
 * stage-a — moved here from BrandSetWizardScreen so CreatorTermsScreen (SB-30) reads the
 * same sentence rather than growing its own copy.
 */
export function offerLine(offer) {
  if (!offer) return 'None';
  const bits = [offer.name || String(offer.offer_type || 'Offer').replace('_', ' ')];
  if (offer.valid_until) bits.push(`until ${fmtShort(offer.valid_until)}`);
  else if (offer.valid_from) bits.push(`from ${fmtShort(offer.valid_from)}`);
  return bits.join(' · ');
}

const fmtShort = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export { money as fmtAgreementMoney };
