/**
 * Item 5 — the multi-creator draft. It lives in the app until Send (prompt §11 assumption 5,
 * founder Q9): nothing half-finished is ever stored on the server. One draft per set.
 * Contract: features/item5-invitations
 *
 *   startDraft(setId, { set, campaignName, creators, sourceGroupId })
 *   getDraft(setId) → { set, campaignName, creators[], terms{id→terms}, minimums{id→{fee,commissionPct}}, sourceGroupId, over50Confirmed }
 *   setTerms / copyTermsToAll / removeCreators / clearDraft
 *   defaultTerms(goal) · validateLocal(goal, terms) · toServer(terms) · summaryLine(goal, terms)
 *
 * ── The basket ───────────────────────────────────────────────────────────────
 * Founder, 2026-09-17: "i can able to add pool creators, from group and from list of creators
 * selected manually ...but navigation to add creators is not actually supporting this."
 *
 * It did not, because the picker held its selection in its own useState while the group check
 * was a separate screen that called startDraft directly — so opening a group threw the picker's
 * picks away. The selection now lives here, where both screens can reach it, and the draft is
 * started once from whatever the basket holds.
 *
 *   getBasket(setId) → creator[]   ·   basketIds(setId) → Set
 *   addToBasket(setId, creators, sourceGroupId) → { added, already }
 *   toggleInBasket / removeFromBasket / clearBasket
 *
 * A creator carries the group she arrived from. One send can now mix sources, so "where this
 * came from" is per creator and no longer one label for the whole batch.
 */
import { MSG5, DELIVERABLE_TYPES, USAGE_PLACES, deliverablesShort, rupees5, fmtPct5 } from './copy5';

const drafts = new Map();
/** setId → Map(creatorId → creator). The picker's selection, survives leaving the picker. */
const baskets = new Map();

const bag = (setId) => { if (!baskets.has(setId)) baskets.set(setId, new Map()); return baskets.get(setId); };

export const getBasket = (setId) => [...bag(setId).values()];
export const basketIds = (setId) => new Set(bag(setId).keys());
export const basketSize = (setId) => bag(setId).size;
export const clearBasket = (setId) => { baskets.delete(setId); };
export const removeFromBasket = (setId, id) => { bag(setId).delete(id); };

/** Tick or untick one creator. Returns true if she is now in. */
export function toggleInBasket(setId, c) {
  const m = bag(setId);
  if (m.has(c.id)) { m.delete(c.id); return false; }
  m.set(c.id, { ...c });
  return true;
}

/**
 * Add several at once — the group check's door back into the picker. A creator already in the
 * basket is left exactly as she is: her source, and any pool terms she arrived with, are not
 * overwritten by a later group. Returns what actually happened so the screen can say so.
 */
export function addToBasket(setId, creators, sourceGroupId = null) {
  const m = bag(setId);
  let added = 0;
  const already = [];
  for (const c of creators || []) {
    if (m.has(c.id)) { already.push(c); continue; }
    m.set(c.id, { ...c, sourceGroupId: sourceGroupId || c.sourceGroupId || null });
    added += 1;
  }
  return { added, already };
}

export function startDraft(setId, { set, campaignName, creators, sourceGroupId = null }) {
  // Back-compat: a caller that still names one group for the whole send stamps it on everyone
  // who did not bring her own. The picker passes none and lets each creator carry her own.
  if (sourceGroupId) creators = (creators || []).map(c => ({ ...c, sourceGroupId: c.sourceGroupId || sourceGroupId }));
  // Terms typed earlier for the same creator survive a trip back to the picker — but only while
  // the set's Aim is the same, because the shape of the terms follows the Aim.
  const prev = drafts.get(setId);
  const keep = prev && prev.set && prev.set.goal === set.goal ? prev.terms : {};
  const terms = {};
  // Item 6 (N16): a creator picked from the pool arrives with the money both sides already
  // agreed, so the field is filled in and the screen says where it came from. Terms only travel
  // when the Aim matches — the server sends none when it does not (rules v1.18 §7B).
  for (const c of creators) terms[c.id] = keep[c.id] || (c.poolTerms ? fromPoolTerms(set.goal, c.poolTerms) : defaultTerms(set.goal));
  drafts.set(setId, { set, campaignName, creators: [...creators], terms, minimums: (prev && prev.minimums) || {}, sourceGroupId, over50Confirmed: false });
  return drafts.get(setId);
}
export const getDraft = (setId) => drafts.get(setId) || null;
export const clearDraft = (setId) => { drafts.delete(setId); };
export function setTerms(setId, creatorId, terms) { const d = drafts.get(setId); if (d) d.terms[creatorId] = { ...terms }; }
export function setMinimums(setId, byId) { const d = drafts.get(setId); if (d) d.minimums = { ...d.minimums, ...byId }; }
export function markOver50Confirmed(setId) { const d = drafts.get(setId); if (d) d.over50Confirmed = true; }
export function removeCreators(setId, ids) {
  const d = drafts.get(setId); if (!d) return;
  const gone = new Set(ids);
  d.creators = d.creators.filter(c => !gone.has(c.id));
  for (const id of gone) delete d.terms[id];
  // The basket is what the picker shows. Dropping a creator from the draft without dropping her
  // from the basket would put her back on the next visit to Add creators.
  for (const id of gone) bag(setId).delete(id);
}

