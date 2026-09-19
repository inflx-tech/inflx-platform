/**
 * completeness.js — the words around the server's completeness object
 * `{ total, done, complete, missing:[keys], missing_labels:[words] }`, which is the same shape
 * on GET /brands/me and GET /influencers/me. Contract: features/registration-and-profile
 */

/** "photo, bio, niche and languages" */
export function joinLabels(labels) {
  const l = (labels || []).filter(Boolean);
  if (!l.length) return '';
  if (l.length === 1) return l[0];
  return `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
}

/** "Photo, bio, age, gender" — the amber note's second line. */
export function listLabels(labels) {
  const l = (labels || []).filter(Boolean);
  if (!l.length) return '';
  const first = l[0].charAt(0).toUpperCase() + l[0].slice(1);
  return [first, ...l.slice(1)].join(', ');
}

export function thingsLeft(n) { return `${n} ${n === 1 ? 'thing' : 'things'} left`; }
export function finishItems(n) { return `Finish the ${n} ${n === 1 ? 'item' : 'items'} above to submit`; }

/** Which rows own which missing keys, so each row can carry a red dot. */
export const CREATOR_ROW_KEYS = {
  info: ['full_name', 'photo', 'city', 'state', 'age', 'gender', 'bio', 'handle'],
  niche: ['niche', 'language'],
};
export const BRAND_ROW_KEYS = {
  details: ['logo', 'about', 'contact_person', 'business_name', 'contact_name'],
  subs: ['sub_categories'],
  branches: ['address_line', 'pincode', 'state', 'city'],
};
export function rowNeeds(keys, missing) {
  const m = new Set(missing || []);
  return keys.some((k) => m.has(k));
}

/** "18 Sep" */
export function shortDay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${M[d.getMonth()]}`;
}

export const REVIEW_COPY = {
  underReview: 'Under review',
  submit: 'Submit for review',
  sent: (iso) => `Sent for review · ${shortDay(iso)}`,
  status: { approved: 'Approved', pending: 'Under review', rejected: 'Needs a fix', suspended: 'Suspended' },
};
