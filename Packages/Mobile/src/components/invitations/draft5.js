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
import { MSG5, DELIVERABLE_TYPES, USAGE_PLACES, deliverablesShort, rupees5, fmtPct5, SCOPE_LABEL } from './copy5';

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
      scope: src.scope, categoryNodeId: src.categoryNodeId, categoryName: src.categoryName, productIds: [...(src.productIds || [])], products: [...(src.products || [])],
      deliverables: (src.deliverables || []).map(r => ({ ...r })),
      usage: { ...src.usage, places: [...(src.usage.places || [])] },
      offer: src.offer && src.offer.kind === 'library' ? { ...src.offer } : (src.offer && src.offer.kind === 'special' ? mine.offer : src.offer),
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
    scope: 'store', categoryNodeId: null, categoryName: null, productIds: [], products: [],
    deliverables: goal === 'engagement' ? [{ type: 'reel', count: 1 }] : [],
    note: '',
    usage: { on: false, durationDays: 30, places: [] },
    offer: null, // null | { kind:'library', brandOfferId, name, line } | { kind:'special', offerType, offerConfigJson, name, saveToLibrary, validFrom, validUntil, line }
    offerValidFrom: null, offerValidUntil: null,
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
    if (t.scope === 'category' && !t.categoryNodeId) e.scope = MSG5.SCOPE_CATEGORIES;
    if (t.scope === 'products' && !(t.productIds || []).length) e.scope = MSG5.SCOPE_PRODUCTS;
  }
  if (goal === 'engagement') {
    const f = num(t.fee);
    if (f == null || Number.isNaN(f) || f <= 0 || !Number.isInteger(f)) e.fee = MSG5.FEE_REQUIRED;
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
  if (selling(goal)) {
    out.commissionPct = num(t.commissionPct);
    out.scope = t.scope || 'store';
    if (t.scope === 'category') { out.categoryNodeId = t.categoryNodeId; out.category = t.categoryName; }
    if (t.scope === 'products') out.productIds = t.productIds || [];
    if (t.offer && t.offer.kind === 'library') out.offer = { brandOfferId: t.offer.brandOfferId };
    if (t.offer && t.offer.kind === 'special') {
      out.offer = { offerType: t.offer.offerType, offerConfigJson: t.offer.offerConfigJson, name: t.offer.name || null, saveToLibrary: !!t.offer.saveToLibrary };
      if (t.offer.validFrom) out.offerValidFrom = t.offer.validFrom;
      if (t.offer.validUntil) out.offerValidUntil = t.offer.validUntil;
    }
  }
  if (goal !== 'conversion') out.fee = num(t.fee);
  if (goal === 'engagement') {
    out.deliverables = (t.deliverables || []).map(r => ({ type: r.type, count: Number(r.count) || 1 }));
    if (t.usage && t.usage.on) out.usageRights = { on: true, durationDays: t.usage.durationDays == null ? null : Number(t.usage.durationDays), places: t.usage.places || [] };
  }
  if (t.note && t.note.trim()) out.note = t.note.trim();
  return out;
}

/** "10% · whole store · Festive 15%" / "₹8,000 · 1 reel, 2 stories" / "₹5,000 + 10% · Sarees · special offer" */
export function summaryLine(goal, t) {
  if (goal === 'engagement') return [t.fee !== '' && t.fee != null ? rupees5(t.fee) : null, deliverablesShort(t.deliverables)].filter(Boolean).join(' · ');
  const money = goal === 'hybrid' ? [t.fee !== '' && t.fee != null ? rupees5(t.fee) : null, fmtPct5(t.commissionPct)].filter(Boolean).join(' + ') : fmtPct5(t.commissionPct);
  const scope = t.scope === 'category' ? (t.categoryName || 'a category') : t.scope === 'products' ? `${(t.productIds || []).length} ${(t.productIds || []).length === 1 ? 'product' : 'products'}` : 'whole store';
  const offer = t.offer ? (t.offer.name || (t.offer.kind === 'special' ? 'special offer' : 'saved offer')) : 'no offer';
  return [money, scope, offer].filter(Boolean).join(' · ');
}

/** The value shown on the "What she can sell" row. */
export function scopeValue(t) {
  if (t.scope === 'category') return t.categoryName || SCOPE_LABEL.category;
  if (t.scope === 'products') return (t.productIds || []).length ? `${t.productIds.length} ${t.productIds.length === 1 ? 'product' : 'products'}` : SCOPE_LABEL.products;
  return SCOPE_LABEL.store;
}

export const usagePlaceLabel = (code) => (USAGE_PLACES.find(p => p[0] === code) || [])[1] || code;
