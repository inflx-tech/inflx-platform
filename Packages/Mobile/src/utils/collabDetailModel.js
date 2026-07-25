/* ════════════════════════════════════════════════════════════════════════
   CollabDetail model — pure, testable presentation logic for the unified
   engagement hub (features/collab-detail). No API, no navigation here.
   Consumes the record + loaded detail; the screen maps `action` → nav/API.
   ════════════════════════════════════════════════════════════════════════ */

const TERMINAL_LABEL = {
  declined: 'Declined', expired: 'Expired', rejected_by_brand: 'Not selected',
  slots_filled: 'Slots filled', cancelled: 'Cancelled', walked_away: 'Closed', closed: 'Closed',
};

/**
 * The one "next action" for the current stage.
 * `d` = { stage, status, turn, pendingDeliverable }.
 * Returns { tone, label, sub, actions:[...] } where each action is a symbolic
 * key the screen maps: 'accept'|'negotiate'|'pass'|'sign'|'deliverables'|'earnings'.
 */
export function heroFor(d) {
  const status = String(d?.status || '').toLowerCase();
  switch (d?.stage) {
    case 'invites':
      return { tone: 'you', label: 'Review this invite',
        sub: 'Accept the offer, negotiate the terms, or pass.',
        actions: ['accept', 'negotiate', 'pass'] };
    case 'applied':
      return { tone: 'brand', label: 'Application sent',
        sub: 'The brand is choosing creators — nothing needed from you yet.', actions: [] };
    case 'negotiating':
      return d?.turn === 'you'
        ? { tone: 'nego', label: 'Your move', sub: 'Review the latest terms and respond.', actions: ['negotiate'] }
        : { tone: 'brand', label: 'Waiting for the brand', sub: 'Your terms are with the brand.', actions: ['negotiate'] };
    case 'to_sign':
      if (status === 'pending_brand' || status === 'contracted') {
        return { tone: 'brand', label: 'Signed — waiting for brand',
          sub: 'The brand will countersign to activate. Tranche 1 releases then.', actions: [] };
      }
      return { tone: 'you', label: 'Review & sign contract',
        sub: 'Sign to lock the deal — Tranche 1 releases on both signatures.', actions: ['sign'] };
    case 'active':
      return d?.pendingDeliverable
        ? { tone: 'you', label: 'Deliver your content', sub: 'Upload or submit the pending deliverable.', actions: ['deliverables'] }
        : { tone: 'brand', label: 'With the brand for review', sub: 'Your content is submitted — awaiting brand review.', actions: ['deliverables'] };
    case 'tracking':
      return { tone: 'done', label: 'Live — tracking performance', sub: 'Your content is live and being tracked.', actions: ['deliverables'] };
    case 'completed':
      return { tone: 'done', label: 'Collab complete', sub: 'View your earnings and tranche schedule.', actions: ['earnings'] };
    case 'archive':
    default:
      return { tone: 'closed', label: TERMINAL_LABEL[status] || 'Closed',
        sub: 'This collab is closed.', actions: [] };
  }
}

/**
 * Which section cards to show, in order, for the current engagement.
 * `d` = { stage, physical_delivery, products_total }.
 * Returns [{ key, label }] — the screen renders + routes each.
 */
export function sectionsFor(d) {
  const stage = d?.stage;
  const post = stage === 'active' || stage === 'tracking' || stage === 'completed';
  const signedOn = post || stage === 'to_sign';
  const out = [];

  out.push({ key: 'terms', label: 'Terms & brief' });
  if (signedOn) out.push({ key: 'contract', label: 'Contract' });
  if (post && d?.physical_delivery) out.push({ key: 'logistics', label: 'Logistics' });
  if (post) out.push({ key: 'deliverables', label: 'Deliverables' });
  if (post) out.push({ key: 'earnings', label: 'Earnings' });
  if (post && Number(d?.products_total) > 0) out.push({ key: 'products', label: 'Products in store' });
  return out;
}

/** Progress-spine nodes with the current one flagged. */
export const SPINE = [
  { key: 'invite', label: 'Invite', stages: ['invites', 'applied'] },
  { key: 'nego',   label: 'Nego',   stages: ['negotiating'] },
  { key: 'sign',   label: 'Sign',   stages: ['to_sign'] },
  { key: 'active', label: 'Active', stages: ['active'] },
  { key: 'track',  label: 'Track',  stages: ['tracking'] },
  { key: 'done',   label: 'Done',   stages: ['completed'] },
];

/** Returns spine nodes with { state: 'done'|'current'|'todo' } for a stage. */
export function spineFor(stage) {
  const idx = SPINE.findIndex(n => n.stages.includes(stage));
  // archive / unknown → no highlight
  return SPINE.map((n, i) => ({
    ...n,
    state: idx < 0 ? 'todo' : i < idx ? 'done' : i === idx ? 'current' : 'todo',
  }));
}
