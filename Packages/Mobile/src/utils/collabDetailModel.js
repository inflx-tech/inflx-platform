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
      return { tone: 'done', label: 'Live — tracking performance', sub: 'Your content is live. See how it is performing.', actions: ['tracking'] };
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
  if (post) out.push({ key: 'tracking', label: 'Performance' });
  if (post) out.push({ key: 'earnings', label: 'Earnings' });
  if (post && Number(d?.products_total) > 0) out.push({ key: 'products', label: 'Products in store' });
  return out;
}

/**
 * SPINE and spineFor were DELETED by Stage 3, not repaired.
 * Contract: features/stage-3-watch-the-work-happen
 *
 * They were a SECOND step model — Invite · Nego · Sign · Active · Track · Done — competing
 * with the six the server decides in collabStep.service. And they were already broken:
 * spineFor matched on stage names that Stage 1 renamed, and the two lists overlapped in
 * exactly ONE value, so findIndex returned -1 and every node rendered "todo". Her spine
 * highlighted nothing at all.
 *
 * The step now comes from GET /influencers/me/needs-you via utils/creatorSteps, which is
 * the same number the brand reads. Do not reintroduce a local derivation: two of them is
 * how her phone and his start telling different stories about one collaboration.
 */