/**
 * "Use these terms for everyone": the money, the selling scope, the deliverables, the usage
 * rights and a SAVED offer choice. Never a special offer — it was made for one creator
 * (founder Q9). Every creator stays editable afterwards.
 */
export function copyTermsToAll(setId, fromId) {
  const d = drafts.get(setId); if (!d) return;
  const src = d.terms[fromId]; if (!src) return;
  for (const c of d.creators) {
    if (c.id === fromId) continue;
    const mine = d.terms[c.id] || defaultTerms(d.set.goal);
    d.terms[c.id] = {
      ...mine,
      commissionPct: src.commissionPct, fee: src.fee,
      // creator-terms-v2 (rules 2.5): copies the offer selection and the product list too.
      sellOffers: (src.sellOffers || []).map(o => ({ ...o })),
      sellMode: src.sellMode || 'none', sellProductIds: [...(src.sellProductIds || [])],
      sellProducts: [...(src.sellProducts || [])], sellAllCount: src.sellAllCount || 0,
      deliverables: (src.deliverables || []).map(r => ({ ...r })),
      posts: src.posts,      // item 21 (R10)
      usage: { ...src.usage, places: [...(src.usage.places || [])] },
    };
  }
}

/** Item 6 — the agreed snapshot from a pool entry, in the draft's shape. */
export function fromPoolTerms(goal, s) {
  const t = defaultTerms(goal);
  if (!s) return t;
  if (s.commissionPct != null) t.commissionPct = String(s.commissionPct);
  if (s.fee != null) t.fee = String(s.fee);
  if (Array.isArray(s.deliverables) && s.deliverables.length) t.deliverables = s.deliverables.map(d => ({ ...d }));
  if (s.usageRights && s.usageRights.on) t.usage = { on: true, durationDays: s.usageRights.durationDays, places: [...(s.usageRights.places || [])] };
  return t;
}

export function defaultTerms(goal) {
  return {
    commissionPct: '', fee: '',
    // creator-terms-v2 (rules §2): what she can sell = her offers + products without offers.
    //   sellOffers: [{ id, name, products, deal, type_label, ends_on, ends_soon }] — linked, not copied
    //   sellMode: 'none' | 'all' | 'chosen'  ·  sellProductIds / sellProducts (chosen)  ·  sellAllCount (all)
    sellOffers: [], sellMode: 'none', sellProductIds: [], sellProducts: [], sellAllCount: 0,
    deliverables: goal === 'engagement' ? [{ type: 'reel', count: 1 }] : [],
    // Item 21 (rules v1.34 §7A): on Pay for Content, how many shoppable posts she makes in INFLX (1–10).
    posts: goal === 'engagement' ? '1' : '',
    note: '',
    usage: { on: false, durationDays: 30, places: [] },
  };
}

const num = (v) => (v === '' || v == null ? null : Number(v));
const selling = (goal) => goal === 'conversion' || goal === 'hybrid';

/** The §7 rules as the app checks them before the server does. Returns { field: message }. */
export function validateLocal(goal, t) {
  const e = {};
  if (selling(goal)) {
    const c = num(t.commissionPct);
    if (c == null || Number.isNaN(c)) e.commissionPct = MSG5.COMMISSION_REQUIRED;
    else if (c <= 0 || c > 100) e.commissionPct = MSG5.COMMISSION_RANGE;
    // creator-terms-v2 (rules 2.2): at least one offer or one product without an offer. The screen
    // words it with her first name (MSG5.SELL_NOTHING).
    if (!sellsSomething(t)) e.sell = 'SELL_NOTHING';
  }
  if (goal === 'engagement') {
    const f = num(t.fee);
    if (f == null || Number.isNaN(f) || f <= 0 || !Number.isInteger(f)) e.fee = MSG5.FEE_REQUIRED;
    // Item 21: the posts number (1–10) and what she posts about are required, as for a selling Aim.
    const p = num(t.posts);
    if (p == null || Number.isNaN(p) || !Number.isInteger(p) || p < 1 || p > 10) e.posts = MSG5.POSTS_N;
    if (!sellsSomething(t)) e.sell = 'POST_ABOUT_NOTHING';
    const rows = t.deliverables || [];
    if (!rows.length) e.deliverables = MSG5.DELIVERABLES_EMPTY;
    else {
      const seen = new Set();
      for (const r of rows) {
        const n = Number(r.count);
        if (!DELIVERABLE_TYPES.find(x => x.code === r.type)) { e.deliverables = MSG5.DELIVERABLES_EMPTY; break; }
        if (!Number.isInteger(n) || n < 1 || n > 20) { e.deliverables = MSG5.DELIVERABLE_COUNT; break; }
        if (seen.has(r.type)) { e.deliverables = MSG5.DELIVERABLE_DUP; break; }
        seen.add(r.type);
      }
    }
    if (t.usage && t.usage.on && !(t.usage.places || []).length) e.usage = MSG5.USAGE_PLACE;
  }
  if (goal === 'hybrid') {
    const f = num(t.fee);
    if (f == null || Number.isNaN(f) || f <= 0) e.fee = MSG5.HYBRID_FEE;
  }
  if ((t.note || '').length > 300) e.note = MSG5.NOTE_LONG;
  return e;
}

