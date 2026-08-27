/* ════════════════════════════════════════════════════════════════════════
   The ONE thing a brand should do next on a campaign.
   Contract: features/retire-old-campaign-stage-rail
   Originally features/brand-mobile-cc (A6), as campaignStages.js.

   WHAT THIS FILE USED TO BE, AND WHY IT IS NOT
   It carried a six-stage model — Fund · Roster · Contracts · Production · Review · Payout —
   rendered as a strip across the top of the campaign screen.

   Stage 3 then agreed a DIFFERENT six, decided on the server and shown per creator:
   Agree · Sign · Shoot · Shop posts · Go live · Complete.

   Two six-step vocabularies in one app, half the words colliding — Contracts/Sign,
   Production/Shoot, Review/Shop posts — and not even measuring the same thing: one was the
   campaign, one is a single collaboration. The founder spotted it in a screenshot on
   2026-08-27 and asked for it gone.

   The stages are deleted rather than hidden, and the file renamed, because a module called
   `campaignStages` containing no stages is a trap for whoever reads it next.

   WHAT SURVIVED, AND WHY
   The primary action. "Fund wallet & publish" is the thing mobile never had on this screen,
   and "Review 3 applications" answers a real question. It names no competing six.

   Pure and testable; the screen maps `prime.kind` to a destination.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * @returns { prime: { label, kind } }
 *
 * `kind` is what the screen switches on: publish · payout · applications · negotiations ·
 * live · reviews · none.
 *
 * ORDER IS DELIBERATE, and it is a business rule rather than a rendering one: money that is
 * already owed outranks work still being checked. A pending live-URL confirmation releases
 * Tranche 2, so it is offered before a queue of deliverables to review.
 */
export function campaignPrimeAction(status, c = {}) {
  const {
    applicationsCount = 0,
    reviewsCount = 0,
    liveConfirmCount = 0,
    negotiatingCount = 0,
  } = c;

  if (status === 'draft' || status === 'pending_wallet') {
    return { prime: { label: 'Fund wallet & publish', kind: 'publish' } };
  }
  if (status === 'cancelled') {
    return { prime: { label: 'Campaign cancelled', kind: 'none' } };
  }
  if (status === 'completed') {
    return { prime: { label: 'View payouts', kind: 'payout' } };
  }
  if (applicationsCount > 0) {
    return {
      prime: {
        label: `Review ${applicationsCount} application${applicationsCount !== 1 ? 's' : ''}`,
        kind: 'applications',
      },
    };
  }
  if (negotiatingCount > 0) {
    return {
      prime: {
        label: `${negotiatingCount} negotiation${negotiatingCount !== 1 ? 's' : ''} open`,
        kind: 'negotiations',
      },
    };
  }
  if (liveConfirmCount > 0) {
    return {
      prime: {
        label: `Confirm ${liveConfirmCount} live URL${liveConfirmCount !== 1 ? 's' : ''}`,
        kind: 'live',
      },
    };
  }
  if (reviewsCount > 0) {
    return {
      prime: {
        label: `Review ${reviewsCount} deliverable${reviewsCount !== 1 ? 's' : ''}`,
        kind: 'reviews',
      },
    };
  }
  return { prime: { label: 'All caught up', kind: 'none' } };
}
