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
 * Returns { tone, label, sub, actions:[...] } — each action a symbolic key the screen maps:
 * 'accept' | 'negotiate' | 'pass' | 'sign' | 'logistics' | 'deliverables' | 'earnings'.
 *
 * ⚠️ THE STAGE NAMES HERE MUST BE THE SIX FROM collabStages.COLLAB_STAGES.
 *
 * They were not, and the cost was a live screen. This switch matched on `invites`, `applied`,
 * `negotiating`, `active`, `tracking`, `completed` and `archive` — the vocabulary from BEFORE
 * Stage 1 renamed them. `deriveStage` returns `invitations`, `pitches`, `to_sign`, `shoot`,
 * `content`, `done`.
 *
 * The two lists overlapped in EXACTLY ONE value: `to_sign`. Everything else fell through to the
 * default and rendered **"Closed — This collab is closed."** with no buttons at all. A creator
 * holding a live invitation could not accept, counter or pass. A creator mid-shoot was told her
 * collaboration was over.
 *
 * Found by the founder on 2026-08-28, on Ravi K.'s invitation to "New test campaign".
 *
 * The bitter part: the comment below this function explains that SPINE was deleted for this
 * exact fault — "matched on stage names that Stage 1 renamed, and the two lists overlapped in
 * exactly ONE value". Its neighbour carried the identical defect and nobody looked.
 *
 * A test now compares the two lists directly, so a rename cannot split them again.
 */
export function heroFor(d) {
  const status = String(d?.status || '').toLowerCase();

  // Settled but not yet briefed: she agreed terms and the brand has not built a campaign around
  // them. There is nothing for her to do, and saying so beats offering an action she cannot take.
  const settled = status === 'agreed' || status === 'accepted';

  switch (d?.stage) {
    case 'invitations':
      if (settled) {
        return { tone: 'brand', label: 'Terms agreed',
          sub: 'Waiting for the brand to build the campaign. Nothing needed from you yet.', actions: [] };
      }
      // negotiating and awaiting_* land in invitations too — the turn decides the words.
      if (status === 'negotiating' || status === 'awaiting_brand' || status === 'awaiting_influencer') {
        return d?.turn === 'you'
          ? { tone: 'nego', label: 'Your move', sub: 'Review the latest terms and respond.', actions: ['negotiate'] }
          : { tone: 'brand', label: 'Waiting for the brand', sub: 'Your terms are with the brand.', actions: ['negotiate'] };
      }
      if (d?.turn === 'brand') {
        return { tone: 'brand', label: 'Waiting for the brand', sub: 'Your reply is with them.', actions: [] };
      }
      return { tone: 'you', label: 'Review this invite',
        sub: 'Accept the offer, negotiate the terms, or pass.',
        actions: ['accept', 'negotiate', 'pass'] };

    case 'pitches':
      if (settled) {
        return { tone: 'brand', label: 'They accepted',
          sub: 'Waiting for the brand to build the campaign.', actions: [] };
      }
      return d?.turn === 'you'
        ? { tone: 'nego', label: 'Your move', sub: 'They replied — review the terms and respond.', actions: ['negotiate'] }
        : { tone: 'brand', label: 'Pitch sent', sub: 'The brand is deciding — nothing needed from you yet.', actions: [] };

    case 'to_sign':
      if (status === 'pending_brand' || status === 'contracted') {
        return { tone: 'brand', label: 'Signed — waiting for brand',
          sub: 'The brand will countersign to activate. Tranche 1 releases then.', actions: [] };
      }
      return { tone: 'you', label: 'Review & sign contract',
        sub: 'Sign to lock the deal — Tranche 1 releases on both signatures.', actions: ['sign'] };

    case 'shoot':
      // Stage 4 gave the shoot its own screen. Before this fix the stage had no case at all and
      // fell through to "closed" — telling a creator with a parcel on the way that it was over.
      return { tone: 'you', label: 'The shoot',
        sub: 'Settle the time, confirm what arrives, and shoot.', actions: ['logistics'] };

    case 'content':
      return d?.pendingDeliverable
        ? { tone: 'you', label: 'Deliver your content', sub: 'Upload or submit the pending deliverable.', actions: ['deliverables'] }
        : { tone: 'brand', label: 'With the brand for review', sub: 'Your content is submitted — awaiting brand review.', actions: ['deliverables'] };

    case 'done':
      // Finished and closed both land here. A completed collaboration should read as an
      // achievement with earnings behind it, not as "closed".
      if (TERMINAL_LABEL[status]) {
        return { tone: 'closed', label: TERMINAL_LABEL[status], sub: 'This collab is closed.', actions: [] };
      }
      return { tone: 'done', label: 'Collab complete',
        sub: 'View your earnings and tranche schedule.', actions: ['earnings'] };

    default:
      // A stage nobody has thought of yet. Show it as open rather than closed — telling a
      // creator her live work is finished is precisely the failure this function just had.
      return { tone: 'brand', label: 'In progress',
        sub: 'This collaboration is under way.', actions: [] };
  }
}

/**
 * Which section cards to show, in order, for the current engagement.
 * `d` = { stage, physical_delivery, products_total }.
 * Returns [{ key, label }] — the screen renders + routes each.
 *
 * ⚠️ Same rule as heroFor: these are the six from COLLAB_STAGES. This function had the same
 * stale vocabulary — `active`, `tracking`, `completed` — so a creator at `shoot` or `content`
 * saw only "Terms & brief" and none of her contract, logistics, deliverables or earnings.
 */
export function sectionsFor(d) {
  const stage = d?.stage;
  // Everything from the shoot onwards: the deal is signed and work is under way.
  const post = stage === 'shoot' || stage === 'content' || stage === 'done';
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