/** What the server receives per creator (either spelling is accepted; this is the camel one). */
export function toServer(goal, t) {
  const out = {};
  if (selling(goal)) out.commissionPct = num(t.commissionPct);
  if (selling(goal) || goal === 'engagement') {
    // creator-terms-v2: offers are linked by id; the product list is frozen by the server at sending.
    // Item 21: the Entire store is a rule — sent as a mode, with nothing to list; Pay for Content
    // sends what she posts about the same way.
    out.offers = t.sellMode === 'store' ? [] : (t.sellOffers || []).map(o => o.id);
    out.productsWithoutOffers = t.sellMode === 'store' ? { mode: 'store' }
      : t.sellMode === 'chosen' ? { mode: 'chosen', productIds: [...(t.sellProductIds || [])] }
        : { mode: t.sellMode === 'all' ? 'all' : 'none' };
  }
  if (goal !== 'conversion') out.fee = num(t.fee);
  if (goal === 'engagement') {
    out.shoppablePosts = num(t.posts);
    out.deliverables = (t.deliverables || []).map(r => ({ type: r.type, count: Number(r.count) || 1 }));
    if (t.usage && t.usage.on) out.usageRights = { on: true, durationDays: t.usage.durationDays == null ? null : Number(t.usage.durationDays), places: t.usage.places || [] };
  }
  if (t.note && t.note.trim()) out.note = t.note.trim();
  return out;
}

/** How many products without offers she gets (chosen → the ticked ones; all → the list's size). */
export function sellProductCount(t) {
  if (t.sellMode === 'chosen') return (t.sellProductIds || []).length;
  if (t.sellMode === 'all') return t.sellAllCount || 0;
  return 0;
}
/** Does she get anything to sell or post about? The Entire store always counts (item 21). */
export const sellsSomething = (t) => t.sellMode === 'store' || !!sellProductCount(t) || !!(t.sellOffers || []).length;

/** "2 offers + 12 products" · "1 offer · no other products" · "40 products at normal price" (T7) · "your entire store" (item 21) */
export function sellWords(t) {
  if (t.sellMode === 'store') return 'your entire store';
  const o = (t.sellOffers || []).length, p = sellProductCount(t);
  const off = `${o} ${o === 1 ? 'offer' : 'offers'}`, pr = `${p} ${p === 1 ? 'product' : 'products'}`;
  if (o && p) return `${off} + ${pr}`;
  if (o) return `${off} · no other products`;
  if (p) return `${pr} at normal price`;
  return 'nothing to sell yet';
}

/** Days after posting of the soonest-ending offer that "ends soon" (T7 chip), or null. */
export function endsSoonDays(t) {
  const soon = (t.sellOffers || []).filter(o => o.ends_soon).map(o => o.ends_soon.days_after_posting);
  return soon.length ? Math.min(...soon) : null;
}

/** "10% · 2 offers + 12 products" / "₹8,000 · 1 reel, 2 stories" / "₹5,000 + 8% · 1 offer · no other products" */
export function summaryLine(goal, t) {
  if (goal === 'engagement') return [t.fee !== '' && t.fee != null ? rupees5(t.fee) : null, deliverablesShort(t.deliverables)].filter(Boolean).join(' · ');
  const money = goal === 'hybrid' ? [t.fee !== '' && t.fee != null ? rupees5(t.fee) : null, fmtPct5(t.commissionPct)].filter(Boolean).join(' + ') : fmtPct5(t.commissionPct);
  return [money, sellWords(t)].filter(Boolean).join(' · ');
}

export const usagePlaceLabel = (code) => (USAGE_PLACES.find(p => p[0] === code) || [])[1] || code;
